import { DataTable, type ColumnDef } from "@/components/DataTable";
import { PlayerLink } from "@/components/PlayerLink";
import { formatCurrency, formatPercent } from "@/lib/format";
import { getSalaries, getSalariesSeasons, PAGE_SIZE } from "@/lib/db/queries";

type Row = Awaited<ReturnType<typeof getSalaries>>["rows"][number];

function getColumns(showSeason: boolean): ColumnDef<Row>[] {
  return [
    { key: "name", label: "Name", defaultDir: "asc", render: (r) => <PlayerLink id={r.playerId} name={r.name} /> },
    ...(showSeason
      ? [{ key: "season", label: "Season", defaultDir: "asc" as const, render: (r: Row) => r.season }]
      : []),
    { key: "team", label: "Team", defaultDir: "asc", render: (r) => r.team ?? "—" },
    { key: "salary", label: "Salary", align: "right", render: (r) => formatCurrency(r.salary) },
    {
      key: "teamPayroll",
      label: "Team Payroll",
      align: "right",
      render: (r) => formatCurrency(r.teamPayroll),
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
      key: "spotracBase",
      label: "Spotrac Base",
      align: "right",
      render: (r) => formatCurrency(r.spotracBase),
    },
    {
      key: "spotracCapHit",
      label: "Spotrac Cap Hit",
      align: "right",
      render: (r) => formatCurrency(r.spotracCapHit),
    },
  ];
}

export default async function SalariesPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string; sort?: string; dir?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const seasons = await getSalariesSeasons();
  const season = sp.season ?? seasons[0] ?? "ALL";
  const sort = sp.sort ?? "name";
  const dir = sp.dir === "desc" ? "desc" : "asc";
  const page = Number(sp.page ?? "1");

  const { rows, totalCount } = await getSalaries({ season, sort, dir, page });

  return (
    <div className="p-6 max-w-[1400px] mx-auto text-white">
      <h1 className="text-2xl font-semibold mb-4">Salaries</h1>
      <p className="text-sm text-white/60 mb-4">
        Salary/Team Payroll/% columns are sourced from Hoopshype (1990-91 through 2022-23). Spotrac
        columns are only available from 2011-12 onward.
      </p>
      <DataTable
        basePath="/salaries"
        columns={getColumns(season === "ALL")}
        rows={rows}
        rowKey={(r) => r.id}
        seasons={seasons}
        currentSeason={season}
        sort={sort}
        dir={dir}
        page={page}
        totalCount={totalCount}
        pageSize={PAGE_SIZE}
      />
    </div>
  );
}
