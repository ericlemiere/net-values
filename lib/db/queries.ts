import { cache } from "react";
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  sql,
  type AnyColumn,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "./index";
import { awardKey, type AwardCode } from "@/lib/awards";
import type { PriceStat } from "@/lib/price-check";
import {
  players,
  playerStatsTotals,
  playerStatsPerGame,
  advancedStats,
  nbaAdvanced,
  salaries,
  seasons,
  teams,
  teamPayrolls,
  teamSeasons,
  netValues,
  netValueShares,
  teamIdentities,
  teamAliases,
  playerAwards,
} from "./schema";

export const PAGE_SIZE = 100;

export interface TeamIdentity {
  abbr: string;
  name: string;
  firstSeason: string;
  /** Null on the identity the franchise still goes by. */
  lastSeason: string | null;
}

export interface ListParams {
  season: string; // "ALL" or e.g. "2022-2023"
  team: string; // "ALL" or a canonical abbreviation, e.g. "LAL"
  pos: string; // "ALL" or one of POSITIONS
  sort: string;
  dir: "asc" | "desc";
  page: number;
}

function clampPage(page: number) {
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

// Postgres sorts NULLs first by default on DESC, which would push
// unmatched/missing values (e.g. salaries with no Spotrac match) to the
// top of the table. Always put NULLs last regardless of direction.
// Season and team filters combine; either may be "ALL". Returns undefined when
// neither is active so callers can skip .where() entirely.
// Note rows with a NULL team (multi-team/TOT season lines) are excluded by an
// active team filter, which is intended — they belong to no single team.
function listWhere(
  seasonCol: AnyColumn,
  teamCol: AnyColumn,
  // An expression, not just a column: /salaries has no position of its own and
  // reaches for one with a subquery.
  posCol: AnyColumn | SQL,
  params: ListParams,
) {
  const clauses: SQL[] = [];
  if (params.season !== "ALL") clauses.push(eq(seasonCol, params.season));
  if (params.team !== "ALL") clauses.push(eq(teamCol, params.team));
  // split_part rather than a LIKE prefix: it can't confuse "SF" with "SG" and
  // reads as what it is - take the code before the hyphen.
  if (params.pos !== "ALL")
    clauses.push(sql`split_part(${posCol}, '-', 1) = ${params.pos}`);
  if (clauses.length === 0) return undefined;
  return clauses.length === 1 ? clauses[0] : and(...clauses);
}

function orderByNullsLast(column: AnyColumn | SQL, dir: "asc" | "desc") {
  return dir === "asc"
    ? sql`${column} asc nulls last`
    : sql`${column} desc nulls last`;
}

/**
 * What this franchise was called in that season, or NULL if it never changed.
 *
 * Every table stores the canonical abbreviation, which is the right key — one
 * franchise, one row, one URL — but the wrong label for a season played under
 * another name. These restate the label without touching the key, so a 1995-96
 * row reads SEA and still links to /teams/OKC.
 *
 * A correlated subquery rather than a join: team_identities holds fifteen rows,
 * and joining it into queries that already reach four tables would risk
 * multiplying rows for no gain. NULL for the twenty-four franchises that have
 * never changed identity, so callers fall back to the canonical value.
 */
function eraAbbrSql(team: AnyColumn | SQL, season: AnyColumn | SQL) {
  return sql<string | null>`(
    SELECT ti.abbr FROM ${teamIdentities} ti
    JOIN ${teams} era_team ON era_team.id = ti.team_id
    WHERE era_team.abbr = ${team}
      AND ${season} >= ti.first_season
      AND (ti.last_season IS NULL OR ${season} <= ti.last_season)
    LIMIT 1)`;
}

/**
 * The position a player was listed at around a given season.
 *
 * Position lives on a stat line, not on a contract, and the two do not always
 * line up: salaries for the upcoming season are on file before a game has been
 * played, so the newest season on /salaries carries hundreds of contracts and
 * no stat lines at all. Reading pos from the matching season alone left every
 * position on that page empty.
 *
 * So this takes the nearest season he has a position for - the most recent one
 * at or before the contract, which is his position as of signing, falling back
 * to the earliest one after it for a player paid before he ever plays. NULL
 * only for a player with no stat line anywhere.
 *
 * The outer references are written out qualified rather than passed as
 * columns. `player_id` and `season` both exist on the table this subquery
 * reads, so an unqualified outer reference - which is what drizzle renders
 * from a single-table query, as getTeams' comment explains - would bind to the
 * INNER row and quietly match everything.
 */
function nearestPosSql(outerPlayerId: SQL, outerSeason: SQL) {
  return sql<string | null>`(
    SELECT near.pos FROM ${playerStatsPerGame} near
    WHERE near.player_id = ${outerPlayerId}
      AND near.pos IS NOT NULL
    ORDER BY (near.season <= ${outerSeason}) DESC,
             CASE WHEN near.season <= ${outerSeason} THEN near.season END DESC,
             near.season ASC
    LIMIT 1)`;
}

/** The salaries page's own position expression, correlated to a salary row. */
const salaryPosSql = nearestPosSql(
  sql`salaries.player_id`,
  sql`salaries.season`,
);

async function distinctSeasons(
  table: typeof playerStatsPerGame | typeof advancedStats | typeof salaries,
) {
  const rows = await db
    .selectDistinct({ season: table.season })
    .from(table)
    .orderBy(desc(table.season));
  return rows.map((r) => r.season);
}

// player_stats_per_game covers every season with stats (nba_api 1996-97+ and
// sqlite pre-96), so it's the source of truth for the /stats season list —
// player_stats_totals is a strict subset (no true totals exist pre-96).
// The canonical 30 franchises. Every stat/salary table stores team as a
// canonical abbreviation (historical codes like SEA/NJN/VAN were mapped on
// import), so one list serves all three pages.
/**
 * The thirty franchises, each with every identity it has gone by.
 *
 * Two queries merged here rather than one with a correlated subquery. That
 * subquery would have to match team_identities.team_id against teams.id, and
 * drizzle leaves a column unqualified when the query reads from a single
 * table — so `teams.id` renders as a bare "id", which inside the subquery
 * binds to team_identities' OWN id and quietly matches nothing. The other
 * era lookups correlate on `team` and `season`, names no table in their
 * subquery has, so they resolve outward and are safe. This one is not, and
 * fifteen rows are not worth the trap.
 */
export async function getTeams() {
  const [rows, identities] = await Promise.all([
    db
      .select({ id: teams.id, abbr: teams.abbr, name: teams.name })
      .from(teams)
      .orderBy(asc(teams.name)),
    db
      .select({
        teamId: teamIdentities.teamId,
        abbr: teamIdentities.abbr,
        name: teamIdentities.name,
        firstSeason: teamIdentities.firstSeason,
        lastSeason: teamIdentities.lastSeason,
      })
      .from(teamIdentities)
      .orderBy(asc(teamIdentities.firstSeason)),
  ]);

  const byTeam = new Map<number, TeamIdentity[]>();
  for (const { teamId, ...era } of identities) {
    const list = byTeam.get(teamId);
    if (list) list.push(era);
    else byTeam.set(teamId, [era]);
  }

  // Null rather than an empty array for the franchises that never changed, so
  // callers can fall through to the canonical name with a single check.
  return rows.map((t) => ({
    abbr: t.abbr,
    name: t.name,
    eras: byTeam.get(t.id) ?? null,
  }));
}

export async function getStatsSeasons() {
  return distinctSeasons(playerStatsPerGame);
}
export async function getAdvancedStatsSeasons() {
  return distinctSeasons(advancedStats);
}
export async function getSalariesSeasons() {
  return distinctSeasons(salaries);
}

const statSortColumnsFor = (
  t: typeof playerStatsTotals | typeof playerStatsPerGame,
) => ({
  name: players.name,
  season: t.season,
  team: t.team,
  pos: t.pos,
  age: t.age,
  gp: t.gp,
  gs: t.gs,
  mp: t.mp,
  fgm: t.fgm,
  fga: t.fga,
  fgPct: t.fgPct,
  fg3m: t.fg3m,
  fg3a: t.fg3a,
  fg3Pct: t.fg3Pct,
  fg2m: t.fg2m,
  fg2a: t.fg2a,
  fg2Pct: t.fg2Pct,
  efgPct: t.efgPct,
  ftm: t.ftm,
  fta: t.fta,
  ftPct: t.ftPct,
  orb: t.orb,
  drb: t.drb,
  reb: t.reb,
  ast: t.ast,
  stl: t.stl,
  blk: t.blk,
  tov: t.tov,
  pf: t.pf,
  pts: t.pts,
});

export type StatsSortKey = keyof ReturnType<typeof statSortColumnsFor>;

async function getPlayerStatsFrom(
  t: typeof playerStatsTotals | typeof playerStatsPerGame,
  params: ListParams,
) {
  const page = clampPage(params.page);
  const sortColumns = statSortColumnsFor(t);
  const sortCol = sortColumns[params.sort as StatsSortKey] ?? t.pts;
  const where = listWhere(t.season, t.team, t.pos, params);

  const rowsQuery = db
    .select({
      id: t.id,
      playerId: t.playerId,
      name: players.name,
      season: t.season,
      team: t.team,
      teamLabel: eraAbbrSql(t.team, t.season),
      pos: t.pos,
      age: t.age,
      gp: t.gp,
      gs: t.gs,
      mp: t.mp,
      fgm: t.fgm,
      fga: t.fga,
      fgPct: t.fgPct,
      fg3m: t.fg3m,
      fg3a: t.fg3a,
      fg3Pct: t.fg3Pct,
      fg2m: t.fg2m,
      fg2a: t.fg2a,
      fg2Pct: t.fg2Pct,
      efgPct: t.efgPct,
      ftm: t.ftm,
      fta: t.fta,
      ftPct: t.ftPct,
      orb: t.orb,
      drb: t.drb,
      reb: t.reb,
      ast: t.ast,
      stl: t.stl,
      blk: t.blk,
      tov: t.tov,
      pf: t.pf,
      pts: t.pts,
    })
    .from(t)
    .innerJoin(players, eq(players.id, t.playerId))
    .orderBy(orderByNullsLast(sortCol, params.dir), asc(players.name))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  const countQuery = db.select({ count: sql<number>`count(*)` }).from(t);

  const [rows, countResult] = await Promise.all([
    where ? rowsQuery.where(where) : rowsQuery,
    where ? countQuery.where(where) : countQuery,
  ]);

  return { rows, totalCount: Number(countResult[0].count), page };
}

export async function getPlayerStatsTotals(params: ListParams) {
  return getPlayerStatsFrom(playerStatsTotals, params);
}
export async function getPlayerStatsPerGame(params: ListParams) {
  return getPlayerStatsFrom(playerStatsPerGame, params);
}

/**
 * TS% and USG% exist in both sources, so the table shows nba.com's wherever it
 * has them and falls back to basketball-reference for the pre-1996-97 seasons
 * nba.com never covered. Sorting has to agree with what's rendered, so it
 * sorts the same coalesced expression rather than either column alone.
 *
 * The two agree on TS% to within a rounding error. They do NOT agree on USG%:
 * bref estimates team possessions from pace where nba.com counts them, and
 * bref runs about half a point higher league-wide, so the column steps very
 * slightly at the 1996-97 boundary. The glossary says so.
 */
const coalescedTsPct = sql`coalesce(${nbaAdvanced.tsPct}, ${advancedStats.tsPct})`;
const coalescedUsgPct = sql`coalesce(${nbaAdvanced.usgPct}, ${advancedStats.usgPct})`;

const advancedSortColumns = {
  name: players.name,
  season: advancedStats.season,
  team: advancedStats.team,
  pos: advancedStats.pos,
  age: advancedStats.age,
  gp: advancedStats.gp,
  mp: advancedStats.mp,
  // basketball-reference's box-score formulas.
  per: advancedStats.per,
  tsPct: coalescedTsPct,
  usgPct: coalescedUsgPct,
  ows: advancedStats.ows,
  dws: advancedStats.dws,
  ws: advancedStats.ws,
  obpm: advancedStats.obpm,
  dbpm: advancedStats.dbpm,
  bpm: advancedStats.bpm,
  vorp: advancedStats.vorp,
  // nba.com's possession-based numbers. 1996-97 on only.
  poss: nbaAdvanced.poss,
  offRating: nbaAdvanced.offRating,
  defRating: nbaAdvanced.defRating,
  netRating: nbaAdvanced.netRating,
  astPct: nbaAdvanced.astPct,
  astTo: nbaAdvanced.astTo,
  orebPct: nbaAdvanced.orebPct,
  drebPct: nbaAdvanced.drebPct,
  rebPct: nbaAdvanced.rebPct,
  tovPct: nbaAdvanced.tovPct,
  efgPct: nbaAdvanced.efgPct,
  pace: nbaAdvanced.pace,
  pie: nbaAdvanced.pie,
} as const;

export type AdvancedSortKey = keyof typeof advancedSortColumns;

export async function getAdvancedStats(params: ListParams) {
  const page = clampPage(params.page);
  const sortCol =
    advancedSortColumns[params.sort as AdvancedSortKey] ?? advancedStats.vorp;
  const where = listWhere(
    advancedStats.season,
    advancedStats.team,
    advancedStats.pos,
    params,
  );

  const rowsQuery = db
    .select({
      id: advancedStats.id,
      playerId: advancedStats.playerId,
      name: players.name,
      season: advancedStats.season,
      team: advancedStats.team,
      teamLabel: eraAbbrSql(advancedStats.team, advancedStats.season),
      pos: advancedStats.pos,
      age: advancedStats.age,
      gp: advancedStats.gp,
      mp: advancedStats.mp,
      per: advancedStats.per,
      tsPct: advancedStats.tsPct,
      usgPct: advancedStats.usgPct,
      ows: advancedStats.ows,
      dws: advancedStats.dws,
      ws: advancedStats.ws,
      obpm: advancedStats.obpm,
      dbpm: advancedStats.dbpm,
      bpm: advancedStats.bpm,
      vorp: advancedStats.vorp,
      // Both sources' TS%/USG% travel to the caller rather than a coalesce
      // expression: drizzle decodes a numeric COLUMN to a number, but the same
      // value inside a raw sql`` template comes back from pg as a string. The
      // fallback is one `??` at the render site, where the types still hold.
      nbaTsPct: nbaAdvanced.tsPct,
      nbaUsgPct: nbaAdvanced.usgPct,
      poss: nbaAdvanced.poss,
      offRating: nbaAdvanced.offRating,
      defRating: nbaAdvanced.defRating,
      netRating: nbaAdvanced.netRating,
      astPct: nbaAdvanced.astPct,
      astTo: nbaAdvanced.astTo,
      orebPct: nbaAdvanced.orebPct,
      drebPct: nbaAdvanced.drebPct,
      rebPct: nbaAdvanced.rebPct,
      tovPct: nbaAdvanced.tovPct,
      efgPct: nbaAdvanced.efgPct,
      pace: nbaAdvanced.pace,
      pie: nbaAdvanced.pie,
    })
    .from(advancedStats)
    .innerJoin(players, eq(players.id, advancedStats.playerId))
    /*
     * LEFT, not inner: advanced_stats starts in 1989-90 and nba.com's
     * play-by-play only in 1996-97, so an inner join would silently drop
     * 2,771 seasons off the front of the table. The unmatched rows render as
     * em dashes in the nba.com columns, which is the honest answer.
     */
    .leftJoin(
      nbaAdvanced,
      and(
        eq(nbaAdvanced.playerId, advancedStats.playerId),
        eq(nbaAdvanced.season, advancedStats.season),
      ),
    )
    .orderBy(orderByNullsLast(sortCol, params.dir), asc(players.name))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  const countQuery = db
    .select({ count: sql<number>`count(*)` })
    .from(advancedStats);

  const [rows, countResult] = await Promise.all([
    where ? rowsQuery.where(where) : rowsQuery,
    where ? countQuery.where(where) : countQuery,
  ]);

  return { rows, totalCount: Number(countResult[0].count), page };
}

// Team payroll and league cap live in their own tables (one row per team-season
// / per season) rather than being duplicated onto every salary row, so the two
// "% of" figures are computed here instead of stored. nullif guards the divide
// against a 0 or missing denominator.
const pctOfTeamCapSql = sql<
  number | null
>`round(100.0 * ${salaries.salary} / nullif(${teamPayrolls.payroll}, 0), 2)`;
const pctOfLeagueCapSql = sql<
  number | null
>`round(100.0 * ${salaries.salary} / nullif(${seasons.leagueCap}, 0), 2)`;

/**
 * What the league itself paid for this much production.
 *
 * Every season is a ladder of salaries — the highest paid player, the second,
 * the third — and a parallel ladder of production. Rank a player on the second
 * ladder and read the salary off the rung of the same number, and you have
 * what the NBA actually paid, that year, for the amount of basketball he
 * produced. The fourth most productive player is worth whatever the fourth
 * highest-paid player earned.
 *
 * Ranked by PRODUCTION, not by Net Value. Net Value already has salary inside
 * it — it is production minus what the pay bought — so ranking by it and
 * reading a salary back out is circular: a rookie on the minimum who plays
 * well lands near the top of the Net Value board and would come out
 * "deserving" a league-leading contract on the strength of being cheap.
 * Production alone asks the question the column is actually posing.
 *
 * A season nobody has played yet has no production and so no rung, which the
 * `production IS NOT NULL` filter drops rather than ranking every contract
 * equal-first.
 */
const productionRanked = db
  .select({
    playerId: netValues.playerId,
    season: netValues.season,
    rank: sql<number>`rank() over (
      partition by ${netValues.season} order by ${netValues.production} desc)`.as(
      "production_rank",
    ),
  })
  .from(netValues)
  .where(isNotNull(netValues.production))
  .as("production_ranked");

/** The pay ladder the rank above is read against. */
const payLadder = alias(netValues, "pay_ladder");

/**
 * Deserved pay per player-season, ready to join onto anything.
 *
 * A join rather than a correlated subquery on each row, which is what this
 * started as. The subquery was correct and reads better, but it re-ranks the
 * season once per row: sorting /salaries by this across every season took 4.7
 * seconds, and still 1.7 with indexes to help it. Ranking every season once,
 * up front, and hash-joining the result is ~57ms for the same page.
 */
const deservedPay = db
  .select({
    playerId: productionRanked.playerId,
    season: productionRanked.season,
    salary: payLadder.salary,
  })
  .from(productionRanked)
  .innerJoin(
    payLadder,
    and(
      eq(payLadder.season, productionRanked.season),
      // Written out rather than as eq(..., productionRanked.rank). A subquery
      // field that came from a window function, not a column, renders
      // unqualified through the query builder — "production_rank" with no
      // table on it — which Postgres rejects in a join condition.
      sql`${payLadder.salaryRank} = "production_ranked"."production_rank"`,
    ),
  )
  .as("deserved_pay");

/**
 * Deserved pay minus what he was actually paid: money left on the table.
 *
 * Both sides are whole-season figures. A bought-out season is two contracts
 * but one player-season, and the ladder above ranks player-seasons, so
 * charging the gap against one team's slice of the pay would say a team that
 * only wrote half the checks got half the bargain. Rows that are only part of
 * a season come back null rather than repeating the season's gap on each: the
 * figure has no per-contract meaning, and null is also what sorts them out of
 * the way when the table is ordered by this column.
 */
const payDifferenceSql = sql<number | null>`(
  CASE WHEN ${salaries.salary} = ${netValues.salary}
    THEN ${deservedPay.salary} - ${netValues.salary}
  END)`;

/**
 * The most recent league cap on file, used to restate historical salaries in
 * today's money.
 *
 * Cap-adjusting beats adjusting for inflation here: the cap tracks basketball
 * revenue rather than consumer prices, so a player's share of it is his share
 * of what the league could afford to pay anyone. That's the comparison people
 * actually mean when they ask what an old contract would be worth now.
 */
export async function getCurrentCap() {
  const rows = await db
    .select({ season: seasons.season, leagueCap: seasons.leagueCap })
    .from(seasons)
    .where(isNotNull(seasons.leagueCap))
    .orderBy(desc(seasons.season))
    .limit(1);
  const cap = rows[0];
  if (!cap) return null;

  // What a win costs in the latest season that has any production on file.
  // Net Value scores are in wins, so multiplying by this restates any season's
  // score in today's money — the same trick as the cap-adjusted salary column,
  // and the reason the dollar figures are comparable across eras at all.
  const priced = await db
    .select({
      season: netValues.season,
      dollarsPerWin: sql<number>`(sum(${netValues.salary})::float8
        / nullif(sum(${netValues.production}), 0))`,
    })
    .from(netValues)
    // Salaries are on file for the upcoming season before a game has been
    // played, so the most recent season in the table has no production in it
    // at all. Pricing a win off that one divides by nothing.
    .where(isNotNull(netValues.production))
    .groupBy(netValues.season)
    .orderBy(desc(netValues.season))
    .limit(1);

  return {
    season: cap.season,
    leagueCap: cap.leagueCap,
    dollarsPerWin: priced[0]?.dollarsPerWin ?? null,
    pricedSeason: priced[0]?.season ?? null,
  };
}

const salarySelection = {
  id: salaries.id,
  season: salaries.season,
  team: salaries.team,
  teamLabel: eraAbbrSql(salaries.team, salaries.season),
  pos: salaryPosSql,
  salary: salaries.salary,
  teamPayroll: teamPayrolls.payroll,
  leagueCap: seasons.leagueCap,
  pctOfTeamCap: pctOfTeamCapSql,
  pctOfLeagueCap: pctOfLeagueCapSql,
  /**
   * This row's own Net Value, meaning this team's share of the player's.
   *
   * The table lists one row per contract, so a bought-out season is two rows,
   * and hanging the player's whole score on both would print the same figure
   * twice for money that was split. Falls back to the whole score where there
   * is no share to read, which is every ordinary single-contract season.
   */
  netValueScore: sql<number | null>`coalesce(${netValueShares.score}, ${netValues.netValueScore})::float8`,
  netValue: sql<number | null>`${netValues.netValue}::float8`,
  /**
   * The player's pay for the whole season, which is what the two columns
   * below are measured against. Not the same as `salary` above on a season
   * that was split between two teams.
   */
  seasonSalary: netValues.salary,
  deservedSalary: deservedPay.salary,
  payDifference: payDifferenceSql,
  netValueRank: netValues.seasonRank,
  salaryRank: netValues.salaryRank,
  production: sql<number | null>`${netValues.production}::float8`,
  expectedProduction: sql<
    number | null
  >`${netValues.expectedProduction}::float8`,
  availability: sql<number | null>`${netValues.availability}::float8`,
  /** False on a row that is a team paying a player who played elsewhere. */
  playedHere: netValueShares.playedHere,
};

const salariesSortColumns = {
  name: players.name,
  season: salaries.season,
  team: salaries.team,
  pos: salaryPosSql,
  salary: salaries.salary,
  teamPayroll: teamPayrolls.payroll,
  pctOfTeamCap: pctOfTeamCapSql,
  pctOfLeagueCap: pctOfLeagueCapSql,
  // Matches what the column renders — the share where there is one.
  netValueScore: sql`coalesce(${netValueShares.score}, ${netValues.netValueScore})`,
  netValue: netValues.netValue,
  netValueRank: netValues.seasonRank,
  salaryRank: netValues.salaryRank,
  deservedSalary: deservedPay.salary,
  payDifference: payDifferenceSql,
} as const;

export type SalariesSortKey = keyof typeof salariesSortColumns;

// The league cap for one season, for display above the salaries table. Read
// from `seasons` rather than off a result row so it still resolves when the
// current page of salaries is empty. Null for "ALL", which spans many caps.
export async function getLeagueCap(season: string) {
  if (season === "ALL") return null;
  const rows = await db
    .select({ leagueCap: seasons.leagueCap })
    .from(seasons)
    .where(eq(seasons.season, season));
  return rows[0]?.leagueCap ?? null;
}

export async function getSalaries(params: ListParams) {
  const page = clampPage(params.page);
  const sortCol =
    salariesSortColumns[params.sort as SalariesSortKey] ?? salaries.salary;
  // A salary row with no figure is noise here: every column but the player,
  // season and team renders blank. `and` drops the undefined that listWhere
  // returns for the unfiltered case, so `where` is always defined and the
  // count query below stays in step with the rows.
  const where = and(
    isNotNull(salaries.salary),
    listWhere(salaries.season, salaries.team, salaryPosSql, params),
  )!;

  const rowsQuery = db
    .select({
      playerId: salaries.playerId,
      name: players.name,
      ...salarySelection,
    })
    .from(salaries)
    .innerJoin(players, eq(players.id, salaries.playerId))
    // salaries.team is a canonical abbreviation, so it reaches team_payrolls
    // via teams.abbr. LEFT so a salary row still shows when its team payroll
    // or that season's league cap is missing.
    .leftJoin(teams, eq(teams.abbr, salaries.team))
    .leftJoin(
      teamPayrolls,
      and(
        eq(teamPayrolls.teamId, teams.id),
        eq(teamPayrolls.season, salaries.season),
      ),
    )
    .leftJoin(seasons, eq(seasons.season, salaries.season))
    .leftJoin(
      netValues,
      and(
        eq(netValues.playerId, salaries.playerId),
        eq(netValues.season, salaries.season),
      ),
    )
    // Joined on the team too, so each contract row picks up its own slice.
    .leftJoin(
      netValueShares,
      and(
        eq(netValueShares.playerId, salaries.playerId),
        eq(netValueShares.season, salaries.season),
        eq(netValueShares.team, salaries.team),
      ),
    )
    // LEFT, since a season with no games played yet has no rung on the ladder.
    .leftJoin(
      deservedPay,
      and(
        eq(deservedPay.playerId, salaries.playerId),
        eq(deservedPay.season, salaries.season),
      ),
    )
    .orderBy(orderByNullsLast(sortCol, params.dir), asc(players.name))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  const countQuery = db
    .select({ count: sql<number>`count(*)` })
    .from(salaries);

  const [rows, countResult] = await Promise.all([
    rowsQuery.where(where),
    countQuery.where(where),
  ]);

  return { rows, totalCount: Number(countResult[0].count), page };
}

// ---- /teams ----

export interface TeamSeasonRow {
  teamId: number;
  abbr: string;
  name: string;
  season: string;
  wins: number | null;
  losses: number | null;
  winPct: number | null;
  srs: number | null;
  madePlayoffs: boolean | null;
  champion: boolean;
  payroll: number | null;
  /** Payroll as a share of that season's league cap, 0-100. */
  payrollPctOfCap: number | null;
  rosterSize: number | null;
  /**
   * The roster's Net Value added up — the same figure the team page shows,
   * in NVP. Null for a season nobody has played yet.
   */
  netValue: number | null;
  /** The name and code in use that season; null if they never changed. */
  eraName: string | null;
  eraAbbr: string | null;
}

/** Seasons that have a team record, newest first. */
export async function getTeamSeasons() {
  const rows = await db
    .selectDistinct({ season: teamSeasons.season })
    .from(teamSeasons)
    .orderBy(desc(teamSeasons.season));
  return rows.map((r) => r.season);
}

/**
 * One row per team for a season: record, payroll, and how that payroll sits
 * against the league cap.
 *
 * Roster size is counted from `salaries` rather than the stats tables so it
 * describes who was paid, which is what the payroll figure is the sum of.
 */
export async function getTeamsForSeason(
  season: string,
): Promise<TeamSeasonRow[]> {
  const rosterSize = db
    .select({
      team: salaries.team,
      season: salaries.season,
      n: sql<number>`count(*)`.as("n"),
    })
    .from(salaries)
    .where(isNotNull(salaries.salary))
    .groupBy(salaries.team, salaries.season)
    .as("roster");

  /*
   * The same sum the team page's Net Value column shows, for one season and
   * every team at once.
   *
   * Read from net_value_shares rather than net_values so a bought-out contract
   * is charged to the team that owes the money instead of the team the player
   * ended up on — see getTeamNetValues, which does this per team across every
   * season. The full-contract floor is measured against the player's WHOLE
   * salary for the same reason it is there: a buyout leaves the new team
   * paying a fraction of what was a full contract when it was signed.
   */
  const teamNetValue = db
    .select({
      team: netValueShares.team,
      total: sql<number>`sum(${netValueShares.score})`.as("nv_total"),
    })
    .from(netValueShares)
    .innerJoin(
      netValues,
      and(
        eq(netValues.playerId, netValueShares.playerId),
        eq(netValues.season, netValueShares.season),
      ),
    )
    .innerJoin(seasons, eq(seasons.season, netValueShares.season))
    .where(
      and(
        eq(netValueShares.season, season),
        isNotNull(netValueShares.score),
        // ::float8 is required, not defensive — see getTeamNetValues.
        sql`${netValues.salary} >= ${FULL_CONTRACT_SHARE_OF_CAP}::float8 * ${seasons.leagueCap}`,
      ),
    )
    .groupBy(netValueShares.team)
    .as("team_nv");

  return db
    .select({
      teamId: teams.id,
      abbr: teams.abbr,
      name: teams.name,
      /** The name and code in use that season; null if they never changed. */
      eraName: sql<string | null>`(
        SELECT ti.name FROM ${teamIdentities} ti
        WHERE ti.team_id = ${teams.id}
          AND ${teamSeasons.season} >= ti.first_season
          AND (ti.last_season IS NULL OR ${teamSeasons.season} <= ti.last_season)
        LIMIT 1)`,
      eraAbbr: sql<string | null>`(
        SELECT ti.abbr FROM ${teamIdentities} ti
        WHERE ti.team_id = ${teams.id}
          AND ${teamSeasons.season} >= ti.first_season
          AND (ti.last_season IS NULL OR ${teamSeasons.season} <= ti.last_season)
        LIMIT 1)`,
      season: teamSeasons.season,
      wins: teamSeasons.wins,
      losses: teamSeasons.losses,
      // ::float8 matters — node-postgres returns bare `numeric` as a STRING, so
      // without the cast these arrive typed as numbers but behaving as text.
      winPct: sql<number | null>`
        (case when coalesce(${teamSeasons.wins}, 0) + coalesce(${teamSeasons.losses}, 0) > 0
          then round(1000.0 * ${teamSeasons.wins}
               / (${teamSeasons.wins} + ${teamSeasons.losses})) / 1000
        end)::float8`,
      srs: teamSeasons.srs,
      madePlayoffs: teamSeasons.madePlayoffs,
      champion: teamSeasons.champion,
      payroll: teamPayrolls.payroll,
      payrollPctOfCap: sql<number | null>`
        (case when ${seasons.leagueCap} > 0 and ${teamPayrolls.payroll} is not null
          then round(10000.0 * ${teamPayrolls.payroll} / ${seasons.leagueCap}) / 100
        end)::float8`,
      rosterSize: sql<number | null>`${rosterSize.n}::int`,
      netValue: sql<number | null>`${teamNetValue.total}::float8`,
    })
    .from(teamSeasons)
    .innerJoin(teams, eq(teams.id, teamSeasons.teamId))
    .leftJoin(
      teamPayrolls,
      and(
        eq(teamPayrolls.teamId, teams.id),
        eq(teamPayrolls.season, teamSeasons.season),
      ),
    )
    .leftJoin(seasons, eq(seasons.season, teamSeasons.season))
    .leftJoin(
      rosterSize,
      and(
        eq(rosterSize.team, teams.abbr),
        eq(rosterSize.season, teamSeasons.season),
      ),
    )
    // Already scoped to this season inside the subquery, so team alone joins it.
    .leftJoin(teamNetValue, eq(teamNetValue.team, teams.abbr))
    .where(eq(teamSeasons.season, season))
    .orderBy(desc(teamSeasons.wins), asc(teams.name));
}

// ---- /teams/[abbr] ----

// Cached per request: generateMetadata and the page both ask for it.
export const getTeamByAbbr = cache(async (abbr: string) => {
  const rows = await db
    .select({ id: teams.id, abbr: teams.abbr, name: teams.name })
    .from(teams)
    .where(eq(teams.abbr, abbr.toUpperCase()));
  return rows[0];
});

/** Every season on file for one team, newest first. */
export async function getTeamHistory(teamId: number) {
  return db
    .select({
      season: teamSeasons.season,
      /**
       * What the franchise went by that season, null if it never changed. The
       * page heading names it as it stands today, so these are what tell a
       * reader which of the rows were Seattle's.
       *
       * Both, because neither alone covers every case: the abbreviation is the
       * compact label a table wants, but Charlotte's Bobcats decade kept the
       * abbreviation it still uses and changed only the name.
       */
      eraAbbr: sql<string | null>`(
        SELECT ti.abbr FROM ${teamIdentities} ti
        WHERE ti.team_id = ${teamSeasons.teamId}
          AND ${teamSeasons.season} >= ti.first_season
          AND (ti.last_season IS NULL OR ${teamSeasons.season} <= ti.last_season)
        LIMIT 1)`,
      eraName: sql<string | null>`(
        SELECT ti.name FROM ${teamIdentities} ti
        WHERE ti.team_id = ${teamSeasons.teamId}
          AND ${teamSeasons.season} >= ti.first_season
          AND (ti.last_season IS NULL OR ${teamSeasons.season} <= ti.last_season)
        LIMIT 1)`,
      wins: teamSeasons.wins,
      losses: teamSeasons.losses,
      winPct: sql<number | null>`
        (case when coalesce(${teamSeasons.wins}, 0) + coalesce(${teamSeasons.losses}, 0) > 0
          then round(1000.0 * ${teamSeasons.wins}
               / (${teamSeasons.wins} + ${teamSeasons.losses})) / 1000
        end)::float8`,
      srs: teamSeasons.srs,
      madePlayoffs: teamSeasons.madePlayoffs,
      champion: teamSeasons.champion,
      payroll: teamPayrolls.payroll,
      leagueCap: seasons.leagueCap,
      payrollPctOfCap: sql<number | null>`
        (case when ${seasons.leagueCap} > 0 and ${teamPayrolls.payroll} is not null
          then round(10000.0 * ${teamPayrolls.payroll} / ${seasons.leagueCap}) / 100
        end)::float8`,
    })
    .from(teamSeasons)
    .leftJoin(
      teamPayrolls,
      and(
        eq(teamPayrolls.teamId, teamId),
        eq(teamPayrolls.season, teamSeasons.season),
      ),
    )
    .leftJoin(seasons, eq(seasons.season, teamSeasons.season))
    .where(eq(teamSeasons.teamId, teamId))
    .orderBy(desc(teamSeasons.season));
}

/**
 * Every name this franchise has gone by, oldest first.
 *
 * Empty for the twenty-four franchises that have never changed, which is what
 * lets the page say nothing rather than say "always known as" to no purpose.
 */
export async function getTeamIdentities(
  teamId: number,
): Promise<TeamIdentity[]> {
  return db
    .select({
      abbr: teamIdentities.abbr,
      name: teamIdentities.name,
      firstSeason: teamIdentities.firstSeason,
      lastSeason: teamIdentities.lastSeason,
    })
    .from(teamIdentities)
    .where(eq(teamIdentities.teamId, teamId))
    .orderBy(asc(teamIdentities.firstSeason));
}

/** Seasons this team paid anybody, newest first — drives the roster filter. */
export async function getTeamRosterSeasons(abbr: string) {
  const rows = await db
    .selectDistinct({ season: salaries.season })
    .from(salaries)
    .where(eq(salaries.team, abbr.toUpperCase()))
    .orderBy(desc(salaries.season));
  return rows.map((r) => r.season);
}

export type TeamRosterRow = Awaited<ReturnType<typeof getTeamRoster>>[number];

/**
 * Who this team paid, for one season or across all of them.
 *
 * Stats join on player and season only, not team: a player traded mid-season
 * has one combined stat line with no single team on it, and dropping him from
 * his own team's roster would be worse than showing the combined line.
 */
export async function getTeamRoster(abbr: string, season: string) {
  const team = abbr.toUpperCase();
  const where =
    season === "ALL"
      ? and(eq(salaries.team, team), isNotNull(salaries.salary))!
      : and(
          eq(salaries.team, team),
          eq(salaries.season, season),
          isNotNull(salaries.salary),
        )!;

  return db
    .select({
      id: salaries.id,
      playerId: players.id,
      name: players.name,
      season: salaries.season,
      salary: salaries.salary,
      pctOfTeamCap: pctOfTeamCapSql,
      pctOfLeagueCap: pctOfLeagueCapSql,
      /**
       * This team's own piece of the player's Net Value, not the whole thing.
       * On a bought-out contract the two differ sharply: the team owed the
       * money carries the charge with no production against it.
       */
      netValueShare: sql<number | null>`${netValueShares.score}::float8`,
      /**
       * False when this team paid him but he played elsewhere. The stat
       * columns beside it were earned for somebody else, so the row has to say
       * so rather than read as a player who turned up and did nothing.
       */
      playedHere: netValueShares.playedHere,
      gp: playerStatsPerGame.gp,
      mp: playerStatsPerGame.mp,
      pts: playerStatsPerGame.pts,
      reb: playerStatsPerGame.reb,
      ast: playerStatsPerGame.ast,
    })
    .from(salaries)
    .innerJoin(players, eq(players.id, salaries.playerId))
    .leftJoin(
      netValueShares,
      and(
        eq(netValueShares.playerId, salaries.playerId),
        eq(netValueShares.season, salaries.season),
        eq(netValueShares.team, team),
      ),
    )
    .leftJoin(teams, eq(teams.abbr, salaries.team))
    .leftJoin(
      teamPayrolls,
      and(
        eq(teamPayrolls.teamId, teams.id),
        eq(teamPayrolls.season, salaries.season),
      ),
    )
    .leftJoin(seasons, eq(seasons.season, salaries.season))
    .leftJoin(
      playerStatsPerGame,
      and(
        eq(playerStatsPerGame.playerId, salaries.playerId),
        eq(playerStatsPerGame.season, salaries.season),
      ),
    )
    .where(where)
    .orderBy(desc(salaries.season), orderByNullsLast(salaries.salary, "desc"));
}

/**
 * A player counts toward his team's Net Value only if he was on a full
 * contract, expressed as a share of that season's cap so it holds across eras.
 *
 * 0.5% is where the data splits. In 2024-25 the salaries below it are a band
 * at 0.09% of the cap — two-way deals and part-season signings — while real
 * minimum contracts start at 0.82% and spike at 1.35-1.59%. The same gap is
 * there in 1995-96 (0.42%, then 0.87% and 0.98%). Applying it leaves 13.7-15.9
 * qualifying players per team in every season on file, which is a standard
 * 15-man roster.
 */
export const FULL_CONTRACT_SHARE_OF_CAP = 0.005;

/**
 * The share of a contract charged no matter how little the player appeared.
 *
 * Mirrors AVAILABILITY_FLOOR in scraper/compute_net_values.py, which is where
 * it actually takes effect — this copy only exists so the explainer can show
 * the arithmetic it used. Change it there first.
 */
export const AVAILABILITY_FLOOR = 0.5;

export interface TeamNetValue {
  season: string;
  /**
   * The roster's Net Value added up. A sum rather than an average because Net
   * Value is additive in wins: a team carrying extra bodies through injuries
   * would see an average dragged toward its fill-ins, while the sum says
   * plainly how many wins the roster returned above what it cost.
   */
  total: number;
  /** The same figure per qualifying player, for comparing roster quality. */
  average: number;
  players: number;
  rank: number;
  teams: number;
  /**
   * The part of `total` owed to players this team paid but did not field —
   * bought-out contracts it is still carrying. Always zero or negative, since
   * a team gets no production for the money. Broken out because it is a
   * different kind of problem from a roster that underperformed.
   */
  deadMoney: number;
  deadMoneyPlayers: number;
}

/**
 * Team Net Value and its league rank, per season, for one team.
 *
 * Summed from `net_value_shares` rather than whole players, so a bought-out
 * contract is charged to the team that owes it instead of the team the player
 * ended up on. Portland waived Deandre Ayton and still owed $25.6M of his
 * 2025-26 salary while he played 72 games for the Lakers on $8.1M; the shares
 * put -1.57 on Portland and +0.10 on Los Angeles, which between them are
 * exactly his -1.47.
 */
export async function getTeamNetValues(abbr: string): Promise<TeamNetValue[]> {
  const rows = await db.execute(sql`
    WITH qualifying AS (
      SELECT sh.team, sh.season, sh.score, sh.played_here
      FROM ${netValueShares} sh
      JOIN ${netValues} nv
        ON nv.player_id = sh.player_id AND nv.season = sh.season
      JOIN ${seasons} s ON s.season = sh.season
      WHERE sh.score IS NOT NULL
        -- Measured against the player's WHOLE contract, not this team's slice
        -- of it. A buyout leaves the new team paying a fraction of a deal that
        -- was a full contract when it was signed, and that fraction is not a
        -- two-way deal just because it is small.
        --
        -- ::float8 is required, not defensive. Both salary and league_cap are
        -- integers, so Postgres infers this parameter as an integer too; the
        -- neon driver then rejects 0.005 outright, and a client that rounded
        -- instead would silently compare against 0 and let every two-way
        -- contract through.
        AND nv.salary >= ${FULL_CONTRACT_SHARE_OF_CAP}::float8 * s.league_cap
    ),
    totals AS (
      SELECT season, team,
             SUM(score) AS total,
             AVG(score) AS average,
             COUNT(*) AS players,
             COALESCE(SUM(score) FILTER (WHERE NOT played_here), 0) AS dead_money,
             COUNT(*) FILTER (WHERE NOT played_here) AS dead_money_players
      FROM qualifying
      GROUP BY season, team
    ),
    ranked AS (
      SELECT season, team, total, average, players, dead_money, dead_money_players,
             RANK() OVER (PARTITION BY season ORDER BY total DESC) AS rank,
             COUNT(*) OVER (PARTITION BY season) AS teams
      FROM totals
    )
    SELECT season, total::float8, average::float8, players::int, rank::int, teams::int,
           dead_money::float8 AS "deadMoney", dead_money_players::int AS "deadMoneyPlayers"
    FROM ranked
    WHERE team = ${abbr.toUpperCase()}
    ORDER BY season DESC
  `);
  return rows.rows as unknown as TeamNetValue[];
}

export interface NetValueExample {
  playerId: number;
  name: string;
  season: string;
  team: string | null;
  /** What that franchise was called then, null if it never changed. */
  teamLabel: string | null;
  salary: number;
  production: number;
  minutes: number;
  fullWorkload: number;
  availability: number;
  expectedProduction: number;
  netValueScore: number;
  seasonRank: number;
  salaryRank: number;
  leagueCap: number | null;
}

const exampleSelection = {
  playerId: netValues.playerId,
  name: players.name,
  season: netValues.season,
  team: netValues.team,
  teamLabel: eraAbbrSql(netValues.team, netValues.season),
  salary: netValues.salary,
  production: sql<number>`${netValues.production}::float8`,
  minutes: sql<number>`${netValues.minutes}::float8`,
  fullWorkload: sql<number>`${netValues.fullWorkload}::float8`,
  availability: sql<number>`${netValues.availability}::float8`,
  expectedProduction: sql<number>`${netValues.expectedProduction}::float8`,
  netValueScore: sql<number>`${netValues.netValueScore}::float8`,
  seasonRank: netValues.seasonRank,
  salaryRank: netValues.salaryRank,
  leagueCap: seasons.leagueCap,
};

/** Named player-seasons for the explainer, read live so the page can't drift. */
export async function getNetValueExamples() {
  /*
   * The most recent SCORED season, which is not the most recent season on
   * file: next season's salaries are loaded as soon as contracts are signed,
   * so its rows carry a payroll and no production. Everything below prices a
   * season's production against its payroll, and the worked example on the
   * explainer page ranks players within the season, both of which come out as
   * nonsense (a division by zero, and an arbitrary player at the top of an
   * unranked list) if the season hasn't been played yet.
   */
  const latest = await db
    .select({ season: netValues.season })
    .from(netValues)
    .where(isNotNull(netValues.netValueScore))
    .orderBy(desc(netValues.season))
    .limit(1);
  const season = latest[0]?.season ?? "";

  const [best, worst, latestTop, latestBottom, priced] = await Promise.all([
    db
      .select(exampleSelection)
      .from(netValues)
      .innerJoin(players, eq(players.id, netValues.playerId))
      .innerJoin(seasons, eq(seasons.season, netValues.season))
      // Next season's rows carry a salary and no score yet, and Postgres sorts
      // NULLs to the top of a descending order, so without this the all-time
      // best list is ten unplayed contracts.
      .where(isNotNull(netValues.netValueScore))
      .orderBy(desc(netValues.netValueScore))
      .limit(10),
    // Worst list excludes contracts paid above the whole league cap — see
    // OVER_CAP_NOTE. Two player-seasons in NBA history qualify, both Jordan's.
    db
      .select(exampleSelection)
      .from(netValues)
      .innerJoin(players, eq(players.id, netValues.playerId))
      .innerJoin(seasons, eq(seasons.season, netValues.season))
      .where(
        and(
          sql`${netValues.salary} <= ${seasons.leagueCap}`,
          isNotNull(netValues.netValueScore),
        ),
      )
      .orderBy(asc(netValues.netValueScore))
      .limit(10),
    db
      .select(exampleSelection)
      .from(netValues)
      .innerJoin(players, eq(players.id, netValues.playerId))
      .innerJoin(seasons, eq(seasons.season, netValues.season))
      .where(and(eq(netValues.season, season), isNotNull(netValues.seasonRank)))
      .orderBy(asc(netValues.seasonRank))
      .limit(10),
    db
      .select(exampleSelection)
      .from(netValues)
      .innerJoin(players, eq(players.id, netValues.playerId))
      .innerJoin(seasons, eq(seasons.season, netValues.season))
      .where(and(eq(netValues.season, season), isNotNull(netValues.seasonRank)))
      .orderBy(desc(netValues.seasonRank))
      .limit(10),
    db
      .select({
        season: netValues.season,
        pool: sql<number>`sum(${netValues.salary})::float8`,
        produced: sql<number>`sum(${netValues.production})::float8`,
        players: sql<number>`count(*)::int`,
        // What the league actually won that season, for contrast: the sum of
        // production is wins ABOVE replacement, not games won, and the gap
        // between the two numbers is the whole point of a replacement baseline.
        leagueWins: sql<number>`(
          SELECT sum(ts.wins)::int FROM ${teamSeasons} ts WHERE ts.season = ${season}
        )`,
      })
      .from(netValues)
      .where(eq(netValues.season, season))
      .groupBy(netValues.season),
  ]);

  // The excluded seasons themselves, so the page can show what it left out
  // rather than quietly dropping them.
  const overCap = (await db
    .select(exampleSelection)
    .from(netValues)
    .innerJoin(players, eq(players.id, netValues.playerId))
    .innerJoin(seasons, eq(seasons.season, netValues.season))
    .where(sql`${netValues.salary} > ${seasons.leagueCap}`)
    .orderBy(asc(netValues.season))) as NetValueExample[];

  return {
    season,
    best: best as NetValueExample[],
    worst: worst as NetValueExample[],
    overCap,
    latestTop: latestTop as NetValueExample[],
    latestBottom: latestBottom as NetValueExample[],
    pricing: priced[0] ?? null,
  };
}

// ---- Player detail page: full career log, no filtering/pagination ----

// Cached per request: generateMetadata and the page both ask for it.
export const getPlayerById = cache(async (playerId: number) => {
  const rows = await db
    .select({
      id: players.id,
      name: players.name,
      nbaPersonId: players.nbaPersonId,
    })
    .from(players)
    .where(eq(players.id, playerId));
  return rows[0];
});

async function getPlayerCareerStatsFrom(
  t: typeof playerStatsTotals | typeof playerStatsPerGame,
  playerId: number,
) {
  return db
    .select({
      id: t.id,
      season: t.season,
      team: t.team,
      teamLabel: eraAbbrSql(t.team, t.season),
      pos: t.pos,
      age: t.age,
      gp: t.gp,
      gs: t.gs,
      mp: t.mp,
      fgm: t.fgm,
      fga: t.fga,
      fgPct: t.fgPct,
      fg3m: t.fg3m,
      fg3a: t.fg3a,
      fg3Pct: t.fg3Pct,
      fg2m: t.fg2m,
      fg2a: t.fg2a,
      fg2Pct: t.fg2Pct,
      efgPct: t.efgPct,
      ftm: t.ftm,
      fta: t.fta,
      ftPct: t.ftPct,
      orb: t.orb,
      drb: t.drb,
      reb: t.reb,
      ast: t.ast,
      stl: t.stl,
      blk: t.blk,
      tov: t.tov,
      pf: t.pf,
      pts: t.pts,
    })
    .from(t)
    .where(eq(t.playerId, playerId))
    .orderBy(asc(t.season));
}

export async function getPlayerCareerStatsTotals(playerId: number) {
  return getPlayerCareerStatsFrom(playerStatsTotals, playerId);
}
export async function getPlayerCareerStatsPerGame(playerId: number) {
  return getPlayerCareerStatsFrom(playerStatsPerGame, playerId);
}

export async function getPlayerCareerAdvancedStats(playerId: number) {
  return db
    .select({
      id: advancedStats.id,
      season: advancedStats.season,
      team: advancedStats.team,
      teamLabel: eraAbbrSql(advancedStats.team, advancedStats.season),
      pos: advancedStats.pos,
      age: advancedStats.age,
      gp: advancedStats.gp,
      mp: advancedStats.mp,
      per: advancedStats.per,
      tsPct: advancedStats.tsPct,
      usgPct: advancedStats.usgPct,
      ows: advancedStats.ows,
      dws: advancedStats.dws,
      ws: advancedStats.ws,
      obpm: advancedStats.obpm,
      dbpm: advancedStats.dbpm,
      bpm: advancedStats.bpm,
      vorp: advancedStats.vorp,
    })
    .from(advancedStats)
    .where(eq(advancedStats.playerId, playerId))
    .orderBy(asc(advancedStats.season));
}

/** One of the contracts that paid a player in a single season. */
export interface PlayerContract {
  team: string | null;
  /** What that franchise was called then, null if it never changed. */
  teamLabel: string | null;
  salary: number | null;
  /** False on money owed by a team he no longer played for — a buyout. */
  playedHere: boolean;
}

export type PlayerCareerSalary = Awaited<
  ReturnType<typeof getPlayerCareerSalaries>
>[number];

/**
 * A player's career salary log, one row per SEASON rather than per contract.
 *
 * Two contracts in one year used to mean two rows carrying the same net value
 * between them, which read as though the player had been paid twice and scored
 * twice. A bought-out season is still one season: Damian Lillard's 2025-26 is
 * $22.5M owed by Milwaukee, who waived him, plus $14.1M from Portland, who
 * signed him — one row of $36.6M, with the split spelled out in `contracts`.
 *
 * The split comes from net_value_shares, so the page shows the same division
 * the model charged. That also collapses the seasons where two rows were never
 * two contracts in the first place: a legacy season repeats one full-season
 * figure against each team the player passed through, and the model already
 * knows to count it once.
 */
export async function getPlayerCareerSalaries(playerId: number) {
  const rows = await db.execute(sql`
    WITH paid AS (
      SELECT s.id, s.season, s.team, s.salary, s.source
      FROM ${salaries} s
      WHERE s.player_id = ${playerId}
    ),
    collapsed AS (
      SELECT season,
             -- Stable per season, so ?salary= keeps pointing at the same row
             -- as the comps anchor.
             MIN(id) AS id,
             CASE WHEN BOOL_OR(source = 'sqlite_migration') THEN MAX(salary)
                  ELSE SUM(salary) END AS salary,
             (ARRAY_AGG(team ORDER BY salary DESC NULLS LAST, team))[1] AS fallback_team
      FROM paid
      GROUP BY season
    ),
    split AS (
      SELECT sh.season,
             JSON_AGG(
               JSON_BUILD_OBJECT('team', sh.team, 'salary', sh.salary,
                                 'playedHere', sh.played_here,
                                 'teamLabel', (
                                   SELECT ti.abbr FROM ${teamIdentities} ti
                                     JOIN ${teams} era_team ON era_team.id = ti.team_id
                                    WHERE era_team.abbr = sh.team
                                      AND sh.season >= ti.first_season
                                      AND (ti.last_season IS NULL OR sh.season <= ti.last_season)
                                    LIMIT 1))
               ORDER BY sh.played_here DESC, sh.salary DESC NULLS LAST
             ) AS contracts,
             SUM(sh.salary) FILTER (WHERE sh.played_here) AS played_salary
      FROM ${netValueShares} sh
      WHERE sh.player_id = ${playerId}
      GROUP BY sh.season
    ),
    -- Seasons with no net value at all, so no shares to read: a salary we have
    -- no league cap for. The raw rows are all there is to show.
    unpriced AS (
      SELECT season,
             JSON_AGG(
               JSON_BUILD_OBJECT('team', team, 'salary', salary, 'playedHere', TRUE)
               ORDER BY salary DESC NULLS LAST
             ) AS contracts
      FROM paid
      GROUP BY season
    )
    SELECT c.id,
           c.season,
           COALESCE(nv.team, c.fallback_team) AS team,
           (SELECT ti.abbr FROM ${teamIdentities} ti
              JOIN ${teams} era_team ON era_team.id = ti.team_id
             WHERE era_team.abbr = COALESCE(nv.team, c.fallback_team)
               AND c.season >= ti.first_season
               AND (ti.last_season IS NULL OR c.season <= ti.last_season)
             LIMIT 1) AS "teamLabel",
           c.salary::int AS salary,
           COALESCE(sp.contracts, up.contracts) AS contracts,
           tp.payroll AS "teamPayroll",
           se.league_cap AS "leagueCap",
           -- Against the payroll of the team he actually played for, using
           -- only what THAT team paid him. Charging Portland's buyout against
           -- the Lakers' books would read as a far bigger slice of their
           -- payroll than Ayton ever took up.
           round(100.0 * COALESCE(sp.played_salary, c.salary)
                 / NULLIF(tp.payroll, 0), 2) AS "pctOfTeamCap",
           -- Against the league cap it is the whole season's pay, because that
           -- is what the player cost the league, whoever wrote the checks.
           round(100.0 * c.salary / NULLIF(se.league_cap, 0), 2) AS "pctOfLeagueCap",
           nv.net_value_score::float8 AS "netValueScore",
           nv.net_value::float8 AS "netValue",
           nv.season_rank AS "netValueRank",
           nv.salary_rank AS "salaryRank",
           -- Whole-season pay, which is what "deserved" is measured against.
           -- c.salary is the same figure; nv.salary is used so the two sides
           -- of the difference come off the same row the ladder ranks.
           nv.salary AS "seasonSalary",
           deserved_pay.salary AS "deservedSalary",
           nv.production::float8 AS production,
           nv.expected_production::float8 AS "expectedProduction",
           nv.availability::float8 AS availability
    FROM collapsed c
    LEFT JOIN split sp ON sp.season = c.season
    LEFT JOIN unpriced up ON up.season = c.season
    LEFT JOIN ${netValues} nv
           ON nv.player_id = ${playerId} AND nv.season = c.season
    -- What the league paid for this much production that year. Renders with
    -- its own "deserved_pay" alias, so it takes none here.
    LEFT JOIN ${deservedPay}
           ON deserved_pay.player_id = ${playerId}
          AND deserved_pay.season = c.season
    LEFT JOIN ${teams} t ON t.abbr = COALESCE(nv.team, c.fallback_team)
    LEFT JOIN ${teamPayrolls} tp ON tp.team_id = t.id AND tp.season = c.season
    LEFT JOIN ${seasons} se ON se.season = c.season
    ORDER BY c.season ASC
  `);

  return rows.rows as unknown as {
    id: number;
    season: string;
    team: string | null;
    teamLabel: string | null;
    salary: number | null;
    contracts: PlayerContract[];
    teamPayroll: number | null;
    leagueCap: number | null;
    pctOfTeamCap: number | null;
    pctOfLeagueCap: number | null;
    netValueScore: number | null;
    netValue: number | null;
    netValueRank: number | null;
    salaryRank: number | null;
    seasonSalary: number | null;
    deservedSalary: number | null;
    production: number | null;
    expectedProduction: number | null;
    availability: number | null;
  }[];
}

export interface SalaryComp {
  id: number;
  playerId: number;
  name: string;
  season: string;
  team: string | null;
  /** What that franchise was called then, null if it never changed. */
  teamLabel: string | null;
  pctOfLeagueCap: number | null;
  netValueScore: number | null;
}

/**
 * Which slice of the league a comps table is drawn from.
 *
 * "season" is the anchor's own year — who else was paid like this at the same
 * time. The other three all mean "some other year", cut so that a player shows
 * up in at most one of them:
 *
 * - "team" is the franchise he played for that season, through its whole
 *   history: what this team has bought before at this price.
 * - "position" is everyone listed at his position, including his own
 *   teammates — the same contract at the same job.
 * - "other" is the remainder, the rest of the league at another position.
 *
 * "team" and "position" overlap on purpose, so a center comping against his
 * own franchise still appears among centers. "other" excludes both, which is
 * what makes it the remainder rather than a fourth overlapping list.
 */
export type CompScope = "season" | "team" | "position" | "other";

/** The position a comps row is filed under: the primary code, "SG-PG" -> "SG". */
const compPosSql = sql`split_part(${nearestPosSql(
  sql`c.player_id`,
  sql`c.season`,
)}, '-', 1)`;

/**
 * Other players' seasons whose share of that season's league cap lands within
 * `tolerance` percentage points of `targetPct` — i.e. contracts that cost the
 * same slice of the cap.
 *
 * The player himself is excluded, and rows are ordered by how close they are to
 * the target so the tightest comps survive the limit. Windows near the bottom
 * of the scale (minimum contracts) can hold hundreds of rows, hence the cap and
 * the returned totalCount so the UI can say how many were left out.
 *
 * Written out rather than built with the query builder because of the shape of
 * the plan. The cap window is cheap and selective; the position lookup is a
 * correlated subquery per row. Left to itself the planner ran the position
 * lookup against most of the salaries table and took half a second. Pinning
 * the cap window into a MATERIALIZED CTE first, so the position filter only
 * ever sees the few hundred contracts that already cost the right amount,
 * brings the same query in at about 25ms.
 */
export async function getSalaryComps({
  playerId,
  targetPct,
  season,
  scope,
  team = null,
  pos = null,
  tolerance = 0.5,
  limit = 50,
  anchorNetValue = null,
}: {
  playerId: number;
  targetPct: number;
  season: string;
  scope: CompScope;
  /** The anchor season's team. Required by "team", and excluded by "other". */
  team?: string | null;
  /** The anchor's position. Required by "position", and excluded by "other". */
  pos?: string | null;
  tolerance?: number;
  limit?: number;
  /** The anchor season's Net Value, which the returned rows are sorted around. */
  anchorNetValue?: number | null;
}): Promise<{ rows: SalaryComp[]; totalCount: number }> {
  // "team" and "position" can't select anything without something to match on,
  // and a null match would silently widen into "every other season".
  if ((scope === "team" && !team) || (scope === "position" && !pos)) {
    return { rows: [], totalCount: 0 };
  }

  const seasonFilter =
    scope === "season" ? sql`s.season = ${season}` : sql`s.season <> ${season}`;

  // The remainder scope subtracts whatever the two tables above it showed —
  // and only those. With no team or no position to match on, that table was
  // empty, so there is nothing for this one to leave out.
  const filters: SQL[] = [];
  if (scope === "team") filters.push(sql`c.team = ${team}`);
  if (scope === "position") filters.push(sql`${compPosSql} = ${pos}`);
  if (scope === "other") {
    if (team) filters.push(sql`c.team IS DISTINCT FROM ${team}`);
    if (pos) filters.push(sql`${compPosSql} IS DISTINCT FROM ${pos}`);
  }
  const matchFilter =
    filters.length === 0
      ? sql`TRUE`
      : sql.join(filters, sql` AND `);

  // Rounded to two decimals before the comparison, so the window is measured
  // against the same figure the column prints.
  const pct = sql`round(100.0 * s.salary / nullif(${seasons.leagueCap}, 0), 2)`;

  const result = await db.execute(sql`
    WITH cand AS MATERIALIZED (
      SELECT s.id, s.player_id, s.season, s.team,
             ${pct} AS pct,
             abs(${pct} - ${targetPct}) AS dist
      FROM ${salaries} s
      JOIN ${seasons} ON ${seasons.season} = s.season
      WHERE s.player_id <> ${playerId}
        AND ${seasonFilter}
        AND abs(${pct} - ${targetPct}) <= ${tolerance}
    ),
    matched AS (
      SELECT c.* FROM cand c WHERE ${matchFilter}
    ),
    counted AS (SELECT count(*) AS n FROM matched)
    SELECT m.id,
           m.player_id AS "playerId",
           p.name,
           m.season,
           m.team,
           (SELECT ti.abbr FROM ${teamIdentities} ti
              JOIN ${teams} era_team ON era_team.id = ti.team_id
             WHERE era_team.abbr = m.team
               AND m.season >= ti.first_season
               AND (ti.last_season IS NULL OR m.season <= ti.last_season)
             LIMIT 1) AS "teamLabel",
           -- float8, or the driver hands plain numeric back as a string and
           -- the table's client-side sort compares it lexically.
           m.pct::float8 AS "pctOfLeagueCap",
           nv.net_value_score::float8 AS "netValueScore",
           counted.n::int AS "totalCount"
    FROM matched m
    CROSS JOIN counted
    JOIN ${players} p ON p.id = m.player_id
    LEFT JOIN ${netValues} nv
           ON nv.player_id = m.player_id AND nv.season = m.season
    ORDER BY m.dist ASC, m.season DESC, p.name ASC
    LIMIT ${limit}
  `);

  // The count rides along on every row (one CROSS JOIN, rather than a second
  // round trip for a single number) and is stripped back off here, so it never
  // reaches the client component that renders these.
  const counted = result.rows as unknown as (SalaryComp & {
    totalCount: number;
  })[];
  const totalCount = counted[0]?.totalCount ?? 0;
  const rows: SalaryComp[] = counted.map((r) => ({
    id: r.id,
    playerId: r.playerId,
    name: r.name,
    season: r.season,
    team: r.team,
    teamLabel: r.teamLabel,
    pctOfLeagueCap: r.pctOfLeagueCap,
    netValueScore: r.netValueScore,
  }));

  // Which contracts count as comps is decided by cost — everyone inside the
  // cap tolerance — and the query above takes the closest `limit` of them.
  // Ordering happens after that, on outcome rather than price: the players
  // whose Net Value came out nearest this one lead the table. Rows with no Net
  // Value on file sort last, since "unknown" isn't close to anything.
  const ordered =
    anchorNetValue === null
      ? rows
      : [...rows].sort((a, b) => {
          if (a.netValueScore === null) return b.netValueScore === null ? 0 : 1;
          if (b.netValueScore === null) return -1;
          return (
            Math.abs(a.netValueScore - anchorNetValue) -
            Math.abs(b.netValueScore - anchorNetValue)
          );
        });

  return { rows: ordered, totalCount };
}

/**
 * The position a player was listed at around a season, as one of the five
 * primary codes. Null for a player with no stat line anywhere.
 *
 * Same "nearest season" rule the /salaries Pos column uses, so a contract for
 * a season not yet played is filed under the position he last played.
 */
export async function getPlayerPositionForSeason(
  playerId: number,
  season: string,
): Promise<string | null> {
  const rows = await db.execute(sql`
    SELECT split_part(${nearestPosSql(
      sql`${playerId}`,
      sql`${season}`,
    )}, '-', 1) AS pos`);
  const pos = (rows.rows[0] as { pos: string | null } | undefined)?.pos;
  return pos ? pos : null;
}

// ---- Header search ----

export interface PlayerSearchResult {
  id: number;
  name: string;
  firstSeason: string | null;
  lastSeason: string | null;
}

// Diacritic folding, so "jokic" finds Nikola Joki\u0107 and "doncic" finds Luka
// Don\u010di\u0107. Done with translate() rather than the unaccent extension, which isn't
// installed on the database. The two strings are positional: same length, one
// replacement character per source character.
const FOLD_FROM =
  "ÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝàáâãäåçèéêëìíîïñòóôõöùúûüýÿĀāĂăĄąĆćĈĉĊċČčĎďĒēĔĕĖėĘęĚěĜĝĞğĠġĢģĤĥĨĩĪīĬĭĮįİĴĵĶķĹĺĻļĽľŃńŅņŇňŌōŎŏŐőŔŕŖŗŘřŚśŜŝŞşŠšŢţŤťŨũŪūŬŭŮůŰűŲųŴŵŶŷŸŹźŻżŽžØøŁłĐđıßÆæŒœÞþÐð";
const FOLD_TO =
  "AAAAAACEEEEIIIINOOOOOUUUUYaaaaaaceeeeiiiinooooouuuuyyAaAaAaCcCcCcCcDdEeEeEeEeEeGgGgGgGgHhIiIiIiIiIJjKkLlLlLlNnNnNnOoOoOoRrRrRrSsSsSsSsTtTtUuUuUuUuUuUuWwYyYZzZzZzOoLlDdisAaOoTtDd";

const FOLD_MAP = new Map([...FOLD_FROM].map((c, i) => [c, FOLD_TO[i]]));

/** The JS twin of the SQL translate() below — both sides must fold identically. */
function foldDiacritics(value: string) {
  return value.replace(/[^\u0000-\u007f]/g, (c) => FOLD_MAP.get(c) ?? c);
}

const foldedName = sql`translate(${players.name}, ${FOLD_FROM}, ${FOLD_TO})`;

/**
 * Name search for the header's type-ahead. Real players share names (several
 * "Charles Jones"), so each hit carries the career span that tells them apart.
 * The span comes from player_stats_per_game via a LEFT join so a player who
 * only ever appears in the salary tables is still findable.
 *
 * Ranking: names that start with the query first, then whoever played most
 * recently — typing "curry" should surface Stephen before Dell.
 */
export interface TeamSearchResult {
  /** Canonical abbreviation — what /teams/[abbr] is keyed on. */
  abbr: string;
  name: string;
  /**
   * The former identity the query actually matched, when that is not what the
   * franchise is called now. Typing "sonics" finds the Thunder, and this is
   * what lets the result say why rather than looking like a mismatch.
   */
  matchedAs: string | null;
}

/**
 * Team search for the header's type-ahead.
 *
 * Matches the name and abbreviation a franchise uses now, every name it used
 * before, and the source-specific codes in team_aliases. So "sonics", "seattle"
 * and "SEA" all reach Oklahoma City, "bullets" and "WSB" reach Washington, and
 * "bobcats" reaches Charlotte — none of which the canonical row alone contains.
 *
 * One row per franchise: DISTINCT ON keeps the best match, preferring the
 * current identity over a former one over a bare alias, so searching "charlotte"
 * returns the Hornets once rather than three times.
 */
export async function searchTeams(
  query: string,
): Promise<TeamSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const literal = foldDiacritics(q).replace(/[\\%_]/g, (c) => `\\${c}`);
  const pattern = `%${literal}%`;
  const prefix = `${literal}%`;

  const rows = await db.execute(sql`
    WITH hits AS (
      -- tier 0: what the franchise is called today
      SELECT t.id, t.abbr, t.name, NULL::text AS matched, 0 AS tier,
             (t.name ILIKE ${prefix} OR t.abbr ILIKE ${prefix}) AS starts
      FROM ${teams} t
      WHERE t.name ILIKE ${pattern} OR t.abbr ILIKE ${pattern}
      UNION ALL
      -- tier 1: a name or code it used to go by
      SELECT t.id, t.abbr, t.name, ti.name || ' (' || ti.abbr || ')', 1,
             (ti.name ILIKE ${prefix} OR ti.abbr ILIKE ${prefix})
      FROM ${teamIdentities} ti
      JOIN ${teams} t ON t.id = ti.team_id
      WHERE ti.name ILIKE ${pattern} OR ti.abbr ILIKE ${pattern}
      UNION ALL
      -- tier 2: a source's spelling, e.g. bref's BRK or Spotrac's UTH
      SELECT t.id, t.abbr, t.name, ta.alias, 2, (ta.alias ILIKE ${prefix})
      FROM ${teamAliases} ta
      JOIN ${teams} t ON t.id = ta.team_id
      WHERE ta.alias ILIKE ${pattern}
    ),
    best AS (
      SELECT DISTINCT ON (id) id, abbr, name, matched, starts
      FROM hits ORDER BY id, tier, starts DESC
    )
    SELECT abbr, name, matched AS "matchedAs"
    FROM best
    -- A prefix hit first: typing "por" should reach Portland before it reaches
    -- whoever merely contains those letters.
    ORDER BY starts DESC, name ASC
  `);
  return rows.rows as unknown as TeamSearchResult[];
}

export async function searchPlayers(
  query: string,
): Promise<PlayerSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  // The user's text is a literal, not a pattern: neutralize LIKE wildcards
  // (and the escape character itself) before wrapping it in our own.
  const literal = foldDiacritics(q).replace(/[\\%_]/g, (c) => `\\${c}`);
  const lastSeason = sql<string | null>`max(${playerStatsPerGame.season})`;

  return db
    .select({
      id: players.id,
      name: players.name,
      firstSeason: sql<string | null>`min(${playerStatsPerGame.season})`,
      lastSeason,
    })
    .from(players)
    .leftJoin(playerStatsPerGame, eq(playerStatsPerGame.playerId, players.id))
    .where(ilike(foldedName, `%${literal}%`))
    .groupBy(players.id, players.name)
    .orderBy(
      sql`(${foldedName} ilike ${`${literal}%`}) desc`,
      sql`${lastSeason} desc nulls last`,
      asc(players.name),
    );
}

/* ---------------------------------------------------------------- awards -- */

export interface PlayerAward {
  award: AwardCode;
  season: string;
  teamNumber: number | null;
}

/**
 * The badges for a page of table rows, keyed by player and season.
 *
 * A separate keyed lookup rather than a join onto each table's own query,
 * because the badges hang off six different tables — stats, advanced stats,
 * salaries, net value, a team roster, a comps list — and every one of them
 * already has a sort, a filter and a pager a join would have to be threaded
 * through. This leaves all of that alone.
 *
 * Scoped to the rows on screen rather than to a season, because these tables
 * also run in an ALL-seasons mode where one page spans thirty-five of them.
 * Asking for a hundred players' awards is bounded either way; asking for a
 * season's is not the same question.
 *
 * Losing ballot lines are excluded. A fourth-place MVP finish belongs on the
 * awards page, but it is not a badge.
 */
export async function getAwardsForRows(
  rows: { playerId: number; season: string }[],
): Promise<Map<string, PlayerAward[]>> {
  const byKey = new Map<string, PlayerAward[]>();
  if (rows.length === 0) return byKey;

  const playerIds = [...new Set(rows.map((r) => r.playerId))];
  const seasons = [...new Set(rows.map((r) => r.season))];
  const found = await db
    .select({
      playerId: playerAwards.playerId,
      award: playerAwards.award,
      season: playerAwards.season,
      teamNumber: playerAwards.teamNumber,
    })
    .from(playerAwards)
    .where(
      and(
        inArray(playerAwards.playerId, playerIds),
        inArray(playerAwards.season, seasons),
        eq(playerAwards.won, true),
      ),
    );

  for (const r of found) {
    const key = awardKey(r.playerId, r.season);
    const list = byKey.get(key) ?? [];
    list.push({
      award: r.award as AwardCode,
      season: r.season,
      teamNumber: r.teamNumber,
    });
    byKey.set(key, list);
  }
  return byKey;
}

/** One player's winning awards across his whole career, newest season first. */
export async function getPlayerAwards(playerId: number): Promise<PlayerAward[]> {
  const rows = await db
    .select({
      award: playerAwards.award,
      season: playerAwards.season,
      teamNumber: playerAwards.teamNumber,
    })
    .from(playerAwards)
    .where(and(eq(playerAwards.playerId, playerId), eq(playerAwards.won, true)))
    .orderBy(desc(playerAwards.season));
  return rows.map((r) => ({
    award: r.award as AwardCode,
    season: r.season,
    teamNumber: r.teamNumber,
  }));
}

/** Seasons that have any award on record, newest first — the awards page filter. */
// Cached per request: generateMetadata and the page both ask for it.
export const getAwardSeasons = cache(async () => {
  const rows = await db
    .selectDistinct({ season: playerAwards.season })
    .from(playerAwards)
    .orderBy(desc(playerAwards.season));
  return rows.map((r) => r.season);
});

export interface AwardBallotRow {
  playerId: number;
  name: string;
  team: string | null;
  teamLabel: string | null;
  teamNumber: number | null;
  won: boolean;
  rank: number | null;
  /** His Net Value that season, and where it placed him in the league. */
  netValueScore: number | null;
  seasonRank: number | null;
}

/**
 * A whole season's awards, ballots included, grouped by award.
 *
 * The team on each row comes from the player's stat line for that season rather
 * than from the award row, so it reads under whatever name the franchise went
 * by then — the same rule the rest of the site follows.
 */
export async function getSeasonAwards(season: string) {
  const rows = await db
    .select({
      award: playerAwards.award,
      playerId: playerAwards.playerId,
      name: players.name,
      team: advancedStats.team,
      teamLabel: eraAbbrSql(advancedStats.team, playerAwards.season),
      teamNumber: playerAwards.teamNumber,
      won: playerAwards.won,
      rank: playerAwards.rank,
      netValueScore: sql<number | null>`${netValues.netValueScore}::float8`,
      seasonRank: netValues.seasonRank,
    })
    .from(playerAwards)
    .innerJoin(players, eq(players.id, playerAwards.playerId))
    .leftJoin(
      advancedStats,
      and(
        eq(advancedStats.playerId, playerAwards.playerId),
        eq(advancedStats.season, playerAwards.season),
      ),
    )
    .leftJoin(
      netValues,
      and(
        eq(netValues.playerId, playerAwards.playerId),
        eq(netValues.season, playerAwards.season),
      ),
    )
    .where(eq(playerAwards.season, season))
    .orderBy(
      asc(playerAwards.teamNumber),
      asc(playerAwards.rank),
      desc(playerAwards.share),
      asc(players.name),
    );

  const byAward = new Map<AwardCode, AwardBallotRow[]>();
  for (const r of rows) {
    const code = r.award as AwardCode;
    const list = byAward.get(code) ?? [];
    list.push({
      playerId: r.playerId,
      name: r.name,
      team: r.team,
      teamLabel: r.teamLabel,
      teamNumber: r.teamNumber,
      won: r.won,
      rank: r.rank,
      netValueScore: r.netValueScore,
      seasonRank: r.seasonRank,
    });
    byAward.set(code, list);
  }
  return byAward;
}

export interface AwardWinnerRow {
  playerId: number;
  name: string;
  season: string;
  team: string | null;
  teamLabel: string | null;
  netValueScore: number | null;
  seasonRank: number | null;
}

/**
 * Every winner of one award, newest season first.
 *
 * Only the awards with a single winner a year get a page of their own, so this
 * takes `won` at face value and returns a tie as the two rows it is — the two
 * shared Rookie of the Year votes in this range are a fact about the award,
 * not a duplicate to clean up.
 */
export async function getAwardWinners(
  award: AwardCode,
): Promise<AwardWinnerRow[]> {
  const rows = await db
    .select({
      playerId: playerAwards.playerId,
      name: players.name,
      season: playerAwards.season,
      team: advancedStats.team,
      teamLabel: eraAbbrSql(advancedStats.team, playerAwards.season),
      netValueScore: sql<number | null>`${netValues.netValueScore}::float8`,
      seasonRank: netValues.seasonRank,
    })
    .from(playerAwards)
    .innerJoin(players, eq(players.id, playerAwards.playerId))
    .leftJoin(
      advancedStats,
      and(
        eq(advancedStats.playerId, playerAwards.playerId),
        eq(advancedStats.season, playerAwards.season),
      ),
    )
    .leftJoin(
      netValues,
      and(
        eq(netValues.playerId, playerAwards.playerId),
        eq(netValues.season, playerAwards.season),
      ),
    )
    .where(and(eq(playerAwards.award, award), eq(playerAwards.won, true)))
    .orderBy(desc(playerAwards.season), asc(players.name));
  return rows;
}

export interface SeasonChampion {
  abbr: string;
  name: string;
  /** What the franchise was called that season. */
  eraName: string | null;
  wins: number | null;
  losses: number | null;
}

/** Who won the title that season, or null for a season not yet decided. */
export async function getSeasonChampion(
  season: string,
): Promise<SeasonChampion | null> {
  const rows = await db
    .select({
      abbr: teams.abbr,
      name: teams.name,
      eraName: sql<string | null>`(
        SELECT ti.name FROM ${teamIdentities} ti
        WHERE ti.team_id = ${teams.id}
          AND ${teamSeasons.season} >= ti.first_season
          AND (ti.last_season IS NULL OR ${teamSeasons.season} <= ti.last_season)
        LIMIT 1)`,
      wins: teamSeasons.wins,
      losses: teamSeasons.losses,
    })
    .from(teamSeasons)
    .innerJoin(teams, eq(teams.id, teamSeasons.teamId))
    .where(and(eq(teamSeasons.season, season), eq(teamSeasons.champion, true)))
    .limit(1);
  return rows[0] ?? null;
}

export interface SeasonNetValueRow {
  playerId: number;
  name: string;
  team: string | null;
  teamLabel: string | null;
  salary: number | null;
  netValueScore: number | null;
  seasonRank: number | null;
}

const seasonNetValueSelection = {
  playerId: netValues.playerId,
  name: players.name,
  team: netValues.team,
  teamLabel: eraAbbrSql(netValues.team, netValues.season),
  salary: netValues.salary,
  netValueScore: sql<number | null>`${netValues.netValueScore}::float8`,
  seasonRank: netValues.seasonRank,
};

/**
 * The ten best and ten worst Net Values of a season.
 *
 * Ordered by the stored `season_rank` rather than by score, so both ends agree
 * with the rank shown everywhere else on the site — and so a season still on
 * the books but not yet played, whose rows carry a salary and no score, comes
 * back empty instead of ten unplayed contracts.
 */
export async function getSeasonNetValueLeaders(season: string) {
  const [top, bottom] = await Promise.all([
    db
      .select(seasonNetValueSelection)
      .from(netValues)
      .innerJoin(players, eq(players.id, netValues.playerId))
      .where(and(eq(netValues.season, season), isNotNull(netValues.seasonRank)))
      .orderBy(asc(netValues.seasonRank))
      .limit(10),
    db
      .select(seasonNetValueSelection)
      .from(netValues)
      .innerJoin(players, eq(players.id, netValues.playerId))
      .where(and(eq(netValues.season, season), isNotNull(netValues.seasonRank)))
      .orderBy(desc(netValues.seasonRank))
      .limit(10),
  ]);
  return { top, bottom };
}

/**
 * Every player and team page worth listing in the sitemap. Only players with a
 * contract or a stat line on file: a bare row in `players` renders a page with
 * nothing on it, which is not something to ask a search engine to index.
 */
export async function getSitemapEntries() {
  const [playerRows, teamRows] = await Promise.all([
    db.execute<{ id: number }>(sql`
      SELECT id FROM ${players} p
      WHERE EXISTS (SELECT 1 FROM ${salaries} s WHERE s.player_id = p.id)
         OR EXISTS (SELECT 1 FROM ${playerStatsTotals} ps WHERE ps.player_id = p.id)
      ORDER BY id
    `),
    db.select({ abbr: teams.abbr }).from(teams).orderBy(asc(teams.abbr)),
  ]);
  return {
    playerIds: playerRows.rows.map((r) => Number(r.id)),
    teamAbbrs: teamRows.map((r) => r.abbr),
  };
}

/* ----------------------------------------------------------- price check -- */

/**
 * Each /price-check stat as SQL over one season's totals (`t`) and net value
 * (`nv`) row. The page computes the same figures in JS for the player on
 * screen; these exist so the league around him can be ranked on the same
 * terms.
 */
const PRICE_STAT_SQL: Record<PriceStat, SQL> = {
  gp: sql`t.gp`,
  mp: sql`t.mp`,
  sec: sql`t.mp * 60`,
  pts: sql`t.pts`,
  reb: sql`t.reb`,
  orb: sql`t.orb`,
  ast: sql`t.ast`,
  stl: sql`t.stl`,
  blk: sql`t.blk`,
  fg3m: sql`t.fg3m`,
  ftm: sql`t.ftm`,
  nvp: sql`nv.production`,
  tov: sql`t.tov`,
  pf: sql`t.pf`,
  miss: sql`t.fga - t.fgm`,
};

export interface PriceRank {
  /** 1 = the fewest dollars per stat in the league. Null when he isn't in the
   *  pool: no salary, or none of this stat to divide by. */
  rank: number | null;
  /** Everyone who was paid and recorded at least one of this stat. */
  pool: number;
  /** The middle of that pool, in dollars per stat. */
  median: number | null;
}

/**
 * Where one player's dollars-per-stat sits in his season.
 *
 * The pool is every player with a salary and at least one of the stat, so a
 * player with no blocks is left out rather than dividing by zero. Salary is
 * net_values' whole-season figure — what the player cost the league, buyouts
 * included — which is the same number the page shows him being paid.
 */
export async function getPriceRank(
  playerId: number,
  season: string,
  stat: PriceStat,
): Promise<PriceRank> {
  const expr = PRICE_STAT_SQL[stat];
  const rows = await db.execute(sql`
    WITH pool AS (
      SELECT nv.player_id, nv.salary::float8 / (${expr})::float8 AS ratio
      FROM ${netValues} nv
      JOIN ${playerStatsTotals} t
        ON t.player_id = nv.player_id AND t.season = nv.season
      WHERE nv.season = ${season}
        AND nv.salary > 0
        AND (${expr}) > 0
    ),
    me AS (SELECT ratio FROM pool WHERE player_id = ${playerId})
    SELECT
      (SELECT count(*) FROM pool)::int AS pool,
      (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY ratio) FROM pool)
        AS median,
      CASE WHEN EXISTS (SELECT 1 FROM me)
           THEN (SELECT count(*) FROM pool WHERE ratio < (SELECT ratio FROM me))::int + 1
      END AS rank
  `);
  const row = rows.rows[0] as {
    pool: number;
    median: number | null;
    rank: number | null;
  };
  return {
    pool: Number(row.pool),
    median: row.median === null ? null : Number(row.median),
    rank: row.rank === null ? null : Number(row.rank),
  };
}
