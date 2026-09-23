/**
 * The award vocabulary, shared by the badges, the awards page and the backfill.
 *
 * `rank` is the only thing here that is a judgement call: it decides which
 * single badge a table row keeps when there isn't room for all of them, and it
 * runs from the scarcest honour to the most common. One MVP a year outranks
 * three All-NBA teams, which outrank two dozen All-Star selections.
 */
export const AWARDS = {
  mvp: { label: "MVP", full: "Most Valuable Player", rank: 1, tiered: false, path: "/mvp" },
  dpoy: { label: "DPOY", full: "Defensive Player of the Year", rank: 2, tiered: false, path: "/dpoy" },
  roy: { label: "ROY", full: "Rookie of the Year", rank: 3, tiered: false, path: "/roy" },
  smoy: { label: "6MOY", full: "Sixth Man of the Year", rank: 4, tiered: false, path: "/6moy" },
  mip: { label: "MIP", full: "Most Improved Player", rank: 5, tiered: false, path: "/mip" },
  all_nba: { label: "All-NBA", full: "All-NBA Team", rank: 6, tiered: true, path: null },
  all_defense: { label: "All-Def", full: "All-Defensive Team", rank: 7, tiered: true, path: null },
  all_star: { label: "★", full: "All-Star", rank: 8, tiered: false, path: null },
  all_rookie: { label: "All-Rk", full: "All-Rookie Team", rank: 9, tiered: true, path: null },
} as const;

/** The awards that have a page of their own, in nav order. */
export const AWARD_PAGES = (Object.keys(AWARDS) as AwardCode[])
  .filter((code) => AWARDS[code].path !== null)
  .sort((a, b) => AWARDS[a].rank - AWARDS[b].rank);

/** The id its section carries on the seasons page. */
export function anchorId(award: AwardCode) {
  return `award-${award}`;
}

/**
 * Where a badge goes when you click it.
 *
 * An award with one winner a year has a history worth a page — every MVP ever,
 * in one list. The team awards and All-Star don't: a list of every All-NBA
 * selection is five hundred rows that say little, and what you actually want
 * after seeing the badge is the rest of that season. So those point at the
 * season snapshot, anchored to their own section.
 */
export function awardHref(award: AwardCode, season: string) {
  const { path } = AWARDS[award];
  return path ?? `/seasons?season=${encodeURIComponent(season)}#${anchorId(award)}`;
}

export type AwardCode = keyof typeof AWARDS;

/** The order awards are listed in, scarcest first. */
export const AWARD_ORDER = (Object.keys(AWARDS) as AwardCode[]).sort(
  (a, b) => AWARDS[a].rank - AWARDS[b].rank,
);

export function isAwardCode(value: string): value is AwardCode {
  return value in AWARDS;
}

/** "1st"/"2nd"/"3rd" for the team awards; empty for the rest. */
export function teamOrdinal(teamNumber: number | null) {
  if (teamNumber === 1) return "1st";
  if (teamNumber === 2) return "2nd";
  if (teamNumber === 3) return "3rd";
  return "";
}

export interface Award {
  award: AwardCode;
  season: string;
  teamNumber: number | null;
}

/**
 * The key a badge lookup is read back with.
 *
 * Lives here rather than beside the query that builds the map, because the
 * comps table is a client component and reads it: importing a value — as
 * opposed to a type — from the queries module pulls the database client into
 * the browser bundle, where `neon()` finds no connection string and throws on
 * module evaluation.
 */
export function awardKey(playerId: number, season: string) {
  return `${playerId}|${season}`;
}

/**
 * The badge text for one award: "MVP", "All-NBA 1st", "★".
 *
 * A tier is part of the name rather than a detail, because All-NBA First Team
 * and All-NBA Third Team are different honours and a badge that flattened them
 * would be saying something untrue.
 */
export function badgeLabel(award: AwardCode, teamNumber: number | null) {
  const { label, tiered } = AWARDS[award];
  const ordinal = tiered ? teamOrdinal(teamNumber) : "";
  return ordinal ? `${label} ${ordinal}` : label;
}

/** The same thing spelled out, for a tooltip or the awards page. */
export function fullLabel(award: AwardCode, teamNumber: number | null) {
  const { full, tiered } = AWARDS[award];
  const ordinal = tiered ? teamOrdinal(teamNumber) : "";
  return ordinal ? `${ordinal} Team ${full.replace(" Team", "")}` : full;
}

/** Scarcest first, so the one a cramped row keeps is the one worth keeping. */
export function sortAwards<T extends { award: AwardCode; teamNumber: number | null }>(
  list: T[],
) {
  return [...list].sort(
    (a, b) =>
      AWARDS[a.award].rank - AWARDS[b.award].rank ||
      (a.teamNumber ?? 0) - (b.teamNumber ?? 0),
  );
}
