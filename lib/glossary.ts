/**
 * What every column in every table means, keyed by the column's `key`.
 *
 * One definition per stat, shared across the pages that show it, so a column
 * can't end up explained two different ways. Where the same key genuinely
 * means different things in different views — `mp` is a per-game average on
 * the Averages table and a season total on Totals — the column passes its own
 * `definition` instead and this is the fallback.
 *
 * Each has a `name`: what the abbreviation stands for, short enough to sit
 * beside it in a list ("REB — Total rebounds"). Where that isn't the whole
 * story, `detail` says the rest: how it's worked out and how to read it. The
 * glossary shows the name and offers the detail behind a "?"; a hover tooltip
 * shows both.
 *
 * Definitions say what the number is and, where it isn't obvious, how to read
 * it. They don't editorialise about whether a stat is any good.
 */
export interface Definition {
  name: string;
  detail?: string;
}

export const GLOSSARY: Record<string, Definition> = {
  // --- identity ---
  pos: { name: "Position" },
  /** The salaries table, where a contract can predate any stat line. */
  posNearest: { name: "Position" },
  age: {
    name: "Age",
    detail: "Age on February 1 of that season, the league's convention.",
  },

  // --- pay ---
  salary: { name: "What he was paid that season" },
  /** A player's own page, where a season is one row whatever the teams. */
  salarySeasonTotal: {
    name: "Everything he was paid that season",
    detail:
      "Where a contract was bought out, that is the old team's money plus the new team's added together.",
  },
  teamPayroll: { name: "His team's total payroll that season" },
  pctOfTeamCap: { name: "His salary as a share of his team's payroll" },
  leagueCap: {
    name: "The league's salary cap that season",
    detail: "A ~ marks a projection, for a season the league hasn't set yet.",
  },
  pctOfLeagueCap: {
    name: "His salary as a share of the league cap",
    detail:
      "Compares pay across eras, since the cap has grown many times over.",
  },

  // --- playing time ---
  gp: { name: "Games played" },
  gs: { name: "Games started" },
  mp: { name: "Minutes played" },

  // --- shooting ---
  fgm: { name: "Field goals made" },
  fga: { name: "Field goals attempted" },
  fgPct: { name: "Field goal percentage" },
  fg3m: { name: "Three-pointers made" },
  fg3a: { name: "Three-pointers attempted" },
  fg3Pct: { name: "Three-point percentage" },
  fg2m: { name: "Two-pointers made" },
  fg2a: { name: "Two-pointers attempted" },
  fg2Pct: { name: "Two-point percentage" },
  efgPct: { name: "Effective field goal percentage" },
  ftm: { name: "Free throws made" },
  fta: { name: "Free throws attempted" },
  ftPct: { name: "Free throw percentage" },

  // --- everything else in the box score ---
  orb: { name: "Offensive rebounds" },
  drb: { name: "Defensive rebounds" },
  reb: { name: "Total rebounds" },
  ast: { name: "Assists" },
  stl: { name: "Steals" },
  blk: { name: "Blocks" },
  tov: { name: "Turnovers" },
  pf: { name: "Personal fouls" },
  pts: { name: "Points" },

  // --- basketball-reference advanced ---
  per: {
    name: "Player Efficiency Rating",
    detail:
      "A box-score rating set to a league average of 15. Rewards volume and is largely blind to defense.",
  },
  tsPct: {
    name: "True shooting percentage",
    detail:
      "Scoring efficiency counting twos, threes and free throws together. From nba.com's possession data from 1996-97 on, basketball-reference before that. The two agree to within a rounding error.",
  },
  usgPct: {
    name: "Usage rate",
    detail:
      "Share of his team's possessions a player finished while on the floor. From nba.com's counted possessions from 1996-97 on, basketball-reference's pace estimate before that, which runs about half a point higher league-wide.",
  },
  ows: {
    name: "Offensive win shares",
    detail: "Wins credited to a player's offense.",
  },
  dws: {
    name: "Defensive win shares",
    detail: "Wins credited to a player's defense.",
  },
  ws: {
    name: "Win shares",
    detail: "An estimate of how many of his team's wins a player produced.",
  },
  obpm: {
    name: "Offensive box plus/minus",
    detail:
      "Estimated offensive points added per 100 possessions vs. a league-average player.",
  },
  dbpm: {
    name: "Defensive box plus/minus",
    detail:
      "Estimated from the box score, which records little of what defense actually is.",
  },
  bpm: {
    name: "Box plus/minus",
    detail:
      "Estimated points added per 100 possessions vs. a league-average player.",
  },
  vorp: {
    name: "Value over replacement player",
    detail:
      "Box plus/minus scaled by playing time, measured against a bench-level baseline.",
  },

  // --- nba.com advanced ---
  // Counted from play-by-play rather than estimated from the box score, which
  // is why these start in 1996-97 and read "—" for every season before it.
  poss: {
    name: "Possessions",
    detail: "Possessions he was on the floor for, counted from play-by-play.",
  },
  offRating: {
    name: "Offensive rating",
    detail: "Points his team scored per 100 possessions with him on the floor.",
  },
  defRating: {
    name: "Defensive rating",
    detail:
      "Points his team allowed per 100 possessions with him on the floor.",
  },
  netRating: {
    name: "Net rating",
    detail:
      "His team's points scored minus points allowed per 100 possessions with him on the floor.",
  },
  astPct: {
    name: "Assist percentage",
    detail:
      "Share of his teammates' field goals he assisted while on the floor.",
  },
  astTo: { name: "Assists per turnover" },
  orebPct: {
    name: "Offensive rebound percentage",
    detail: "Share of available offensive rebounds he took down.",
  },
  drebPct: {
    name: "Defensive rebound percentage",
    detail: "Share of available defensive rebounds he took down.",
  },
  rebPct: {
    name: "Rebound percentage",
    detail: "Share of all available rebounds he took down while on the floor.",
  },
  tovPct: {
    name: "Turnover percentage",
    detail: "Turnovers per 100 possessions he used.",
  },
  pace: {
    name: "Pace",
    detail: "Possessions his team played per 48 minutes with him on the floor.",
  },
  pie: {
    name: "Player Impact Estimate",
    detail:
      "His share of everything measurable that happened in his games. Roughly 10% is an average starter.",
  },

  // --- net value ---
  netValueScore: {
    name: "Production above what his pay bought, in NVPs",
    detail:
      "Given how much of the season he was available. 0 means he was paid the going rate; it runs about -7 to +9, and one NVP is worth about 2.5 team wins.",
  },
  netValue: {
    name: "Net Value in that season's dollars",
    detail: "Wins above pay, times what a win cost that year.",
  },
  production: {
    name: "What he produced, in NVPs",
    detail:
      "His share of the points his team's offense and defense generated above league average. About 2.5 team wins per NVP.",
  },
  expectedProduction: {
    name: "What his salary bought",
    detail:
      "The wins his salary bought at the league's going rate, over the time he was available.",
  },
  /** The explainer's worked example, in its own vocabulary. */
  valueProduced: {
    name: "Value Produced, in NVPs",
    detail:
      "His share of the points his team's offense and defense generated above league average, counted up from replacement level.",
  },
  valueBought: {
    name: "Value Bought, in NVPs",
    detail:
      "What his salary bought at that season's going rate, scaled by his Charged Share.",
  },
  availability: { name: "Share of a full starter's workload he played" },
  netValueRank: {
    name: "Net Value rank that season",
    detail:
      "Rank by Net Value among every player in the league that season. #1 is the best value in the NBA.",
  },
  salaryRank: {
    name: "Salary rank that season",
    detail:
      "Rank by salary among every player in the league that season. #1 is the highest paid in the NBA.",
  },
  capAdjustedSalary: {
    name: "What this contract would pay if signed now",
    detail:
      "Its percentage of the league cap multiplied by today's league cap.",
  },
  deservedSalary: {
    name: "What his production was worth that season",
    detail:
      "What the league paid for this much basketball that season: rank every player by production, then read off the salary sitting at the same rank on the pay ladder. The fourth most productive player is worth whatever the fourth highest-paid player earned. Players tied on production split the difference: each gets the average salary of the rungs their tie covers.",
  },
  /** The salaries table, one row per contract rather than per season. */
  payDifferenceContract: {
    name: "Deserved pay minus actual pay",
    detail:
      "For the whole season. Blank on a contract that was only part of one — a season split between two teams is one player-season on the production side, and there is no honest way to charge a share of the gap to one team's books. The player's own page shows the season whole.",
  },
  payDifference: {
    name: "Deserved pay minus actual pay",
    detail:
      "Green is money left on the table, red is money overspent; anything inside 5% of that season's cap is close enough to read as plain. A season split between two teams is compared whole.",
  },

  // --- teams ---
  abbr: { name: "Three-letter team abbreviation" },
  wins: { name: "Regular season wins" },
  losses: { name: "Regular season losses" },
  winPct: { name: "Winning percentage" },
  srs: {
    name: "Simple Rating System",
    detail:
      "Average point differential adjusted for strength of schedule. 0 is league average.",
  },
  payroll: { name: "Total salary paid to the roster that season" },
  payrollPctOfCap: {
    name: "Team payroll as a share of the league cap",
    detail:
      "Above 100% is normal: cap holds, exceptions and luxury tax all push teams over.",
  },
  rosterSize: { name: "Players who drew a salary from this team" },
  madePlayoffs: { name: "Whether the team reached the playoffs" },
  teamNetValueRank: { name: "Team Net Value rank among the league's teams" },
  netValueShare: {
    name: "This team's share of his Net Value",
    detail:
      "On a bought-out contract it is the charge alone, since the production went to whoever he played for.",
  },
  teamNetValue: {
    name: "The roster's Net Value added up, in NVPs",
    detail:
      "A sum rather than an average: Net Value is additive in wins, so this says how many wins the roster returned above what it cost. Only players on a full contract count.",
  },
};

/**
 * A counting stat's definition with the basis it's shown on. The same `pts`
 * column is a per-game average on one table and a season total on another.
 */
export function withBasis(
  key: string,
  basis: "per_game" | "totals",
): Definition {
  const def = GLOSSARY[key] ?? { name: "" };
  return {
    ...def,
    name: `${def.name}, ${basis === "totals" ? "season total" : "per game"}`,
  };
}

/** The definition for a column, if we have one. */
export function describe(
  key: string,
  override?: Definition,
): Definition | undefined {
  return override ?? GLOSSARY[key];
}

/** A definition as one line of text, for a hover tooltip. */
export function tooltip(def: Definition | undefined): string | undefined {
  if (!def) return undefined;
  return def.detail ? `${def.name}. ${def.detail}` : def.name;
}

export interface GlossaryEntry extends Definition {
  key: string;
  label: string;
}

/**
 * A table's glossary: every column that has a definition, in column order.
 * Columns with none (Name, Team, Season) explain themselves and are left out,
 * the same way they carry no tooltip on a hover screen.
 */
export function glossaryFor(
  columns: { key: string; label: string; definition?: Definition }[],
): GlossaryEntry[] {
  return columns.flatMap((col) => {
    const def = describe(col.key, col.definition);
    return def ? [{ key: col.key, label: col.label, ...def }] : [];
  });
}
