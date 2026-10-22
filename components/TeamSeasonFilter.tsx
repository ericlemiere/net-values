"use client";

import { useTableNav } from "./TableNav";
import { FilterDropdown } from "./FilterDropdown";

/**
 * Season picker for /teams. No team filter — every row is a team. Keeps the
 * table's sort, so switching seasons compares like with like.
 */
export function TeamSeasonFilter({
  seasons,
  currentSeason,
  sort,
  dir,
}: {
  seasons: string[];
  currentSeason: string;
  sort: string;
  dir: string;
}) {
  const { navigate } = useTableNav();

  return (
    <FilterDropdown
      label="Season"
      value={currentSeason}
      options={seasons.map((s) => ({ value: s, label: s }))}
      onChange={(season) =>
        navigate(`/teams?${new URLSearchParams({ season, sort, dir })}`)
      }
    />
  );
}
