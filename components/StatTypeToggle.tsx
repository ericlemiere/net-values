"use client";

import { useRouter } from "next/navigation";

export type StatType = "per_game" | "totals";

export function StatTypeToggle({
  basePath,
  statType,
  season,
  sort,
  dir,
}: {
  basePath: string;
  statType: StatType;
  season: string;
  sort: string;
  dir: string;
}) {
  const router = useRouter();

  function go(next: StatType) {
    const sp = new URLSearchParams({ type: next, season, sort, dir, page: "1" });
    router.push(`${basePath}?${sp.toString()}`);
  }

  const baseBtn = "px-3 py-1 rounded-full text-sm font-medium transition-colors";
  const active = "bg-accent text-accent-foreground";
  const inactive = "text-black/60 hover:text-black";

  return (
    <div className="flex items-center gap-1 bg-white rounded-full p-1 border border-black/10">
      <button
        type="button"
        onClick={() => go("per_game")}
        className={`${baseBtn} ${statType === "per_game" ? active : inactive}`}
      >
        Averages
      </button>
      <button
        type="button"
        onClick={() => go("totals")}
        className={`${baseBtn} ${statType === "totals" ? active : inactive}`}
      >
        Totals
      </button>
    </div>
  );
}
