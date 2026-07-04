"use client";

import { useRouter } from "next/navigation";

export function SeasonFilter({
  basePath,
  seasons,
  currentSeason,
  sort,
  dir,
  extraParams,
}: {
  basePath: string;
  seasons: string[];
  currentSeason: string;
  sort: string;
  dir: string;
  extraParams?: Record<string, string>;
}) {
  const router = useRouter();

  return (
    <label className="flex items-center gap-2 text-sm text-white">
      <span className="text-white/70">Season</span>
      <select
        className="border border-white/20 rounded px-2 py-1 bg-white text-black focus:outline-none focus:ring-2 focus:ring-accent"
        value={currentSeason}
        onChange={(e) => {
          const sp = new URLSearchParams({ ...extraParams, season: e.target.value, sort, dir, page: "1" });
          router.push(`${basePath}?${sp.toString()}`);
        }}
      >
        <option value="ALL">All seasons</option>
        {seasons.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </label>
  );
}
