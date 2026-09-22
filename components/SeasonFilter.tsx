"use client";

import { useTableNav } from "./TableNav";
import { FilterDropdown } from "./FilterDropdown";

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

  const options = [
    { value: "ALL", label: "All seasons" },
    ...seasons.map((s) => ({ value: s, label: s })),
  ];

  return (
    <FilterDropdown
      label="Season"
      value={currentSeason}
      options={options}
      onChange={(nextSeason) => {
        // Keep the team filter when the season changes, and vice versa.
        const sp = new URLSearchParams({
          ...extraParams,
          season: nextSeason,
          team: currentTeam,
          sort,
          dir,
          page: "1",
        });
        navigate(`${basePath}?${sp.toString()}`);
      }}
    />
  );
}
