"use client";

import { useTableNav } from "./TableNav";
import { FilterDropdown } from "./FilterDropdown";

/** Season picker for a team's roster, with an All option. */
export function RosterSeasonFilter({
  abbr,
  seasons,
  currentSeason,
  liveSeason,
}: {
  abbr: string;
  seasons: string[];
  currentSeason: string;
  /** The season being played now, marked as such in the list. */
  liveSeason?: string;
}) {
  const { navigate } = useTableNav();

  return (
    <FilterDropdown
      label="Season"
      value={currentSeason}
      options={[
        { value: "ALL", label: "All seasons" },
        ...seasons.map((s) => ({
          value: s,
          label: s,
          note: s === liveSeason ? "(current)" : undefined,
        })),
      ]}
      // The roster sits below the team's season history, so scrolling to the
      // top on every change would throw the table off screen.
      onChange={(season) =>
        navigate(`/teams/${abbr}?roster=${season}`, { scroll: false })
      }
    />
  );
}
