export function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return `$${value.toLocaleString("en-US")}`;
}

export function formatPercent(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return `${value}%`;
}

export function formatNumber(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return String(value);
}
