/**
 * The five positions every row is filed under.
 *
 * Stored values are a primary code, occasionally with a secondary hung off it
 * ("SG-PG", "C-PF"). The filter matches on the primary one only, which is how
 * the Pos column reads left to right and keeps the five buckets mutually
 * exclusive - a player lands in exactly one of them.
 *
 * This lives outside lib/db/queries.ts because the filter dropdown is a client
 * component: importing the list from queries would pull the whole Drizzle
 * module - and `neon(process.env.DATABASE_URL!)` with it - into the browser
 * bundle, where that variable does not exist.
 */
export const POSITIONS = ["PG", "SG", "SF", "PF", "C"] as const;

export type Position = (typeof POSITIONS)[number];

export const POSITION_LABELS: Record<Position, string> = {
  PG: "PG - Point Guard",
  SG: "SG - Shooting Guard",
  SF: "SF - Small Forward",
  PF: "PF - Power Forward",
  C: "C - Center",
};

/** Narrows a raw `?pos=` search param to a position, or "ALL". */
export function parsePosition(value: string | undefined): string {
  return POSITIONS.includes(value as Position) ? value! : "ALL";
}
