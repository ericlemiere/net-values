"use client";

import { useTableNav } from "./TableNav";

export function SeasonFilter({
  basePath,
  seasons,
  currentSeason,
  currentTeam,
  sort,
  dir,
  extraParams,
}: {
  basePath: string;
  seasons: string[];
  currentSeason: string;
  currentTeam: string;
  sort: string;
  dir: string;
  extraParams?: Record<string, string>;
}) {
  const { navigate } = useTableNav();

  return (
    <label className="flex items-center gap-2 text-sm text-white bg-background-box rounded-md p-2 w-full md:w-fit justify-between">
      <span className="text-white/70">Season</span>
      <select
        className="rounded-md border border-white/20 bg-white/5 px-2 py-1 text-white transition-colors hover:border-white/40"
        value={currentSeason}
        onChange={(e) => {
          // Keep the team filter when the season changes, and vice versa.
          const sp = new URLSearchParams({
            ...extraParams,
            season: e.target.value,
            team: currentTeam,
            sort,
            dir,
            page: "1",
          });
          navigate(`${basePath}?${sp.toString()}`);
        }}
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
