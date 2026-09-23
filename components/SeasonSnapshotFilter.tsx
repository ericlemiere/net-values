"use client";

import { useTableNav } from "./TableNav";
import { FilterDropdown } from "./FilterDropdown";

/** The seasons page has one filter, so it carries no other params to preserve. */
export function SeasonSnapshotFilter({
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
      onChange={(season) =>
        navigate(`/seasons?season=${encodeURIComponent(season)}`)
      }
    />
  );
}
