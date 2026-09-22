"use client";

import { useTableNav } from "./TableNav";
import { FilterDropdown } from "./FilterDropdown";

/** Season picker for /teams. No team filter — every row is a team. */
export function TeamSeasonFilter({
  seasons,
  currentSeason,
}: {
  seasons: string[];
  currentSeason: string;
}) {
  const { navigate } = useTableNav();

  return (
    <FilterDropdown
      label="Season"
      value={currentSeason}
      options={seasons.map((s) => ({ value: s, label: s }))}
      onChange={(season) => navigate(`/teams?season=${season}`)}
    />
  );
}
