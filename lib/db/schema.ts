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
const stat = (name: string) =>
  numeric(name, { precision: 8, scale: 2, mode: "number" });

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
  (t) => [uniqueIndex("team_aliases_alias_idx").on(t.alias)],
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
  ],
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
  (t) => [uniqueIndex("player_aliases_alias_idx").on(t.alias)],
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
    uniqueIndex("player_stats_totals_player_season_idx").on(
      t.playerId,
      t.season,
    ),
    index("player_stats_totals_season_idx").on(t.season),
  ],
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
    uniqueIndex("player_stats_per_game_player_season_idx").on(
      t.playerId,
      t.season,
    ),
    index("player_stats_per_game_season_idx").on(t.season),
  ],
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
  ],
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
  ],
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
    source: varchar("source", { length: 20 })
      .notNull()
      .default("sqlite_migration"),
  },
  (t) => [
    uniqueIndex("salaries_player_season_team_idx").on(
      t.playerId,
      t.season,
      t.team,
    ),
    index("salaries_season_idx").on(t.season),
  ],
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
    offRating: numeric("off_rating", {
      precision: 6,
      scale: 2,
      mode: "number",
    }),
    defRating: numeric("def_rating", {
      precision: 6,
      scale: 2,
      mode: "number",
    }),
    netRating: numeric("net_rating", {
      precision: 6,
      scale: 2,
      mode: "number",
    }),
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
  ],
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
     * What the player produced, from `player_production` — his share of the
     * points his team's offense and defense actually generated above league
     * average. NOT wins: fitted against team results, one point is worth about
     * 2.2 wins. Negative production counts as zero.
     */
    production: numeric("production", {
      precision: 8,
      scale: 3,
      mode: "number",
    }),
    /** Minutes played, the numerator of `availability`. */
    minutes: numeric("minutes", { precision: 8, scale: 1, mode: "number" }),
    /**
     * A full starter's workload that season, in minutes — the denominator of
     * `availability`. Stored rather than recomputed so the explainer shows the
     * same figure the model actually used.
     */
    fullWorkload: numeric("full_workload", {
      precision: 8,
      scale: 1,
      mode: "number",
    }),
    /**
     * Share of a full starter's workload the player was actually available
     * for, 0-1. Expectation is scaled by this so a missed half-season is
     * charged once (through reduced production) rather than twice.
     */
    availability: numeric("availability", {
      precision: 5,
      scale: 3,
      mode: "number",
    }),
    /** What his pay bought at the league's going rate, over the time he played. */
    expectedProduction: numeric("expected_production", {
      precision: 8,
      scale: 3,
      mode: "number",
    }),
    /**
     * The headline figure: production above what his pay bought (about 2.2 team
     * wins per NVP). Zero is paid-the-going-rate; it runs about -7 to +9
     * across NBA history.
     */
    netValueScore: numeric("net_value_score", {
      precision: 6,
      scale: 2,
      mode: "number",
    }),
    /** What that production was worth at this season's going rate. */
    valueDollars: numeric("value_dollars", {
      precision: 14,
      scale: 2,
      mode: "number",
    }),
    netValue: numeric("net_value", { precision: 14, scale: 2, mode: "number" }),
    /** Net value as a share of the season's league cap — the era-neutral view. */
    netValuePctCap: numeric("net_value_pct_cap", {
      precision: 8,
      scale: 3,
      mode: "number",
    }),
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

    /**
     * The same arithmetic on basketball-reference's VORP, which is what
     * production used to mean here. Kept for comparison, wired to nothing.
     *
     * VORP sees defense through steals, blocks and defensive rebounds, which
     * describes a rim protector poorly and a wing not at all: Rudy Gobert's
     * 2023-24, anchoring the league's best defense, priced 464th of 486 on it.
     * The replacement starts from what each team's offense and defense actually
     * did and splits that between the players, and beats VORP against team wins
     * (r = 0.967 against 0.956, and 0.925 against 0.900 on year-over-year
     * change) and on All-NBA, MVP and DPOY voting.
     *
     * These columns only refresh while advanced_stats keeps being filled from
     * bref. Nothing else in the pipeline needs that any more, so if that
     * backfill stops they will quietly go stale rather than go missing.
     */
    productionVorp: numeric("production_vorp", {
      precision: 8,
      scale: 3,
      mode: "number",
    }),
    expectedProductionVorp: numeric("expected_production_vorp", {
      precision: 8,
      scale: 3,
      mode: "number",
    }),
    netValueScoreVorp: numeric("net_value_score_vorp", {
      precision: 6,
      scale: 2,
      mode: "number",
    }),
    netValueVorp: numeric("net_value_vorp", {
      precision: 14,
      scale: 2,
      mode: "number",
    }),
    seasonRankVorp: integer("season_rank_vorp"),
  },
  (t) => [
    uniqueIndex("net_values_player_season_idx").on(t.playerId, t.season),
    index("net_values_season_idx").on(t.season),
  ],
);

/**
 * One net_values row split across the teams that actually paid for it.
 *
 * A bought-out player is on two teams' books at once: the team that waived him
 * still owes the contract, and the team he signed with pays the rest. Charging
 * the whole thing to either one is wrong — the old team's mistake would land on
 * the new team's ledger, or a real cost would vanish. So the charge is
 * apportioned by what each team actually paid, while the production is credited
 * to the one team he played for.
 *
 * Deandre Ayton, 2025-26: Portland owed $25.6M after waiving him, the Lakers
 * paid $8.1M and got all 72 games.
 *
 *     LAL   0.60 production  -  24% of the charge  =  +0.10
 *     POR   0.00 production  -  76% of the charge  =  -1.57
 *                                                     -----
 *     his net_value_score                             -1.47
 *
 * The rows for a player-season always sum back to his `net_values` score, which
 * is what keeps team totals from double-counting or losing a dollar. Written by
 * the same pass that writes net_values, and truncated with it.
 */
export const netValueShares = pgTable(
  "net_value_shares",
  {
    id: serial("id").primaryKey(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    season: text("season").notNull(),
    team: varchar("team", { length: 3 }).notNull(),
    /**
     * What this team paid him this season. Zero on the rare row that exists
     * only to carry production: a player whose stat line names a team our
     * salary data has no contract for, which happens mid-season while a trade
     * is still settling on the source pages.
     */
    salary: integer("salary"),
    /** His full season production, on the one team he played for. Else zero. */
    productionCredit: numeric("production_credit", {
      precision: 8,
      scale: 3,
      mode: "number",
    }),
    /** This team's share of what his pay was expected to buy. */
    charge: numeric("charge", { precision: 8, scale: 3, mode: "number" }),
    /** `productionCredit - charge` — this team's piece of his net value. */
    score: numeric("score", { precision: 6, scale: 2, mode: "number" }),
    /** True on the team whose uniform he actually wore. */
    playedHere: boolean("played_here").notNull(),
    source: varchar("source", { length: 20 }).notNull(),
    /** `score` under the old VORP model — see net_values.netValueScoreVorp. */
    scoreVorp: numeric("score_vorp", {
      precision: 6,
      scale: 2,
      mode: "number",
    }),
  },
  (t) => [
    uniqueIndex("net_value_shares_player_season_team_idx").on(
      t.playerId,
      t.season,
      t.team,
    ),
    index("net_value_shares_season_team_idx").on(t.season, t.team),
  ],
);

/**
 * What a franchise was called, and when.
 *
 * `teams` holds one canonical row per franchise, which is what every other
 * table's `team` column refers to and what URLs are built from. That is the
 * right key — a franchise is one continuous thing — but it is the wrong label
 * for a season it played under another name. Seattle's 1995-96 team reads as
 * "Oklahoma City Thunder" without this, and Vancouver's as Memphis.
 *
 * One row per identity, so a franchise that changed twice has three. Keyed by
 * season range rather than by alias, which is what `team_aliases` does and why
 * that table can't serve this: it maps a code to a franchise with no notion of
 * when the code was current, it can't hold NOH's two disjoint spells either
 * side of the Katrina years, and it has no entry at all for a rename that kept
 * the same code — Charlotte was the Bobcats from 2004-05 to 2013-14 under the
 * abbreviation it still uses.
 *
 * Only franchises that actually changed identity within the data are listed.
 * Everyone else falls back to `teams`, so this stays at the handful of rows it
 * describes rather than restating all thirty.
 *
 * Deliberately NOT here: BRK, CHO, PHO, SAN and UTH. Those are
 * basketball-reference's spelling of a code that is current, not a name the
 * franchise ever went by, and showing them as history would be a fiction.
 */
export const teamIdentities = pgTable(
  "team_identities",
  {
    id: serial("id").primaryKey(),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id),
    /** The abbreviation in use then — SEA, VAN, WSB, NJN, CHH, NOH, NOK. */
    abbr: varchar("abbr", { length: 3 }).notNull(),
    name: text("name").notNull(),
    firstSeason: text("first_season").notNull(),
    /** Null while the identity is the current one, so it needs no yearly edit. */
    lastSeason: text("last_season"),
    source: varchar("source", { length: 20 }).notNull(),
  },
  (t) => [
    uniqueIndex("team_identities_team_first_idx").on(t.teamId, t.firstSeason),
    index("team_identities_team_idx").on(t.teamId),
  ],
);

/**
 * Individual awards, one row per player-season-award.
 *
 * Runners-up are kept, not just winners — `won` is what separates them. That
 * costs almost nothing (a season's MVP ballot is a dozen rows) and is what
 * lets the awards page show a real voting result instead of a bare name, and
 * lets a player page say he finished third rather than say nothing at all.
 *
 * Two sources feed this, because neither covers everything:
 *
 *   bref  — the five voted awards and the All-NBA/All-Defensive teams, from
 *           one page per season. Carries the vote columns.
 *   nba   — All-Star selections. basketball-reference's all-star page is the
 *           GAME BOX SCORE, so a player selected and then scratched (Embiid in
 *           2023-24) simply isn't on it. nba.com's award list has the
 *           selection itself, which is the thing being badged.
 *
 * `award` is the short code the UI badges with, so the two sources have to
 * agree on spelling before they land here — see AWARD_CODES in the backfill.
 */
export const playerAwards = pgTable(
  "player_awards",
  {
    id: serial("id").primaryKey(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    season: text("season").notNull(),
    /** mvp | roy | dpoy | smoy | mip | all_star | all_nba | all_defense | all_rookie */
    award: varchar("award", { length: 12 }).notNull(),
    /**
     * Which team he made, for the awards that pick three of them: 1, 2 or 3.
     * Null on the single-winner awards and on All-Star, which has no tiers.
     */
    teamNumber: integer("team_number"),
    /** False on a losing ballot line. All-Star and the team awards are always true. */
    won: boolean("won").notNull(),
    /** Where he finished in the voting. Null where the award isn't voted in ranks. */
    rank: integer("rank"),
    /** bref's `award_share`: points won as a fraction of the maximum possible. */
    share: numeric("share", { precision: 5, scale: 3, mode: "number" }),
    pointsWon: numeric("points_won", {
      precision: 8,
      scale: 1,
      mode: "number",
    }),
    pointsMax: numeric("points_max", {
      precision: 8,
      scale: 1,
      mode: "number",
    }),
    votesFirst: integer("votes_first"),
    source: varchar("source", { length: 20 }).notNull(),
  },
  (t) => [
    uniqueIndex("player_awards_player_season_award_idx").on(
      t.playerId,
      t.season,
      t.award,
    ),
    index("player_awards_season_idx").on(t.season),
    index("player_awards_player_idx").on(t.playerId),
  ],
);

/**
 * Team offensive and defensive rating per season, computed from nba_api's
 * game logs rather than taken from anyone's summary page.
 *
 * Every regular season game appears in `leaguegamelog` twice, once per team, so
 * joining the two rows on GAME_ID gives each team its own box score AND its
 * opponent's. That is what makes possessions and both ratings computable here:
 * possessions need the opponent's misses and turnovers, and a defensive rating
 * is by definition what the opponent did.
 *
 * Coverage is 1990-91 onward, which matters because it is six seasons deeper
 * than nba.com's per-player advanced data. The endpoint returns nothing at all
 * before 1996-97 for the leaguedash* family — every measure type, verified —
 * so game logs are the only nba_api route into the early 90s, and they are what
 * lets Jordan's era be priced on the same formula as Wembanyama's.
 *
 * `poss` is the standard estimate averaged over both teams, which is what
 * nba.com itself reports and is within ~0.6 points per 100 of nba.com's own
 * figures across the 842 seasons where both exist (r = 0.995).
 */
export const teamSeasonRatings = pgTable(
  "team_season_ratings",
  {
    id: serial("id").primaryKey(),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id),
    season: text("season").notNull(),
    gp: integer("gp"),
    /** Possessions, estimated per game and summed — not minutes. */
    poss: numeric("poss", { precision: 10, scale: 1, mode: "number" }),
    pts: integer("pts"),
    oppPts: integer("opp_pts"),
    /** Points scored per 100 possessions. */
    offRating: numeric("off_rating", {
      precision: 6,
      scale: 2,
      mode: "number",
    }),
    /** Points allowed per 100 possessions. */
    defRating: numeric("def_rating", {
      precision: 6,
      scale: 2,
      mode: "number",
    }),
    netRating: numeric("net_rating", {
      precision: 6,
      scale: 2,
      mode: "number",
    }),
    source: varchar("source", { length: 20 }).notNull(),
  },
  (t) => [
    uniqueIndex("team_season_ratings_team_season_idx").on(t.teamId, t.season),
    index("team_season_ratings_season_idx").on(t.season),
  ],
);

/**
 * How a player's own baskets came about — nba_api's "Scoring" measure type.
 *
 * The one column the production model genuinely needs is `pctAstFgm`: the share
 * of a player's made field goals that someone else assisted. Without it, credit
 * for a dunk off a lob lands entirely on the finisher, and centers who shoot
 * 70% on shots created for them price out as offensive stars. Weighting the
 * efficiency credit by how much of it the player generated himself is what
 * separates a rim-runner from a shot creator, and no box score can do it.
 *
 * The points splits are not used by the model and are kept because they cost
 * nothing extra on the same request and are the natural thing to show on a
 * player page.
 *
 * 1996-97 onward, like everything from the leaguedash* family.
 */
export const playerScoringSplits = pgTable(
  "player_scoring_splits",
  {
    id: serial("id").primaryKey(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    season: text("season").notNull(),
    team: varchar("team", { length: 3 }),
    /** Share of made field goals that were assisted, 0-100. */
    pctAstFgm: numeric("pct_ast_fgm", {
      precision: 5,
      scale: 2,
      mode: "number",
    }),
    pctPtsPaint: numeric("pct_pts_paint", {
      precision: 5,
      scale: 2,
      mode: "number",
    }),
    pctPts3pt: numeric("pct_pts_3pt", {
      precision: 5,
      scale: 2,
      mode: "number",
    }),
    pctPtsFt: numeric("pct_pts_ft", { precision: 5, scale: 2, mode: "number" }),
    pctPtsFb: numeric("pct_pts_fb", { precision: 5, scale: 2, mode: "number" }),
    source: varchar("source", { length: 20 }).notNull(),
  },
  (t) => [
    uniqueIndex("player_scoring_splits_player_season_idx").on(
      t.playerId,
      t.season,
    ),
    index("player_scoring_splits_season_idx").on(t.season),
  ],
);

/**
 * Tracking-camera defense: what a player did that no box score records.
 *
 * Two endpoints with different start dates feed this, which is why the columns
 * are nullable in blocks rather than all-or-nothing:
 *
 *   leaguedashptdefend    2013-14+   shots defended, and what the shooters
 *                                    normally shoot, so the model can ask how
 *                                    many baskets a defender actually prevented
 *   leaguehustlestatsplayer 2015-16+ deflections, contested shots, loose balls,
 *                                    charges drawn
 *
 * This is the only data that sees a perimeter defender. Tested against 36
 * seasons of All-Defensive voting, a model on box stats alone identifies those
 * selections at AUC 0.866; adding these columns takes it to 0.915, and it moves
 * Draymond Green from the 67th percentile of defenders to the 98th, which is
 * roughly where anyone who watched those teams would put him.
 *
 * It is deliberately used ONLY to weight the split of a team's defensive
 * performance between its own players, never to change the size of what is
 * being split. That keeps a 1994 season and a 2024 season on one scale even
 * though only one of them has cameras.
 */
export const playerTrackingDefense = pgTable(
  "player_tracking_defense",
  {
    id: serial("id").primaryKey(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    season: text("season").notNull(),
    team: varchar("team", { length: 3 }),
    /** Shots taken by the man this player was defending. */
    dFga: integer("d_fga"),
    dFgm: integer("d_fgm"),
    /** What those shooters shot when defended by him, 0-100. */
    dFgPct: numeric("d_fg_pct", { precision: 5, scale: 2, mode: "number" }),
    /** What those same shooters shoot normally, 0-100 — the comparison. */
    normalFgPct: numeric("normal_fg_pct", {
      precision: 5,
      scale: 2,
      mode: "number",
    }),
    deflections: numeric("deflections", {
      precision: 7,
      scale: 1,
      mode: "number",
    }),
    contestedShots: numeric("contested_shots", {
      precision: 7,
      scale: 1,
      mode: "number",
    }),
    looseBallsRecovered: numeric("loose_balls_recovered", {
      precision: 7,
      scale: 1,
      mode: "number",
    }),
    chargesDrawn: numeric("charges_drawn", {
      precision: 7,
      scale: 1,
      mode: "number",
    }),
    source: varchar("source", { length: 20 }).notNull(),
  },
  (t) => [
    uniqueIndex("player_tracking_defense_player_season_idx").on(
      t.playerId,
      t.season,
    ),
    index("player_tracking_defense_season_idx").on(t.season),
  ],
);

/**
 * What a player produced, in points above a league-average player, split into
 * the offensive and defensive halves that produced it.
 *
 * This replaces basketball-reference's VORP as the production input to Net
 * Value, and it is built the other way round from a box-score metric. A box
 * metric estimates a player from his own counting stats and hopes the team adds
 * up; this starts from what the team demonstrably did — its offensive and
 * defensive points above league average, from `team_season_ratings` — and
 * divides that between the players. The total is therefore never wrong, and
 * the modeling problem is reduced to the split.
 *
 * Offense splits by box credit, which the box score is good at: shooting
 * efficiency above league average on the player's own volume (weighted down by
 * how much of it was created for him), playmaking, turnovers, offensive boards.
 *
 * Defense splits by minutes, tilted by a defensive-quality score fitted to 36
 * seasons of All-Defensive voting. Minutes carry most of the weight on purpose:
 * team defense is a team activity, and the box score's defensive columns
 * describe a rim protector well and a perimeter defender not at all. Where
 * tracking data exists the tilt gets much sharper — see `player_tracking_defense`.
 *
 * `production` is scaled to be read like VORP, so the numbers stay familiar and
 * the Net Value pricing needs no re-tuning: replacement level is -2.0 points per
 * 100 possessions, and the figure is multiplied by the share of the team's floor
 * time the player was on for and by the season's length. Summed over a roster it
 * comes to the team's net rating plus 10.
 *
 * Validated against team wins over 1,056 team-seasons: r = 0.967 at level and
 * 0.924 on year-over-year change, against 0.954 and 0.904 for VORP.
 *
 * Recomputed wholesale by scraper/compute_production.py — never edited in place.
 */
export const playerProduction = pgTable(
  "player_production",
  {
    id: serial("id").primaryKey(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    season: text("season").notNull(),
    team: varchar("team", { length: 3 }),
    minutes: numeric("minutes", { precision: 8, scale: 1, mode: "number" }),
    /** Share of the team's total floor time this player was on for, 0-1. */
    floorShare: numeric("floor_share", {
      precision: 6,
      scale: 5,
      mode: "number",
    }),
    /** Points above league average, offense and defense, over the whole season. */
    offPoints: numeric("off_points", {
      precision: 8,
      scale: 2,
      mode: "number",
    }),
    defPoints: numeric("def_points", {
      precision: 8,
      scale: 2,
      mode: "number",
    }),
    /** The same three figures as a rate, per 100 possessions played. */
    offPer100: numeric("off_per100", {
      precision: 6,
      scale: 2,
      mode: "number",
    }),
    defPer100: numeric("def_per100", {
      precision: 6,
      scale: 2,
      mode: "number",
    }),
    impactPer100: numeric("impact_per100", {
      precision: 6,
      scale: 2,
      mode: "number",
    }),
    /**
     * Defensive quality as a within-season z-score — the tilt applied to this
     * player's share of the team's defense. Worth storing separately because it
     * is the one number here that answers "who defended well", independently of
     * how much he played or how good his team was.
     */
    defQuality: numeric("def_quality", {
      precision: 6,
      scale: 3,
      mode: "number",
    }),
    /** True where tracking data was available to inform `defQuality`. */
    defTracked: boolean("def_tracked").notNull().default(false),
    /** The headline figure, on VORP's scale. */
    production: numeric("production", {
      precision: 8,
      scale: 3,
      mode: "number",
    }),
    /**
     * 'team_anchored' normally. 'league_average' for the handful of pre-1997
     * multi-team seasons whose stat line names no team, which therefore get no
     * share of any team's surplus and are credited on their own box line alone.
     */
    source: varchar("source", { length: 20 }).notNull(),
  },
  (t) => [
    uniqueIndex("player_production_player_season_idx").on(t.playerId, t.season),
    index("player_production_season_idx").on(t.season),
  ],
);
