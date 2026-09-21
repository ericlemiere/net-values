import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { SimpleTable } from "@/components/SimpleTable";
import { TeamSeasonFilter } from "@/components/TeamSeasonFilter";
import { TableOverlay } from "@/components/TableNav";
import { COUNT_CHIP, type ColumnDef } from "@/components/DataTable";
import { formatCurrency, formatStat } from "@/lib/format";
import {
  getLeagueCap,
  getTeamSeasons,
  getTeamsForSeason,
  type TeamSeasonRow,
} from "@/lib/db/queries";

const columns: ColumnDef<TeamSeasonRow>[] = [
  {
    key: "name",
    label: "Team",
    render: (r) => (
      <span className="flex items-center gap-2 whitespace-nowrap">
        {/* The title is the whole reason a season is memorable, so it reads as
            a mark on the team rather than another column of true/false. */}
        {r.champion && (
          <span title="Won the championship" aria-label="Won the championship">
            🏆
          </span>
        )}
        <Link
          href={`/teams/${r.abbr}`}
          className={`hover:underline ${r.champion ? "font-semibold" : ""}`}
        >
          {r.name}
        </Link>
      </span>
    ),
  },
  { key: "abbr", label: "Abbr", align: "center", render: (r) => r.abbr },
  {
    key: "wins",
    label: "W",
    align: "right",
    render: (r) => r.wins ?? "—",
  },
  {
    key: "losses",
    label: "L",
    align: "right",
    render: (r) => r.losses ?? "—",
  },
  {
    key: "winPct",
    label: "Win%",
    align: "right",
    // .683 rather than 68.3% — the convention every standings page uses.
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
    key: "payrollPctOfCap",
    label: "% of Cap",
    align: "right",
    render: (r) =>
      r.payrollPctOfCap === null ? "—" : `${formatStat(r.payrollPctOfCap)}%`,
  },
  {
    key: "rosterSize",
    label: "Players Paid",
    align: "right",
    render: (r) => r.rosterSize ?? "—",
  },
  {
    key: "madePlayoffs",
    label: "Playoffs",
    align: "center",
    render: (r) =>
      r.madePlayoffs === null ? "—" : r.madePlayoffs ? "Yes" : "—",
  },
];

export default async function TeamsPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const sp = await searchParams;
  const seasons = await getTeamSeasons();
  const season =
    sp.season && seasons.includes(sp.season) ? sp.season : seasons[0];

  const [rows, leagueCap] = await Promise.all([
    getTeamsForSeason(season),
    getLeagueCap(season),
  ]);

  // Only meaningful once payrolls are on file for the season.
  const withPayroll = rows.filter((r) => r.payroll !== null);
  const totalPayroll = withPayroll.reduce((sum, r) => sum + r.payroll!, 0);

  return (
    <div className="mx-auto max-w-350 p-6 text-white">
      <PageHeader
        title="Teams"
        meta={
          leagueCap !== null && (
            <div className="inline-flex items-baseline gap-3 rounded-lg border-2 border-accent bg-white/5 px-4 py-2">
              <span className="text-sm text-white/60">
                {season} League Salary Cap
              </span>
              <span className="font-mono text-lg font-semibold tabular-nums text-accent">
                {formatCurrency(leagueCap)}
              </span>
            </div>
          )
        }
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <TeamSeasonFilter seasons={seasons} currentSeason={season} />
        <div className={COUNT_CHIP}>
          {rows.length} teams
          {withPayroll.length > 0 && (
            <>
              {" · "}
              {formatCurrency(totalPayroll)} total payroll
              {withPayroll.length < rows.length &&
                ` (${withPayroll.length} of ${rows.length} on file)`}
            </>
          )}
        </div>
      </div>
      <TableOverlay>
        <SimpleTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.teamId}
          emptyMessage="No team records for this season."
        />
      </TableOverlay>
    </div>
  );
}
