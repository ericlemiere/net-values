"use client";

import { useTableNav } from "./TableNav";
import { FilterDropdown } from "./FilterDropdown";

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
    <FilterDropdown
      label="Season"
      value={currentSeason}
      options={[
        { value: "ALL", label: "All seasons" },
        ...seasons.map((s) => ({ value: s, label: s })),
      ]}
      onChange={(season) => navigate(`/teams/${abbr}?roster=${season}`)}
    />
  );
}
