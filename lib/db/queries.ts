import { and, asc, desc, eq, sql, type AnyColumn, type SQL } from "drizzle-orm";
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
  const where = listWhere(salaries.season, salaries.team, params);

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
    where ? rowsQuery.where(where) : rowsQuery,
    where ? countQuery.where(where) : countQuery,
  ]);

  return { rows, totalCount: Number(countResult[0].count), page };
}

// ---- Player detail page: full career log, no filtering/pagination ----

export async function getPlayerById(playerId: number) {
  const rows = await db
    .select({ id: players.id, name: players.name })
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
