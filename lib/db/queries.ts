import { asc, desc, eq, sql, type AnyColumn } from "drizzle-orm";
import { db } from "./index";
import {
  players,
  playerStatsTotals,
  playerStatsPerGame,
  advancedStats,
  salaries,
} from "./schema";

export const PAGE_SIZE = 100;

export interface ListParams {
  season: string; // "ALL" or e.g. "2022-2023"
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
function orderByNullsLast(column: AnyColumn, dir: "asc" | "desc") {
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
  const where = params.season !== "ALL" ? eq(t.season, params.season) : undefined;

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
  const where = params.season !== "ALL" ? eq(advancedStats.season, params.season) : undefined;

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

const salariesSortColumns = {
  name: players.name,
  season: salaries.season,
  team: salaries.team,
  salary: salaries.salary,
  teamPayroll: salaries.teamPayroll,
  pctOfTeamCap: salaries.pctOfTeamCap,
  pctOfLeagueCap: salaries.pctOfLeagueCap,
  spotracBase: salaries.spotracBase,
  spotracCapHit: salaries.spotracCapHit,
} as const;

export type SalariesSortKey = keyof typeof salariesSortColumns;

export async function getSalaries(params: ListParams) {
  const page = clampPage(params.page);
  const sortCol = salariesSortColumns[params.sort as SalariesSortKey] ?? salaries.salary;
  const where = params.season !== "ALL" ? eq(salaries.season, params.season) : undefined;

  const rowsQuery = db
    .select({
      id: salaries.id,
      playerId: salaries.playerId,
      name: players.name,
      season: salaries.season,
      team: salaries.team,
      salary: salaries.salary,
      teamPayroll: salaries.teamPayroll,
      leagueCap: salaries.leagueCap,
      pctOfTeamCap: salaries.pctOfTeamCap,
      pctOfLeagueCap: salaries.pctOfLeagueCap,
      spotracBase: salaries.spotracBase,
      spotracCapHit: salaries.spotracCapHit,
    })
    .from(salaries)
    .innerJoin(players, eq(players.id, salaries.playerId))
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
    .select({
      id: salaries.id,
      season: salaries.season,
      team: salaries.team,
      salary: salaries.salary,
      teamPayroll: salaries.teamPayroll,
      leagueCap: salaries.leagueCap,
      pctOfTeamCap: salaries.pctOfTeamCap,
      pctOfLeagueCap: salaries.pctOfLeagueCap,
      spotracBase: salaries.spotracBase,
      spotracCapHit: salaries.spotracCapHit,
    })
    .from(salaries)
    .where(eq(salaries.playerId, playerId))
    .orderBy(asc(salaries.season));
}
