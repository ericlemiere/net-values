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
 * numbers from the model's calibration, not something the page recomputes.
 */
export const WIN_FIT = {
  /** Wins for a team producing zero NVPs: a roster of replacement players. */
  intercept: 15.8,
  winsPerNvp: 2.51,
  r: 0.97,
  teamSeasons: 935,
} as const;

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
