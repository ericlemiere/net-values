"use client";

import { useTableNav } from "./TableNav";
import { FilterDropdown } from "./FilterDropdown";
import { POSITIONS, POSITION_LABELS } from "@/lib/positions";

export function PositionFilter({
  basePath,
  currentPos,
  season,
  team,
  sort,
  dir,
  extraParams,
}: {
  basePath: string;
  currentPos: string;
  season: string;
  team: string;
  sort: string;
  dir: string;
  extraParams?: Record<string, string>;
}) {
  const { navigate } = useTableNav();

  const options = [
    { value: "ALL", label: "All positions" },
    ...POSITIONS.map((p) => ({ value: p as string, label: POSITION_LABELS[p] })),
  ];

  return (
    <FilterDropdown
      label="Pos"
      value={currentPos}
      options={options}
      onChange={(nextPos) => {
        // Back to page 1, same as the other two: the old offset means nothing
        // against a result set roughly a fifth the size.
        const sp = new URLSearchParams({
          ...extraParams,
          season,
          team,
          pos: nextPos,
          sort,
          dir,
          page: "1",
        });
        navigate(`${basePath}?${sp.toString()}`);
      }}
    />
  );
}
