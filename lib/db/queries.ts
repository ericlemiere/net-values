import {
  and,
  asc,
  desc,
  eq,
  ilike,
  isNotNull,
  ne,
  sql,
  type AnyColumn,
  type SQL,
} from "drizzle-orm";
import { db } from "./index";
import {
  players,
  playerStatsTotals,
  playerStatsPerGame,
  advancedStats,
  salaries,
  seasons,
  teams,
  teamPayrolls,
  teamSeasons,
} from "./schema";

export const PAGE_SIZE = 100;

export interface ListParams {
  season: string; // "ALL" or e.g. "2022-2023"
  team: string; // "ALL" or a canonical abbreviation, e.g. "LAL"
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
function listWhere(seasonCol: AnyColumn, teamCol: AnyColumn, params: ListParams) {
  const clauses: SQL[] = [];
  if (params.season !== "ALL") clauses.push(eq(seasonCol, params.season));
  if (params.team !== "ALL") clauses.push(eq(teamCol, params.team));
  if (clauses.length === 0) return undefined;
  return clauses.length === 1 ? clauses[0] : and(...clauses);
}

function orderByNullsLast(column: AnyColumn | SQL, dir: "asc" | "desc") {
  return dir === "asc" ? sql`${column} asc nulls last` : sql`${column} desc nulls last`;
}

async function distinctSeasons(table: typeof playerStatsPerGame | typeof advancedStats | typeof salaries) {
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
export async function getTeams() {
  return db
    .select({ abbr: teams.abbr, name: teams.name })
    .from(teams)
    .orderBy(asc(teams.name));
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

const statSortColumnsFor = (t: typeof playerStatsTotals | typeof playerStatsPerGame) => ({
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

async function getPlayerStatsFrom(t: typeof playerStatsTotals | typeof playerStatsPerGame, params: ListParams) {
  const page = clampPage(params.page);
  const sortColumns = statSortColumnsFor(t);
  const sortCol = sortColumns[params.sort as StatsSortKey] ?? t.pts;
  const where = listWhere(t.season, t.team, params);

  const rowsQuery = db
    .select({
      id: t.id,
      playerId: t.playerId,
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

const advancedSortColumns = {
  name: players.name,
  season: advancedStats.season,
  team: advancedStats.team,
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
} as const;

export type AdvancedSortKey = keyof typeof advancedSortColumns;

export async function getAdvancedStats(params: ListParams) {
  const page = clampPage(params.page);
  const sortCol = advancedSortColumns[params.sort as AdvancedSortKey] ?? advancedStats.vorp;
  const where = listWhere(advancedStats.season, advancedStats.team, params);

  const rowsQuery = db
    .select({
      id: advancedStats.id,
      playerId: advancedStats.playerId,
      name: players.name,
      season: advancedStats.season,
      team: advancedStats.team,
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
    .innerJoin(players, eq(players.id, advancedStats.playerId))
    .orderBy(orderByNullsLast(sortCol, params.dir), asc(players.name))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  const countQuery = db.select({ count: sql<number>`count(*)` }).from(advancedStats);

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
const pctOfTeamCapSql = sql<number | null>`round(100.0 * ${salaries.salary} / nullif(${teamPayrolls.payroll}, 0), 2)`;
const pctOfLeagueCapSql = sql<number | null>`round(100.0 * ${salaries.salary} / nullif(${seasons.leagueCap}, 0), 2)`;

const salarySelection = {
  id: salaries.id,
  season: salaries.season,
  team: salaries.team,
  salary: salaries.salary,
  teamPayroll: teamPayrolls.payroll,
  leagueCap: seasons.leagueCap,
  pctOfTeamCap: pctOfTeamCapSql,
  pctOfLeagueCap: pctOfLeagueCapSql,
};

const salariesSortColumns = {
  name: players.name,
  season: salaries.season,
  team: salaries.team,
  salary: salaries.salary,
  teamPayroll: teamPayrolls.payroll,
  pctOfTeamCap: pctOfTeamCapSql,
  pctOfLeagueCap: pctOfLeagueCapSql,
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
  const sortCol = salariesSortColumns[params.sort as SalariesSortKey] ?? salaries.salary;
  // A salary row with no figure is noise here: every column but the player,
  // season and team renders blank. `and` drops the undefined that listWhere
  // returns for the unfiltered case, so `where` is always defined and the
  // count query below stays in step with the rows.
  const where = and(
    isNotNull(salaries.salary),
    listWhere(salaries.season, salaries.team, params)
  )!;

  const rowsQuery = db
    .select({ playerId: salaries.playerId, name: players.name, ...salarySelection })
    .from(salaries)
    .innerJoin(players, eq(players.id, salaries.playerId))
    // salaries.team is a canonical abbreviation, so it reaches team_payrolls
    // via teams.abbr. LEFT so a salary row still shows when its team payroll
    // or that season's league cap is missing.
    .leftJoin(teams, eq(teams.abbr, salaries.team))
    .leftJoin(
      teamPayrolls,
      and(eq(teamPayrolls.teamId, teams.id), eq(teamPayrolls.season, salaries.season))
    )
    .leftJoin(seasons, eq(seasons.season, salaries.season))
    .orderBy(orderByNullsLast(sortCol, params.dir), asc(players.name))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  const countQuery = db.select({ count: sql<number>`count(*)` }).from(salaries);

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
export async function getTeamsForSeason(season: string): Promise<TeamSeasonRow[]> {
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

  return db
    .select({
      teamId: teams.id,
      abbr: teams.abbr,
      name: teams.name,
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
    })
    .from(teamSeasons)
    .innerJoin(teams, eq(teams.id, teamSeasons.teamId))
    .leftJoin(
      teamPayrolls,
      and(eq(teamPayrolls.teamId, teams.id), eq(teamPayrolls.season, teamSeasons.season))
    )
    .leftJoin(seasons, eq(seasons.season, teamSeasons.season))
    .leftJoin(
      rosterSize,
      and(eq(rosterSize.team, teams.abbr), eq(rosterSize.season, teamSeasons.season))
    )
    .where(eq(teamSeasons.season, season))
    .orderBy(desc(teamSeasons.wins), asc(teams.name));
}

// ---- /teams/[abbr] ----

export async function getTeamByAbbr(abbr: string) {
  const rows = await db
    .select({ id: teams.id, abbr: teams.abbr, name: teams.name })
    .from(teams)
    .where(eq(teams.abbr, abbr.toUpperCase()));
  return rows[0];
}

/** Every season on file for one team, newest first. */
export async function getTeamHistory(teamId: number) {
  return db
    .select({
      season: teamSeasons.season,
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
      and(eq(teamPayrolls.teamId, teamId), eq(teamPayrolls.season, teamSeasons.season))
    )
    .leftJoin(seasons, eq(seasons.season, teamSeasons.season))
    .where(eq(teamSeasons.teamId, teamId))
    .orderBy(desc(teamSeasons.season));
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
      : and(eq(salaries.team, team), eq(salaries.season, season), isNotNull(salaries.salary))!;

  return db
    .select({
      id: salaries.id,
      playerId: players.id,
      name: players.name,
      season: salaries.season,
      salary: salaries.salary,
      pctOfTeamCap: pctOfTeamCapSql,
      pctOfLeagueCap: pctOfLeagueCapSql,
      gp: playerStatsPerGame.gp,
      mp: playerStatsPerGame.mp,
      pts: playerStatsPerGame.pts,
      reb: playerStatsPerGame.reb,
      ast: playerStatsPerGame.ast,
    })
    .from(salaries)
    .innerJoin(players, eq(players.id, salaries.playerId))
    .leftJoin(teams, eq(teams.abbr, salaries.team))
    .leftJoin(
      teamPayrolls,
      and(eq(teamPayrolls.teamId, teams.id), eq(teamPayrolls.season, salaries.season))
    )
    .leftJoin(seasons, eq(seasons.season, salaries.season))
    .leftJoin(
      playerStatsPerGame,
      and(
        eq(playerStatsPerGame.playerId, salaries.playerId),
        eq(playerStatsPerGame.season, salaries.season)
      )
    )
    .where(where)
    .orderBy(desc(salaries.season), orderByNullsLast(salaries.salary, "desc"));
}

// ---- Player detail page: full career log, no filtering/pagination ----

export async function getPlayerById(playerId: number) {
  const rows = await db
    .select({
      id: players.id,
      name: players.name,
      nbaPersonId: players.nbaPersonId,
    })
    .from(players)
    .where(eq(players.id, playerId));
  return rows[0];
}

async function getPlayerCareerStatsFrom(t: typeof playerStatsTotals | typeof playerStatsPerGame, playerId: number) {
  return db
    .select({
      id: t.id,
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

export async function getPlayerCareerSalaries(playerId: number) {
  return db
    .select(salarySelection)
    .from(salaries)
    .leftJoin(teams, eq(teams.abbr, salaries.team))
    .leftJoin(
      teamPayrolls,
      and(eq(teamPayrolls.teamId, teams.id), eq(teamPayrolls.season, salaries.season))
    )
    .leftJoin(seasons, eq(seasons.season, salaries.season))
    .where(eq(salaries.playerId, playerId))
    .orderBy(asc(salaries.season));
}

export interface SalaryComp {
  id: number;
  playerId: number;
  name: string;
  season: string;
  team: string | null;
  pctOfLeagueCap: number | null;
}

/**
 * Other players' seasons whose share of that season's league cap lands within
 * `tolerance` percentage points of `targetPct` — i.e. contracts that cost the
 * same slice of the cap.
 *
 * `scope` splits that into the two tables the player page shows: "season" keeps
 * only the anchor's own season (who else was paid like this at the same time),
 * "historical" keeps every other season (who has been paid like this before).
 *
 * The player himself is excluded, and rows are ordered by how close they are to
 * the target so the tightest comps survive the limit. Windows near the bottom
 * of the scale (minimum contracts) can hold hundreds of rows, hence the cap and
 * the returned totalCount so the UI can say how many were left out.
 */
export async function getSalaryComps({
  playerId,
  targetPct,
  season,
  scope,
  tolerance = 0.5,
  limit = 50,
}: {
  playerId: number;
  targetPct: number;
  season: string;
  scope: "season" | "historical";
  tolerance?: number;
  limit?: number;
}): Promise<{ rows: SalaryComp[]; totalCount: number }> {
  const distance = sql`abs(${pctOfLeagueCapSql} - ${targetPct})`;
  // A null salary or league cap makes the pct — and so the distance — null,
  // which this comparison drops along with the out-of-range rows.
  const where = and(
    ne(salaries.playerId, playerId),
    scope === "season" ? eq(salaries.season, season) : ne(salaries.season, season),
    sql`${distance} <= ${tolerance}`
  );

  const [rows, countResult] = await Promise.all([
    db
      .select({
        id: salaries.id,
        playerId: salaries.playerId,
        name: players.name,
        season: salaries.season,
        team: salaries.team,
        // Cast to float8: the driver hands plain numeric back as a string,
        // which the table's client-side sort would compare lexically.
        pctOfLeagueCap: sql<number | null>`(${pctOfLeagueCapSql})::float8`,
      })
      .from(salaries)
      .innerJoin(players, eq(players.id, salaries.playerId))
      .innerJoin(seasons, eq(seasons.season, salaries.season))
      .where(where)
      .orderBy(sql`${distance} asc`, desc(salaries.season), asc(players.name))
      .limit(limit),
    db
      .select({ count: sql<number>`count(*)` })
      .from(salaries)
      .innerJoin(seasons, eq(seasons.season, salaries.season))
      .where(where),
  ]);

  return { rows, totalCount: Number(countResult[0].count) };
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
export async function searchPlayers(query: string, limit = 10): Promise<PlayerSearchResult[]> {
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
      asc(players.name)
    )
    .limit(limit);
}
