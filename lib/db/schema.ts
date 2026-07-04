import {
  pgTable,
  serial,
  integer,
  text,
  varchar,
  numeric,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// precision 8 comfortably holds both per-game decimals (e.g. 21.1) and
// season totals (e.g. MP totals in the 3000s).
const stat = (name: string) => numeric(name, { precision: 8, scale: 2, mode: "number" });

export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  // NBA.com person/team id — null for the rare franchise with no nba_api coverage.
  nbaTeamId: integer("nba_team_id").unique(),
  abbr: varchar("abbr", { length: 3 }).notNull().unique(),
  name: text("name").notNull(),
});

// Historical/bbref-style abbreviations that resolve to a canonical team
// (e.g. WSB -> WAS, CHH -> NOP, BRK -> BKN). Each alias maps to exactly one team.
export const teamAliases = pgTable(
  "team_aliases",
  {
    id: serial("id").primaryKey(),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id),
    alias: varchar("alias", { length: 3 }).notNull(),
  },
  (t) => [uniqueIndex("team_aliases_alias_idx").on(t.alias)]
);

export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  // Not unique: real players across NBA history share names (e.g. multiple
  // "Charles Jones"). nbaPersonId/bbrefSlug are the real identity keys.
  name: text("name").notNull(),
  nbaPersonId: integer("nba_person_id").unique(),
  bbrefSlug: text("bbref_slug").unique(),
});

// Confirmed name variants (from fuzzy salary matching or manual review) that
// permanently resolve to a canonical player, e.g. "steph curry" -> Stephen Curry.
export const playerAliases = pgTable(
  "player_aliases",
  {
    id: serial("id").primaryKey(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    alias: text("alias").notNull(),
    note: text("note"),
  },
  (t) => [uniqueIndex("player_aliases_alias_idx").on(t.alias)]
);

// Shared column shape for the totals/per-game stat tables. Called once per
// table so each pgTable gets its own column instances.
function statColumns() {
  return {
    team: varchar("team", { length: 3 }),
    pos: varchar("pos", { length: 10 }),
    age: integer("age"),
    gp: integer("gp"),
    gs: integer("gs"),
    mp: stat("mp"),
    fgm: stat("fgm"),
    fga: stat("fga"),
    fgPct: stat("fg_pct"),
    fg3m: stat("fg3m"),
    fg3a: stat("fg3a"),
    fg3Pct: stat("fg3_pct"),
    fg2m: stat("fg2m"),
    fg2a: stat("fg2a"),
    fg2Pct: stat("fg2_pct"),
    efgPct: stat("efg_pct"),
    ftm: stat("ftm"),
    fta: stat("fta"),
    ftPct: stat("ft_pct"),
    orb: stat("orb"),
    drb: stat("drb"),
    reb: stat("reb"),
    ast: stat("ast"),
    stl: stat("stl"),
    blk: stat("blk"),
    tov: stat("tov"),
    pf: stat("pf"),
    pts: stat("pts"),
    // 'nba_api' (1996-97+) or 'sqlite' (1989-90 through 1995-96)
    source: varchar("source", { length: 20 }).notNull(),
  };
}

export const playerStatsTotals = pgTable(
  "player_stats_totals",
  {
    id: serial("id").primaryKey(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    season: text("season").notNull(),
    ...statColumns(),
  },
  (t) => [
    uniqueIndex("player_stats_totals_player_season_idx").on(t.playerId, t.season),
    index("player_stats_totals_season_idx").on(t.season),
  ]
);

export const playerStatsPerGame = pgTable(
  "player_stats_per_game",
  {
    id: serial("id").primaryKey(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    season: text("season").notNull(),
    ...statColumns(),
  },
  (t) => [
    uniqueIndex("player_stats_per_game_player_season_idx").on(t.playerId, t.season),
    index("player_stats_per_game_season_idx").on(t.season),
  ]
);

export const advancedStats = pgTable(
  "advanced_stats",
  {
    id: serial("id").primaryKey(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    season: text("season").notNull(),
    team: varchar("team", { length: 3 }),
    pos: varchar("pos", { length: 10 }),
    age: integer("age"),
    gp: integer("gp"),
    mp: integer("mp"),
    per: stat("per"),
    tsPct: stat("ts_pct"),
    usgPct: stat("usg_pct"),
    ows: stat("ows"),
    dws: stat("dws"),
    ws: stat("ws"),
    obpm: stat("obpm"),
    dbpm: stat("dbpm"),
    bpm: stat("bpm"),
    vorp: stat("vorp"),
    source: varchar("source", { length: 20 }).notNull(),
  },
  (t) => [
    uniqueIndex("advanced_stats_player_season_idx").on(t.playerId, t.season),
    index("advanced_stats_season_idx").on(t.season),
  ]
);

export const salaries = pgTable(
  "salaries",
  {
    id: serial("id").primaryKey(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    season: text("season").notNull(),
    team: varchar("team", { length: 3 }),
    // Hoopshype-sourced salary, joined with team/league cap context (1990-91 through 2022-23)
    salary: integer("salary"),
    teamPayroll: integer("team_payroll"),
    leagueCap: integer("league_cap"),
    pctOfTeamCap: numeric("pct_of_team_cap", { precision: 6, scale: 2, mode: "number" }),
    pctOfLeagueCap: numeric("pct_of_league_cap", { precision: 6, scale: 2, mode: "number" }),
    // Spotrac-sourced cap hit data, only available 2011-12 onward
    spotracBase: integer("spotrac_base"),
    spotracCapHit: integer("spotrac_cap_hit"),
    source: varchar("source", { length: 20 }).notNull().default("sqlite_migration"),
  },
  (t) => [
    uniqueIndex("salaries_player_season_team_idx").on(t.playerId, t.season, t.team),
    index("salaries_season_idx").on(t.season),
  ]
);
