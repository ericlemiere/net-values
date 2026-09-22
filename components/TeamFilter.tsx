"use client";

import { useTableNav } from "./TableNav";
import { FilterDropdown } from "./FilterDropdown";

export interface TeamEra {
  abbr: string;
  name: string;
  firstSeason: string;
  lastSeason: string | null;
}

export interface TeamOption {
  abbr: string;
  name: string;
  /** Former identities, for franchises that have had more than one. */
  eras?: TeamEra[] | null;
}

/**
 * How a franchise should read for the season on screen.
 *
 * The option's VALUE stays the canonical abbreviation either way, because that
 * is what every table stores and what the filter has to match on. Only the
 * label moves, so picking "SEA - Seattle SuperSonics" in 1995-96 filters on
 * OKC exactly as it always did.
 *
 * Across all seasons there is no one name to use, so the current one stands.
 */
function labelFor(team: TeamOption, season: string) {
  if (season === "ALL" || !team.eras?.length) return team;
  const era = team.eras.find(
    (e) =>
      season >= e.firstSeason &&
      (e.lastSeason === null || season <= e.lastSeason),
  );
  return era ?? team;
}

export function TeamFilter({
  basePath,
  teams,
  currentTeam,
  season,
  sort,
  dir,
  extraParams,
}: {
  basePath: string;
  teams: TeamOption[];
  currentTeam: string;
  season: string;
  sort: string;
  dir: string;
  extraParams?: Record<string, string>;
}) {
  const { navigate } = useTableNav();

  const options = [
    { value: "ALL", label: "All teams" },
    ...teams.map((t) => {
      const era = labelFor(t, season);
      return { value: t.abbr, label: `${era.abbr} - ${era.name}` };
    }),
  ];

  return (
    <FilterDropdown
      label="Team"
      value={currentTeam}
      options={options}
      onChange={(nextTeam) => {
        // Changing the filter always returns to page 1 - the old offset is
        // meaningless against a different, usually much smaller, result set.
        const sp = new URLSearchParams({
          ...extraParams,
          season,
          team: nextTeam,
          sort,
          dir,
          page: "1",
        });
        navigate(`${basePath}?${sp.toString()}`);
      }}
    />
  );
}
