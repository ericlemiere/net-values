"use client";

import { useTableNav } from "./TableNav";
import { FilterDropdown } from "./FilterDropdown";

export interface TeamOption {
  abbr: string;
  name: string;
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
    ...teams.map((t) => ({ value: t.abbr, label: `${t.abbr} - ${t.name}` })),
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
