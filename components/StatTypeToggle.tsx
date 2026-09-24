"use client";

import { useTableNav } from "./TableNav";
import { DEFAULT_SORT, isAdvanced, type StatType } from "@/lib/stat-types";

const OPTIONS: { type: StatType; label: string }[] = [
  { type: "per_game", label: "Averages" },
  { type: "totals", label: "Totals" },
  { type: "advanced", label: "Advanced" },
];

export function StatTypeToggle({
  basePath,
  statType,
  season,
  team,
  pos,
  sort,
  dir,
}: {
  basePath: string;
  statType: StatType;
  season: string;
  team: string;
  pos: string;
  sort: string;
  dir: string;
}) {
  const { navigate } = useTableNav();

  function go(next: StatType) {
    /*
     * Sorting by PTS and then switching to Advanced would carry `sort=pts` to
     * a table that has no PTS column, and the query would quietly fall back to
     * its default — leaving the header caret on nothing and the rows in an
     * order the page never asked for. Crossing between the box score and the
     * advanced table therefore resets the sort; moving between Averages and
     * Totals, which share every column, keeps it.
     */
    const keepSort = isAdvanced(next) === isAdvanced(statType);
    const fallback = DEFAULT_SORT[next];
    const sp = new URLSearchParams({
      type: next,
      season,
      team,
      pos,
      sort: keepSort ? sort : fallback.sort,
      dir: keepSort ? dir : fallback.dir,
      page: "1",
    });
    navigate(`${basePath}?${sp.toString()}`);
  }

  const baseBtn = "rounded-md px-3 py-1 text-sm font-medium transition-colors";
  const active = "bg-accent text-accent-foreground";
  const inactive = "text-white/60 hover:text-white";

  return (
    <div
      role="group"
      aria-label="Stat type"
      className="w-fit flex items-center gap-1 rounded-lg border-2 border-accent bg-background p-1"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.type}
          type="button"
          onClick={() => go(option.type)}
          aria-pressed={statType === option.type}
          className={`${baseBtn} ${statType === option.type ? active : inactive} cursor-pointer`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
