/**
 * The stats /price-check can divide a salary by, and the URL it keeps its
 * state in.
 *
 * Deliberately a neutral module rather than part of a client component: the
 * page (a server component) reads PRICE_STATS to render the figures, and the
 * dropdowns read it to render their options. See lib/stat-types.ts for why an
 * object exported from a "use client" file would reach the server as a proxy.
 */

export const PRICE_STAT_KEYS = [
  "gp",
  "mp",
  "sec",
  "pts",
  "reb",
  "orb",
  "ast",
  "stl",
  "blk",
  "fg3m",
  "ftm",
  "nvp",
  "tov",
  "pf",
  "miss",
] as const;

export type PriceStat = (typeof PRICE_STAT_KEYS)[number];

export const DEFAULT_PRICE_STAT: PriceStat = "gp";

export interface PriceStatDef {
  /** The dropdown label, and the heading over the season total. */
  label: string;
  /** What one of them is called: "$30,562 per point". */
  one: string;
  /** Several of them: "12.4 points per $1M". */
  many: string;
}

export const PRICE_STATS: Record<PriceStat, PriceStatDef> = {
  gp: { label: "Games played", one: "game", many: "games" },
  mp: { label: "Minutes played", one: "minute", many: "minutes" },
  sec: { label: "Seconds on court", one: "second", many: "seconds" },
  pts: { label: "Points", one: "point", many: "points" },
  reb: { label: "Rebounds", one: "rebound", many: "rebounds" },
  orb: {
    label: "Offensive rebounds",
    one: "offensive rebound",
    many: "offensive rebounds",
  },
  ast: { label: "Assists", one: "assist", many: "assists" },
  stl: { label: "Steals", one: "steal", many: "steals" },
  blk: { label: "Blocks", one: "block", many: "blocks" },
  fg3m: { label: "3-pointers made", one: "3-pointer", many: "3-pointers" },
  ftm: { label: "Free throws made", one: "free throw", many: "free throws" },
  nvp: { label: "NVP produced", one: "NVP", many: "NVP" },
  tov: { label: "Turnovers", one: "turnover", many: "turnovers" },
  pf: { label: "Personal fouls", one: "foul", many: "fouls" },
  miss: { label: "Missed shots", one: "missed shot", many: "missed shots" },
};

export function parsePriceStat(value: string | undefined): PriceStat {
  return PRICE_STAT_KEYS.includes(value as PriceStat)
    ? (value as PriceStat)
    : DEFAULT_PRICE_STAT;
}

/** "$ per stat", or the same thing turned over: "stat per $1M". */
export type PriceView = "dollars" | "million";

export function parsePriceView(value: string | undefined): PriceView {
  return value === "million" ? "million" : "dollars";
}

/**
 * Everything the page's URL can say. Only what differs from the defaults is
 * written back, so a fresh visit reads `/price-check?p1=2098` rather than
 * spelling out every choice it didn't make.
 */
export interface PriceCheckState {
  p1: number | null;
  s1: string | null;
  p2: number | null;
  s2: string | null;
  stat: PriceStat;
  /** Player 2's own stat. Null while the two are linked. */
  stat2: PriceStat | null;
  view: PriceView;
}

export function priceCheckHref(state: PriceCheckState) {
  const sp = new URLSearchParams();
  if (state.p1 !== null) {
    sp.set("p1", String(state.p1));
    if (state.s1) sp.set("s1", state.s1);
  }
  if (state.p2 !== null) {
    sp.set("p2", String(state.p2));
    if (state.s2) sp.set("s2", state.s2);
  }
  if (state.stat !== DEFAULT_PRICE_STAT) sp.set("stat", state.stat);
  if (state.stat2 !== null) sp.set("stat2", state.stat2);
  if (state.view !== "dollars") sp.set("view", state.view);
  const qs = sp.toString();
  return qs ? `/price-check?${qs}` : "/price-check";
}
