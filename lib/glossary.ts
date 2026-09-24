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
  per: "Player Efficiency Rating. A box-score rating set to a league average of 15. Rewards volume and is largely blind to defense",
  tsPct:
    "True shooting percentage: scoring efficiency counting twos, threes and free throws together. From nba.com's possession data from 1996-97 on, basketball-reference before that. The two agree to within a rounding error",
  usgPct:
    "Usage rate: share of his team's possessions a player finished while on the floor. From nba.com's counted possessions from 1996-97 on, basketball-reference's pace estimate before that, which runs about half a point higher league-wide",
  ows: "Offensive win shares: wins credited to a player's offense",
  dws: "Defensive win shares: wins credited to a player's defense",
  ws: "Win shares: an estimate of how many of his team's wins a player produced",
  obpm: "Offensive box plus/minus: estimated offensive points added per 100 possessions vs. a league-average player",
  dbpm: "Defensive box plus/minus. Estimated from the box score, which records little of what defense actually is",
  bpm: "Box plus/minus: estimated points added per 100 possessions vs. a league-average player",
  vorp: "Value over replacement player: box plus/minus scaled by playing time, measured against a bench-level baseline",

  // --- nba.com advanced ---
  // Counted from play-by-play rather than estimated from the box score, which
  // is why these start in 1996-97 and read "—" for every season before it.
  poss: "Possessions he was on the floor for, counted from play-by-play",
  offRating:
    "Offensive rating: points his team scored per 100 possessions with him on the floor",
  defRating:
    "Defensive rating: points his team allowed per 100 possessions with him on the floor",
  netRating:
    "Net rating: his team's points scored minus points allowed per 100 possessions with him on the floor",
  astPct:
    "Assist percentage: share of his teammates' field goals he assisted while on the floor",
  astTo: "Assists per turnover",
  orebPct:
    "Offensive rebound percentage: share of available offensive rebounds he took down",
  drebPct:
    "Defensive rebound percentage: share of available defensive rebounds he took down",
  rebPct:
    "Rebound percentage: share of all available rebounds he took down while on the floor",
  tovPct: "Turnover percentage: turnovers per 100 possessions he used",
  pace: "Pace: possessions his team played per 48 minutes with him on the floor",
  pie: "Player Impact Estimate: his share of everything measurable that happened in his games. Roughly 10% is an average starter",

  netValueScore:
    "Production above what his pay bought, given how much of the season he was available. 0 means he was paid the going rate; it runs about -7 to +9, and one NVP is worth about 2.5 team wins.",
  netValue:
    "The same figure in that season's dollars: wins above pay, times what a win cost that year.",
  production:
    "What he produced: his share of the points his team's offense and defense generated above league average, in NVPs. About 2.5 team wins per NVP.",
  expectedProduction:
    "The wins his salary bought at the league's going rate, over the time he was available.",
  availability: "Share of a full starter's workload he actually played.",
  netValueRank:
    "Rank by net value among every player in the league that season. #1 is the best value in the NBA.",
  salaryRank:
    "Rank by salary among every player in the league that season. #1 is the highest paid in the NBA.",
  capAdjustedSalary:
    "What this contract would pay if it were signed now. % of league cap multiplied by the current league cap.",

  // --- teams ---
  abbr: "Three-letter team abbreviation",
  wins: "Regular season wins",
  losses: "Regular season losses",
  winPct: "Winning percentage",
  srs: "Simple Rating System: average point differential adjusted for strength of schedule. 0 is league average",
  payroll: "Total salary paid to the roster that season",
  payrollPctOfCap:
    "Team payroll as a share of that season's league cap. Above 100% is normal: cap holds, exceptions and luxury tax all push teams over",
  rosterSize: "How many players drew a salary from this team that season",
};

/** The definition for a column, if we have one. */
export function describe(key: string, override?: string): string | undefined {
  return override ?? GLOSSARY[key];
}
