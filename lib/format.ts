export function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return `$${value.toLocaleString("en-US")}`;
}

/** Salary shares, kept at the 2dp the queries round them to. */
export function formatPercent(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return `${value}%`;
}

/** Whole-number cells: age, games played, games started, season totals. */
export function formatNumber(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return String(value);
}

/**
 * Decimal stat cells, always to exactly one place — 82 renders as "82.0".
 *
 * Postgres hands numerics back as plain numbers, so a column holding 35.8 and
 * 35.0 would otherwise render "35.8" and "35", leaving the decimal point in a
 * different place down the column. Fixing the precision keeps the digits in
 * line under the mono figures the tables use.
 */
export function formatStat(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return value.toFixed(1);
}

/**
 * Net value, which is meaningful only with its sign: +$12M means the player
 * returned twelve million more than he cost, -$12M that he didn't.
 */
export function formatSignedCurrency(value: number | null): string {
  if (value === null || value === undefined) return "—";
  const sign = value < 0 ? "-" : "+";
  return `${sign}$${Math.abs(Math.round(value)).toLocaleString("en-US")}`;
}

/** A league-wide rank, shown as "#1". */
export function formatRank(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return `#${value}`;
}

/** The Net Value score: signed, two decimals, 0 means paid the going rate. */
export function formatScore(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return `${value > 0 ? "+" : value < 0 ? "\u2212" : ""}${Math.abs(value).toFixed(2)}`;
}
