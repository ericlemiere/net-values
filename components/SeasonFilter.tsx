"use client";

import { useTableNav } from "./TableNav";
import { FilterDropdown } from "./FilterDropdown";

export function SeasonFilter({
  basePath,
  seasons,
  currentSeason,
  liveSeason,
  currentTeam,
  currentPos,
  sort,
  dir,
  extraParams,
}: {
  basePath: string;
  seasons: string[];
  currentSeason: string;
  /** The season being played now, marked as such in the list. */
  liveSeason?: string;
  currentTeam: string;
  currentPos: string;
  sort: string;
  dir: string;
  extraParams?: Record<string, string>;
}) {
  const { navigate } = useTableNav();

  const options = [
    { value: "ALL", label: "All seasons" },
    ...seasons.map((s) => ({
      value: s,
      label: s,
      note: s === liveSeason ? "(current)" : undefined,
    })),
  ];

  return (
    <FilterDropdown
      label="Season"
      value={currentSeason}
      options={options}
      onChange={(nextSeason) => {
        // Keep the team and position filters when the season changes, and
        // vice versa.
        const sp = new URLSearchParams({
          ...extraParams,
          season: nextSeason,
          team: currentTeam,
          pos: currentPos,
          sort,
          dir,
          page: "1",
        });
        navigate(`${basePath}?${sp.toString()}`);
      }}
    />
  );
}
