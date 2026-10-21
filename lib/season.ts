/**
 * Whether a season ("2026-2027") is in its regular season: from October 1 of
 * its first year through April 15 of its second, when the regular season ends,
 * near enough.
 *
 * The same window scraper/compute_net_values.py prices a season in progress
 * by, where a player who hasn't played yet is left blank rather than charged.
 * Change the date in both places or neither.
 */
export function inRegularSeason(season: string, today = new Date()): boolean {
  const start = Number(season.slice(0, 4));
  const opens = new Date(start, 9, 1);
  const closes = new Date(start + 1, 3, 16);
  return today >= opens && today < closes;
}
