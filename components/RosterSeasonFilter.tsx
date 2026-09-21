"use client";

import { useTableNav } from "./TableNav";

/** Season picker for a team's roster, with an All option. */
export function RosterSeasonFilter({
  abbr,
  seasons,
  currentSeason,
}: {
  abbr: string;
  seasons: string[];
  currentSeason: string;
}) {
  const { navigate } = useTableNav();

  return (
    <label className="flex items-center gap-2 text-sm text-white">
      <span className="text-white/70">Season</span>
      <select
        className="rounded-md border border-white/20 bg-white/5 px-2 py-1 text-white transition-colors hover:border-white/40"
        value={currentSeason}
        onChange={(e) => navigate(`/teams/${abbr}?roster=${e.target.value}`)}
      >
        <option value="ALL">All seasons</option>
        {seasons.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </label>
  );
}
