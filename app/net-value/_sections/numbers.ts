import {
  AVAILABILITY_FLOOR,
  type getNetValueExamples,
  type NetValueExample,
} from "@/lib/db/queries";

export type Pricing = NonNullable<
  Awaited<ReturnType<typeof getNetValueExamples>>["pricing"]
>;

/**
 * The fit of team wins against team production, quoted on the page. Fixed
 * numbers, not something the page recomputes: each team-season's
 * player_production summed (player_team_splits for traded players) and
 * regressed on its wins, over the full 82-game seasons 1990-91 to 2025-26.
 * Checked 2026-09-29.
 *
 * The sum keeps below-replacement seasons at their real, negative value. The
 * zero floor compute_net_values.py applies is for pricing; fitted against
 * floored totals the line tilts (7.6 + 2.87 per NVP) and the typical miss
 * rises from 2.5 wins to 2.9, because the floor inflates the weakest teams.
 */
export const WIN_FIT = {
  /** Wins for a team producing zero NVPs: a roster of replacement players. */
  intercept: 15.8,
  winsPerNvp: 2.51,
  r: 0.97,
  teamSeasons: 935,
  /** Average gap between predicted and actual wins, and how often it tops 6. */
  typicalMiss: 2.5,
  bigMissShare: "one season in twenty",
} as const;

/**
 * The production model's fixed constants, as the formula box quotes them. They
 * mirror scraper/compute_production.py, which is the source of truth: change
 * one there and it has to change here too.
 */
export const PRODUCTION = {
  replacement: -2.0,
  assistedCreditShare: 0.45,
  perAssist: 0.55,
  perPossessionUsed: 0.1,
  perOffRebound: 0.75,
  perSteal: 1.4,
  perBlock: 0.7,
  perDefRebound: 0.3,
  /** How far the defensive-rebound baseline leans toward his position. */
  drbPositionWeight: 0.75,
  perFoul: -0.4,
  gamma: 0.35,
} as const;

/**
 * The defensive-quality weights, box-score set and tracking set, in the order
 * the table shows them. Also mirrored from compute_production.py.
 */
export const DEFENSE_WEIGHTS: {
  key: string;
  label: string;
  box: number | null;
  tracking: number;
}[] = [
  { key: "stl100", label: "Steals", box: 1.021, tracking: 0.9942 },
  { key: "blk100", label: "Blocks", box: 0.8587, tracking: 0.4999 },
  { key: "drb100", label: "Defensive rebounds", box: 0.6827, tracking: 0.3526 },
  { key: "pf100", label: "Fouls", box: -1.1689, tracking: -0.814 },
  { key: "fg_saved100", label: "Fewer makes allowed", box: null, tracking: 1.1734 },
  { key: "d_fga100", label: "Shots defended", box: null, tracking: -0.0869 },
  { key: "deflections100", label: "Deflections", box: null, tracking: 0.0981 },
  { key: "contested100", label: "Shots contested", box: null, tracking: 0.0643 },
  { key: "loose_balls100", label: "Loose balls recovered", box: null, tracking: 0.1653 },
  { key: "charges100", label: "Charges drawn", box: null, tracking: 0.1176 },
];

/**
 * Every figure the worked example shows, computed once so the overview, the
 * steps and the formula can't disagree with each other.
 *
 * Each intermediate the steps print is derived here from the stored figures
 * rather than read back from the database, which only keeps the final Value
 * Bought. The Season Adjustment is then whatever closes the gap between the
 * two, so step 6 always lands exactly on the stored number.
 */
export function workedExample(hero: NetValueExample, pricing: Pricing) {
  const pricePerNvp = pricing.pool / pricing.produced;
  const chargedShare =
    AVAILABILITY_FLOOR + (1 - AVAILABILITY_FLOOR) * hero.availability;
  const fullSeasonClaim = hero.salary / pricePerNvp;
  const baseBought = fullSeasonClaim * chargedShare;
  return {
    pricePerNvp,
    chargedShare,
    fullSeasonClaim,
    baseBought,
    seasonAdjustment: hero.expectedProduction - baseBought,
    gamesInSeason: Math.round(hero.fullWorkload / 30),
    winsAboveCost: Math.round(hero.netValueScore * WIN_FIT.winsPerNvp),
  };
}

/**
 * NVPs to two decimals. The example's quantities are small enough that one
 * decimal rounds each term separately and leaves the sums visibly wrong:
 * 0.73 + 0.13 = 0.86 renders as "0.7 + 0.1 = 0.9".
 */
export const nvp = (value: number) => value.toFixed(2);

/** Whole dollars with separators: $16,100,800. */
export const dollars = (value: number) =>
  `$${Math.round(value).toLocaleString()}`;
