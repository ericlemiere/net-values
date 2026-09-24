import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { SimpleTable } from "@/components/SimpleTable";
import { TeamSeasonFilter } from "@/components/TeamSeasonFilter";
import { TableOverlay } from "@/components/TableNav";
import { COUNT_CHIP, type ColumnDef } from "@/components/DataTable";
import { formatCurrency, formatScore, formatStat } from "@/lib/format";
import {
  getLeagueCap,
  getTeamSeasons,
  getTeamsForSeason,
  type TeamSeasonRow,
} from "@/lib/db/queries";
import { PAGE_COLUMN } from "@/lib/layout";

const columns: ColumnDef<TeamSeasonRow>[] = [
  {
    key: "name",
    label: "Team",
    // Named as it was that season, linked as it is now. Without this the
    // 1995-96 table lists the Oklahoma City Thunder going 64-18 in a city that
    // had no franchise for another twelve years.
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
          title={
            r.eraName && r.eraName !== r.name
              ? `${r.eraName}, now the ${r.name}`
              : undefined
          }
        >
          {r.eraName ?? r.name}
        </Link>
      </span>
    ),
  },
  {
    key: "abbr",
    label: "Abbr",
    align: "center",
    render: (r) => r.eraAbbr ?? r.abbr,
  },
  {
    key: "wins",
    label: "W",
    align: "center",
    render: (r) => r.wins ?? "—",
  },
  {
    key: "losses",
    label: "L",
    align: "center",
    render: (r) => r.losses ?? "—",
  },
  {
    key: "winPct",
    label: "Win%",
    align: "center",
    // .683 rather than 68.3% — the convention every standings page uses.
    render: (r) =>
      r.winPct === null ? "—" : r.winPct.toFixed(3).replace(/^0/, ""),
  },
  // {
  //   key: "srs",
  //   label: "SRS",
  //   align: "right",
  //   render: (r) =>
  //     r.srs === null ? "—" : `${r.srs > 0 ? "+" : ""}${formatStat(r.srs)}`,
  // },
  // {
  //   key: "rosterSize",
  //   label: "Contracts",
  //   align: "center",
  //   render: (r) => r.rosterSize ?? "—",
  // },
  {
    key: "payroll",
    label: "Payroll",
    align: "right",
    render: (r) => formatCurrency(r.payroll),
  },
  {
    key: "payrollPctOfCap",
    label: "% of League Cap",
    align: "center",
    render: (r) =>
      r.payrollPctOfCap === null ? "—" : `${formatStat(r.payrollPctOfCap)}%`,
  },

  {
    key: "teamNetValue",
    label: "Team NV",
    align: "center",
    render: (r) => formatScore(r.netValue),
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
    <div className={PAGE_COLUMN}>
      <PageHeader
        title="Teams"
        meta={
          leagueCap !== null && (
            <div className="inline-flex max-w-full flex-wrap items-baseline justify-center gap-x-3 gap-y-1 rounded-lg border-2 border-accent bg-background px-2 py-2 md:justify-start md:px-4">
              <span className="text-sm text-white/60">
                {season} League Salary Cap
              </span>
              <span className="font-mono font-semibold tabular-nums text-accent md:text-lg">
                {formatCurrency(leagueCap)}
              </span>
            </div>
          )
        }
      />
      {/* Stacked on a phone so the count chip keeps its own line instead of
          being squeezed against the dropdown, which is how the salaries and
          stats pages lay the same pair out. */}
      <div className="mb-4 flex min-w-0 flex-col items-stretch justify-between gap-4 md:flex-row md:items-center">
        <TeamSeasonFilter seasons={seasons} currentSeason={season} />
        <div className={`shrink-0 ${COUNT_CHIP}`}>
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
