import { DataTable, type ColumnDef } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { PlayerLink } from "@/components/PlayerLink";
import { formatCurrency, formatPercent } from "@/lib/format";
import {
  getLeagueCap,
  getSalaries,
  getSalariesSeasons,
  getTeams,
  PAGE_SIZE,
} from "@/lib/db/queries";

type Row = Awaited<ReturnType<typeof getSalaries>>["rows"][number];

function getColumns(showSeason: boolean): ColumnDef<Row>[] {
  return [
    // Name stays left-aligned (and the row-number column, which DataTable
    // renders itself); every other column is centered.
    {
      key: "name",
      label: "Name",
      defaultDir: "asc",
      render: (r) => <PlayerLink id={r.playerId} name={r.name} />,
    },
    ...(showSeason
      ? [
          {
            key: "season",
            label: "Season",
            align: "center" as const,
            defaultDir: "asc" as const,
            render: (r: Row) => r.season,
          },
        ]
      : []),
    {
      key: "team",
      label: "Team",
      align: "center",
      defaultDir: "asc",
      render: (r) => r.team ?? "—",
    },
    {
      key: "salary",
      label: "Salary",
      align: "center",
      render: (r) => formatCurrency(r.salary),
    },
    {
      key: "teamPayroll",
      label: "Team Payroll",
      align: "center",
      render: (r) => formatCurrency(r.teamPayroll),
    },
    {
      key: "pctOfTeamCap",
      label: "% of Team Payroll",
      align: "center",
      render: (r) => formatPercent(r.pctOfTeamCap),
    },
    {
      key: "pctOfLeagueCap",
      label: "% of League Cap",
      align: "center",
      render: (r) => formatPercent(r.pctOfLeagueCap),
    },
  ];
}

export default async function SalariesPage({
  searchParams,
}: {
  searchParams: Promise<{
    season?: string;
    team?: string;
    sort?: string;
    dir?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;
  const [seasons, teams] = await Promise.all([getSalariesSeasons(), getTeams()]);
  const season = sp.season ?? seasons[0] ?? "ALL";
  const team = sp.team ?? "ALL";
  const sort = sp.sort ?? "name";
  const dir = sp.dir === "desc" ? "desc" : "asc";
  const page = Number(sp.page ?? "1");

  // Null when season is "ALL" — a single cap figure would be meaningless
  // across seasons, so the banner is omitted entirely in that case.
  const [{ rows, totalCount }, leagueCap] = await Promise.all([
    getSalaries({ season, team, sort, dir, page }),
    getLeagueCap(season),
  ]);

  return (
    <div className="p-6 max-w-350 mx-auto text-white">
      <PageHeader
        title="Salaries"
        meta={
          leagueCap !== null && (
            <div className="inline-flex items-baseline gap-3 rounded-lg border-2 border-accent bg-white/5 px-4 py-2">
              <span className="text-sm text-white/60">{season} League Salary Cap</span>
              <span className="font-mono text-lg font-semibold tabular-nums text-accent">
                {formatCurrency(leagueCap)}
              </span>
            </div>
          )
        }
      />
      <DataTable
        basePath="/salaries"
        columns={getColumns(season === "ALL")}
        rows={rows}
        rowKey={(r) => r.id}
        seasons={seasons}
        currentSeason={season}
        teams={teams}
        currentTeam={team}
        sort={sort}
        dir={dir}
        page={page}
        totalCount={totalCount}
        pageSize={PAGE_SIZE}
      />
      <p className="text-sm text-white/60 mt-8">
        Salaries and team payrolls are sourced from Basketball-Reference
        (2011-12 onward) and from Hoopshype for earlier seasons (1990-91 through
        2010-11). Percentages are computed against that season&rsquo;s team
        payroll and league salary cap.
      </p>
    </div>
  );
}
