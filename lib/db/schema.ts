import {
  pgTable,
  serial,
  integer,
  text,
  varchar,
  numeric,
  boolean,
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

/**
 * Per-team, per-season record. Kept apart from team_payrolls, which holds the
 * money for the same key — different sources, filled by different scripts.
 *
 * `champion` marks the team that won the title that season, so a season's
 * winner is answerable from this table alone rather than a separate lookup.
 */
export const teamSeasons = pgTable(
  "team_seasons",
  {
    id: serial("id").primaryKey(),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id),
    season: text("season").notNull(),
    wins: integer("wins"),
    losses: integer("losses"),
    // bref's Simple Rating System: point differential adjusted for strength of
    // schedule, in points per game. 0 is league average.
    srs: numeric("srs", { precision: 5, scale: 2, mode: "number" }),
    madePlayoffs: boolean("made_playoffs"),
    champion: boolean("champion").notNull().default(false),
    source: varchar("source", { length: 20 }).notNull(),
  },
  (t) => [
    uniqueIndex("team_seasons_team_season_idx").on(t.teamId, t.season),
    index("team_seasons_season_idx").on(t.season),
  ]
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

// League-wide per-season context. One row per season, replacing what used to be
// a league_cap value duplicated onto every individual salary row.
// Sourced from basketball-reference's salary cap history page (1984-85+).
export const seasons = pgTable("seasons", {
  season: text("season").primaryKey(),
  leagueCap: integer("league_cap"),
  source: varchar("source", { length: 20 }).notNull(),
});

// Per-team, per-season total payroll. Also formerly duplicated onto every
// salary row. For bref-sourced seasons this is the sum of that team's salary
// table; for pre-2011 seasons it was migrated from the legacy Hoopshype data.
export const teamPayrolls = pgTable(
  "team_payrolls",
  {
    id: serial("id").primaryKey(),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id),
    season: text("season").notNull(),
    payroll: integer("payroll"),
    source: varchar("source", { length: 20 }).notNull(),
  },
  (t) => [
    uniqueIndex("team_payrolls_team_season_idx").on(t.teamId, t.season),
    index("team_payrolls_season_idx").on(t.season),
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
    // Actual salary for this player-season-team. bref-sourced from 2011-12 on,
    // legacy Hoopshype before that. Team payroll and league cap live in
    // team_payrolls / seasons; the "% of" figures are computed at query time.
    salary: integer("salary"),
    source: varchar("source", { length: 20 }).notNull().default("sqlite_migration"),
  },
  (t) => [
    uniqueIndex("salaries_player_season_team_idx").on(t.playerId, t.season, t.team),
    index("salaries_season_idx").on(t.season),
  ]
);

/**
 * NBA.com's own advanced numbers, kept separate from `advanced_stats` because
 * that table holds basketball-reference's box-score formulas (PER, WS, BPM,
 * VORP) and these come from a different source with different meaning: these
 * are possession-based, measured rather than estimated from the box score.
 *
 * Only 1996-97 onward — nba.com has no play-by-play before that.
 */
export const nbaAdvanced = pgTable(
  "nba_advanced",
  {
    id: serial("id").primaryKey(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    season: text("season").notNull(),
    team: varchar("team", { length: 3 }),
    gp: integer("gp"),
    minutes: numeric("minutes", { precision: 8, scale: 2, mode: "number" }),
    // Possessions played — the denominator the value model needs.
    poss: integer("poss"),
    offRating: numeric("off_rating", { precision: 6, scale: 2, mode: "number" }),
    defRating: numeric("def_rating", { precision: 6, scale: 2, mode: "number" }),
    netRating: numeric("net_rating", { precision: 6, scale: 2, mode: "number" }),
    // Rate stats are stored 0-100 to match the rest of the schema.
    astPct: numeric("ast_pct", { precision: 6, scale: 2, mode: "number" }),
    // An unbounded ratio — assists with no turnovers has no natural ceiling.
    astTo: numeric("ast_to", { precision: 9, scale: 2, mode: "number" }),
    orebPct: numeric("oreb_pct", { precision: 6, scale: 2, mode: "number" }),
    drebPct: numeric("dreb_pct", { precision: 6, scale: 2, mode: "number" }),
    rebPct: numeric("reb_pct", { precision: 6, scale: 2, mode: "number" }),
    tovPct: numeric("tov_pct", { precision: 6, scale: 2, mode: "number" }),
    efgPct: numeric("efg_pct", { precision: 6, scale: 2, mode: "number" }),
    tsPct: numeric("ts_pct", { precision: 6, scale: 2, mode: "number" }),
    usgPct: numeric("usg_pct", { precision: 6, scale: 2, mode: "number" }),
    pace: numeric("pace", { precision: 6, scale: 2, mode: "number" }),
    pie: numeric("pie", { precision: 6, scale: 3, mode: "number" }),
    source: varchar("source", { length: 20 }).notNull(),
  },
  (t) => [
    uniqueIndex("nba_advanced_player_season_idx").on(t.playerId, t.season),
    index("nba_advanced_season_idx").on(t.season),
  ]
);

/**
 * Net Value: what a player produced, priced in that season's dollars, minus
 * what he was actually paid.
 *
 * Surplus, not a ratio. Dividing production by salary would put every
 * minimum-contract bench player above every star, because a small number over
 * a tiny number is enormous. Subtracting asks the question people actually
 * mean: how much more (or less) was this player worth than he cost?
 *
 * Both sides are priced within the player's own season, so the figure is
 * directly comparable across eras without adjusting for inflation or cap
 * growth. League-wide the column sums to roughly zero, which makes zero mean
 * "paid exactly the going rate" rather than an arbitrary origin.
 *
 * Recomputed wholesale by scraper/compute_net_values.py — never edited in place.
 */
export const netValues = pgTable(
  "net_values",
  {
    id: serial("id").primaryKey(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    season: text("season").notNull(),
    team: varchar("team", { length: 3 }),
    salary: integer("salary"),
    /**
     * Value over replacement (VORP), sourced from Basketball-Reference rather
     * than computed here. NOT wins: fitted against team results over 937 full
     * 82-game team-seasons, one point is worth about 2.2 wins (r = 0.95).
     * Negative production counts as zero.
     */
    production: numeric("production", { precision: 8, scale: 3, mode: "number" }),
    /** Minutes played, the numerator of `availability`. */
    minutes: numeric("minutes", { precision: 8, scale: 1, mode: "number" }),
    /**
     * A full starter's workload that season, in minutes — the denominator of
     * `availability`. Stored rather than recomputed so the explainer shows the
     * same figure the model actually used.
     */
    fullWorkload: numeric("full_workload", { precision: 8, scale: 1, mode: "number" }),
    /**
     * Share of a full starter's workload the player was actually available
     * for, 0-1. Expectation is scaled by this so a missed half-season is
     * charged once (through reduced production) rather than twice.
     */
    availability: numeric("availability", { precision: 5, scale: 3, mode: "number" }),
    /** What his pay bought at the league's going rate, over the time he played. */
    expectedProduction: numeric("expected_production", { precision: 8, scale: 3, mode: "number" }),
    /**
     * The headline figure: production above what his pay bought, in the same
     * VORP units (about 2.2 team wins per point). Zero is paid-the-going-rate;
     * it runs about -7 to +9 across NBA history.
     */
    netValueScore: numeric("net_value_score", { precision: 6, scale: 2, mode: "number" }),
    /** What that production was worth at this season's going rate. */
    valueDollars: numeric("value_dollars", { precision: 14, scale: 2, mode: "number" }),
    netValue: numeric("net_value", { precision: 14, scale: 2, mode: "number" }),
    /** Net value as a share of the season's league cap — the era-neutral view. */
    netValuePctCap: numeric("net_value_pct_cap", { precision: 8, scale: 3, mode: "number" }),
    /** Rank within the season by net value, 1 = best value in the league. */
    seasonRank: integer("season_rank"),
    /** Rank within the season by salary, 1 = highest paid in the league. */
    salaryRank: integer("salary_rank"),
    /**
     * False when the player drew a salary but has no stat row at all. Their
     * net value is then just minus their salary, which is right for a player
     * who never took the floor and wrong for a gap in our data — so the
     * distinction is recorded rather than hidden.
     */
    hasStats: boolean("has_stats").notNull().default(true),
    source: varchar("source", { length: 20 }).notNull(),
  },
  (t) => [
    uniqueIndex("net_values_player_season_idx").on(t.playerId, t.season),
    index("net_values_season_idx").on(t.season),
  ]
);
