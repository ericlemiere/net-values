/**
 * The three views of /stats, and where each one starts.
 *
 * Deliberately NOT in StatTypeToggle.tsx, even though the toggle is the only
 * thing that renders them. That file is a client component, and every export
 * of a "use client" module reaches a server component as a reference proxy
 * rather than the value itself — the page would import DEFAULT_SORT and read
 * `undefined` off it at request time. Types survive the boundary because they
 * are erased before it exists; objects like this one do not, so they belong in
 * a neutral module both sides can import.
 */
export type StatType = "per_game" | "totals" | "advanced";

/** Averages and Totals are two renderings of the same box score; Advanced is a
 *  different table entirely, which is what the sort reset keys off. */
export function isAdvanced(statType: StatType) {
  return statType === "advanced";
}

/**
 * Where each view starts when you arrive without a sort of your own.
 *
 * Averages and Totals share one, because they share their columns. Advanced
 * has none of those columns, so it needs its own or the sort silently falls
 * back to whatever the query defaults to.
 */
export const DEFAULT_SORT: Record<
  StatType,
  { sort: string; dir: "asc" | "desc" }
> = {
  per_game: { sort: "pts", dir: "desc" },
  totals: { sort: "pts", dir: "desc" },
  advanced: { sort: "vorp", dir: "desc" },
};

export function parseStatType(value: string | undefined): StatType {
  if (value === "totals") return "totals";
  if (value === "advanced") return "advanced";
  return "per_game";
}
