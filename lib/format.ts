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
