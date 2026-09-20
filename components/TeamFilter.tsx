"use client";

import { useRouter } from "next/navigation";

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
  const router = useRouter();

  return (
    <label className="flex items-center gap-2 text-sm text-white">
      <span className="text-white/70">Team</span>
      <select
        className="border border-white/20 rounded px-2 py-1 bg-white text-black focus:outline-none focus:ring-2 focus:ring-accent"
        value={currentTeam}
        onChange={(e) => {
          // Changing the filter always returns to page 1 — the old offset is
          // meaningless against a different, usually much smaller, result set.
          const sp = new URLSearchParams({
            ...extraParams,
            season,
            team: e.target.value,
            sort,
            dir,
            page: "1",
          });
          router.push(`${basePath}?${sp.toString()}`);
        }}
      >
        <option value="ALL">All teams</option>
        {teams.map((t) => (
          <option key={t.abbr} value={t.abbr}>
            {t.abbr} — {t.name}
          </option>
        ))}
      </select>
    </label>
  );
}
