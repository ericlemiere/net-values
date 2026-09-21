"use client";

import { useTableNav } from "./TableNav";

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

  return (
    <label className="flex items-center gap-2 text-sm text-white">
      <span className="text-white/70">Team</span>
      <select
        className="rounded-md border border-white/20 bg-white/5 px-2 py-1 text-white transition-colors hover:border-white/40"
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
          navigate(`${basePath}?${sp.toString()}`);
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
