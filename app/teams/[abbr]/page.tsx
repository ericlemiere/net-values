import { notFound } from "next/navigation";
import { SimpleTable } from "@/components/SimpleTable";
import { PlayerLink } from "@/components/PlayerLink";
import { RosterSeasonFilter } from "@/components/RosterSeasonFilter";
import { TableOverlay } from "@/components/TableNav";
import type { ColumnDef } from "@/components/DataTable";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatStat,
} from "@/lib/format";
import {
  getTeamByAbbr,
  getTeamHistory,
  getTeamRoster,
  getTeamRosterSeasons,
  type TeamRosterRow,
} from "@/lib/db/queries";

type HistoryRow = Awaited<ReturnType<typeof getTeamHistory>>[number];

const historyColumns: ColumnDef<HistoryRow>[] = [
  {
    key: "season",
    label: "Season",
    render: (r) => (
      <span className="flex items-center gap-2 whitespace-nowrap">
        {r.champion && (
          <span title="Won the championship" aria-label="Won the championship">
            🏆
          </span>
        )}
        <span className={r.champion ? "font-semibold" : undefined}>
          {r.season}
        </span>
      </span>
    ),
  },
  { key: "wins", label: "W", align: "right", render: (r) => r.wins ?? "—" },
  { key: "losses", label: "L", align: "right", render: (r) => r.losses ?? "—" },
  {
    key: "winPct",
    label: "Win%",
    align: "right",
    render: (r) =>
      r.winPct === null ? "—" : r.winPct.toFixed(3).replace(/^0/, ""),
  },
  {
    key: "srs",
    label: "SRS",
    align: "right",
    render: (r) =>
      r.srs === null ? "—" : `${r.srs > 0 ? "+" : ""}${formatStat(r.srs)}`,
  },
  {
    key: "payroll",
    label: "Payroll",
    align: "right",
    render: (r) => formatCurrency(r.payroll),
  },
  {
    key: "leagueCap",
    label: "League Cap",
    align: "right",
    render: (r) => formatCurrency(r.leagueCap),
  },
  {
    key: "payrollPctOfCap",
    label: "% of Cap",
    align: "right",
    render: (r) =>
      r.payrollPctOfCap === null ? "—" : `${formatStat(r.payrollPctOfCap)}%`,
  },
  {
    key: "madePlayoffs",
    label: "Playoffs",
    align: "center",
    render: (r) =>
      r.madePlayoffs === null ? "—" : r.madePlayoffs ? "Yes" : "—",
  },
];

function rosterColumns(showSeason: boolean): ColumnDef<TeamRosterRow>[] {
  return [
    {
      key: "name",
      label: "Player",
      render: (r) => <PlayerLink id={r.playerId} name={r.name} />,
    },
    ...(showSeason
      ? [
          {
            key: "season",
            label: "Season",
            render: (r: TeamRosterRow) => r.season,
          },
        ]
      : []),
    {
      key: "salary",
      label: "Salary",
      align: "right",
      render: (r) => formatCurrency(r.salary),
    },
    {
      key: "pctOfTeamCap",
      label: "% of Team Payroll",
      align: "right",
      render: (r) => formatPercent(r.pctOfTeamCap),
    },
    {
      key: "pctOfLeagueCap",
      label: "% of League Cap",
      align: "right",
      render: (r) => formatPercent(r.pctOfLeagueCap),
    },
    {
      key: "gp",
      label: "GP",
      align: "right",
      render: (r) => formatNumber(r.gp),
    },
    {
      key: "mp",
      label: "MPG",
      align: "right",
      description: "Minutes played. Per game.",
      render: (r) => formatStat(r.mp),
    },
    {
      key: "pts",
      label: "PTS",
      align: "right",
      description: "Points. Per game.",
      render: (r) => formatStat(r.pts),
    },
    {
      key: "reb",
      label: "REB",
      align: "right",
      description: "Total rebounds. Per game.",
      render: (r) => formatStat(r.reb),
    },
    {
      key: "ast",
      label: "AST",
      align: "right",
      description: "Assists. Per game.",
      render: (r) => formatStat(r.ast),
    },
  ];
}

/** A labelled figure in the header strip. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border-2 border-accent bg-white/5 px-4 py-2">
      <div className="text-sm text-white/60">{label}</div>
      <div className="font-mono text-xl font-semibold tabular-nums text-accent">
        {value}
      </div>
    </div>
  );
}

export default async function TeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ abbr: string }>;
  searchParams: Promise<{ roster?: string }>;
}) {
  const [{ abbr }, sp] = await Promise.all([params, searchParams]);
  const team = await getTeamByAbbr(abbr);
  if (!team) notFound();

  const [history, rosterSeasons] = await Promise.all([
    getTeamHistory(team.id),
    getTeamRosterSeasons(team.abbr),
  ]);

  const rosterSeason =
    sp.roster && (sp.roster === "ALL" || rosterSeasons.includes(sp.roster))
      ? sp.roster
      : (rosterSeasons[0] ?? "ALL");
  const roster = await getTeamRoster(team.abbr, rosterSeason);

  const titles = history.filter((h) => h.champion);
  const playoffRuns = history.filter((h) => h.madePlayoffs).length;
  const totalWins = history.reduce((n, h) => n + (h.wins ?? 0), 0);
  const totalLosses = history.reduce((n, h) => n + (h.losses ?? 0), 0);
  const seasonsCovered = history.length;

  return (
    <div className="mx-auto max-w-350 p-6 text-white">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{team.name}</h1>
          <p className="mt-1 text-sm text-white/60">
            {seasonsCovered} seasons on file
            {titles.length > 0 && (
              <>
                {" — titles in "}
                {/* A title is named for the year it was won, which is the
                    season's END year: 2023-2024 was the 2024 championship. */}
                {titles.map((t) => t.season.slice(5)).join(", ")}
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Stat label="Record" value={`${totalWins}-${totalLosses}`} />
          <Stat
            label="Playoff seasons"
            value={`${playoffRuns} of ${seasonsCovered}`}
          />
          <Stat label="Championships" value={String(titles.length)} />
        </div>
      </div>

      <TableOverlay>
        <SimpleTable
          title="Payroll by Season"
          subtitle="Payroll against the league cap, with how the team finished."
          columns={historyColumns}
          rows={history}
          rowKey={(r) => r.season}
          emptyMessage="No seasons on file for this team."
        />

        <div className="mb-2 flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-white">Roster</h2>
          <RosterSeasonFilter
            abbr={team.abbr}
            seasons={rosterSeasons}
            currentSeason={rosterSeason}
          />
        </div>
        <SimpleTable
          subtitle={
            rosterSeason === "ALL"
              ? `Everyone this team paid, ${roster.length} player-seasons.`
              : `${roster.length} players paid in ${rosterSeason}.`
          }
          columns={rosterColumns(rosterSeason === "ALL")}
          rows={roster}
          rowKey={(r) => r.id}
          emptyMessage="No salary data for this team and season."
        />
      </TableOverlay>
    </div>
  );
}
