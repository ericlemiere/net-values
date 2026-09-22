"use client";

import { useTableNav } from "./TableNav";

export type StatType = "per_game" | "totals";

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
    const sp = new URLSearchParams({
      type: next,
      season,
      team,
      pos,
      sort,
      dir,
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
      <button
        type="button"
        onClick={() => go("per_game")}
        aria-pressed={statType === "per_game"}
        className={`${baseBtn} ${statType === "per_game" ? active : inactive}`}
      >
        Averages
      </button>
      <button
        type="button"
        onClick={() => go("totals")}
        aria-pressed={statType === "totals"}
        className={`${baseBtn} ${statType === "totals" ? active : inactive}`}
      >
        Totals
      </button>
    </div>
  );
}
