/**
 * What every column in every table means, keyed by the column's `key`.
 *
 * One definition per stat, shared across the pages that show it, so a column
 * can't end up explained two different ways. Where the same key genuinely
 * means different things in different views — `mp` is a per-game average on
 * the Averages table and a season total on Totals — the column passes its own
 * `description` instead and this is the fallback.
 *
 * Definitions say what the number is and, where it isn't obvious, how to read
 * it. They don't editorialise about whether a stat is any good.
 */
export const GLOSSARY: Record<string, string> = {
  // --- identity ---
  pos: "Position",
  age: "Age on February 1 of that season, the league's convention",

  // --- playing time ---
  gp: "Games played",
  gs: "Games started",
  mp: "Minutes played",

  // --- shooting ---
  fgm: "Field goals made",
  fga: "Field goals attempted",
  fgPct: "Field goal percentage",
  fg3m: "Three-pointers made",
  fg3a: "Three-pointers attempted",
  fg3Pct: "Three-point percentage",
  fg2m: "Two-pointers made",
  fg2a: "Two-pointers attempted",
  fg2Pct: "Two-point percentage",
  efgPct:
    "Effective field goal percentage: field goal percentage adjusted so a three counts for its extra point",
  ftm: "Free throws made",
  fta: "Free throws attempted",
  ftPct: "Free throw percentage",

  // --- everything else in the box score ---
  orb: "Offensive rebounds",
  drb: "Defensive rebounds",
  reb: "Total rebounds",
  ast: "Assists",
  stl: "Steals",
  blk: "Blocks",
  tov: "Turnovers",
  pf: "Personal fouls",
  pts: "Points",

  // --- basketball-reference advanced ---
  per: "Player Efficiency Rating. A box-score rating set to a league average of 15. Rewards volume and is largely blind to defence",
  tsPct:
    "True shooting percentage: scoring efficiency counting twos, threes and free throws together",
  usgPct:
    "Usage rate: share of his team's possessions a player finished while on the floor",
  ows: "Offensive win shares — wins credited to a player's offence",
  dws: "Defensive win shares — wins credited to a player's defence",
  ws: "Win shares: an estimate of how many of his team's wins a player produced",
  obpm: "Offensive box plus/minus: estimated offensive points added per 100 possessions vs. a league-average player",
  dbpm: "Defensive box plus/minus. Estimated from the box score, which records little of what defence actually is",
  bpm: "Box plus/minus: estimated points added per 100 possessions vs. a league-average player",
  vorp: "Value over replacement player: box plus/minus scaled by playing time, measured against a bench-level baseline",

  // --- teams ---
  abbr: "Three-letter team abbreviation",
  wins: "Regular season wins",
  losses: "Regular season losses",
  winPct: "Winning percentage",
  srs: "Simple Rating System: average point differential adjusted for strength of schedule. 0 is league average",
  payroll: "Total salary paid to the roster that season",
  payrollPctOfCap:
    "Team payroll as a share of that season's league cap. Above 100% is normal — cap holds, exceptions and luxury tax all push teams over",
  rosterSize: "How many players drew a salary from this team that season",
};

/** The definition for a column, if we have one. */
export function describe(key: string, override?: string): string | undefined {
  return override ?? GLOSSARY[key];
}
