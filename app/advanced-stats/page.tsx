import { DataTable, type ColumnDef } from "@/components/DataTable";
import { PlayerLink } from "@/components/PlayerLink";
import { formatNumber } from "@/lib/format";
import { getAdvancedStats, getAdvancedStatsSeasons, PAGE_SIZE } from "@/lib/db/queries";

type Row = Awaited<ReturnType<typeof getAdvancedStats>>["rows"][number];

function getColumns(showSeason: boolean): ColumnDef<Row>[] {
  return [
    { key: "name", label: "Name", defaultDir: "asc", render: (r) => <PlayerLink id={r.playerId} name={r.name} /> },
    ...(showSeason
      ? [{ key: "season", label: "Season", defaultDir: "asc" as const, render: (r: Row) => r.season }]
      : []),
    { key: "team", label: "Team", defaultDir: "asc", render: (r) => r.team ?? "—" },
    { key: "pos", label: "Pos", defaultDir: "asc", render: (r) => r.pos ?? "—" },
    { key: "age", label: "Age", align: "right", render: (r) => formatNumber(r.age) },
    { key: "gp", label: "GP", align: "right", render: (r) => formatNumber(r.gp) },
    { key: "mp", label: "MP", align: "right", render: (r) => formatNumber(r.mp) },
    { key: "per", label: "PER", align: "right", render: (r) => formatNumber(r.per) },
    { key: "tsPct", label: "TS%", align: "right", render: (r) => formatNumber(r.tsPct) },
    { key: "usgPct", label: "USG%", align: "right", render: (r) => formatNumber(r.usgPct) },
    { key: "ows", label: "OWS", align: "right", render: (r) => formatNumber(r.ows) },
    { key: "dws", label: "DWS", align: "right", render: (r) => formatNumber(r.dws) },
    { key: "ws", label: "WS", align: "right", render: (r) => formatNumber(r.ws) },
    { key: "obpm", label: "OBPM", align: "right", render: (r) => formatNumber(r.obpm) },
    { key: "dbpm", label: "DBPM", align: "right", render: (r) => formatNumber(r.dbpm) },
    { key: "bpm", label: "BPM", align: "right", render: (r) => formatNumber(r.bpm) },
    { key: "vorp", label: "VORP", align: "right", render: (r) => formatNumber(r.vorp) },
  ];
}

export default async function AdvancedStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string; sort?: string; dir?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const seasons = await getAdvancedStatsSeasons();
  const season = sp.season ?? seasons[0] ?? "ALL";
  const sort = sp.sort ?? "name";
  const dir = sp.dir === "desc" ? "desc" : "asc";
  const page = Number(sp.page ?? "1");

  const { rows, totalCount } = await getAdvancedStats({ season, sort, dir, page });

  return (
    <div className="p-6 max-w-[1400px] mx-auto text-white">
      <h1 className="text-2xl font-semibold mb-4">Advanced Stats</h1>
      <DataTable
        basePath="/advanced-stats"
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
