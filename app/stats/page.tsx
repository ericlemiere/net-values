import { DataTable, type ColumnDef } from "@/components/DataTable";
import { PlayerLink } from "@/components/PlayerLink";
import { StatTypeToggle, type StatType } from "@/components/StatTypeToggle";
import { formatNumber } from "@/lib/format";
import { getPlayerStatsPerGame, getPlayerStatsTotals, getStatsSeasons, PAGE_SIZE } from "@/lib/db/queries";

type Row = Awaited<ReturnType<typeof getPlayerStatsPerGame>>["rows"][number];

function getColumns(showSeason: boolean, statType: StatType): ColumnDef<Row>[] {
  const mpLabel = statType === "totals" ? "MIN" : "MPG";
  return [
    { key: "name", label: "Name", defaultDir: "asc", render: (r) => <PlayerLink id={r.playerId} name={r.name} /> },
    ...(showSeason
      ? [{ key: "season", label: "Season", defaultDir: "asc" as const, render: (r: Row) => r.season }]
      : []),
    { key: "team", label: "Team", defaultDir: "asc", render: (r) => r.team ?? "—" },
    { key: "pos", label: "Pos", defaultDir: "asc", render: (r) => r.pos ?? "—" },
    { key: "age", label: "Age", align: "right", render: (r) => formatNumber(r.age) },
    { key: "gp", label: "GP", align: "right", render: (r) => formatNumber(r.gp) },
    { key: "gs", label: "GS", align: "right", render: (r) => formatNumber(r.gs) },
    { key: "mp", label: mpLabel, align: "right", render: (r) => formatNumber(r.mp) },
    { key: "fgm", label: "FGM", align: "right", render: (r) => formatNumber(r.fgm) },
    { key: "fga", label: "FGA", align: "right", render: (r) => formatNumber(r.fga) },
    { key: "fgPct", label: "FG%", align: "right", render: (r) => formatNumber(r.fgPct) },
    { key: "fg3m", label: "3PM", align: "right", render: (r) => formatNumber(r.fg3m) },
    { key: "fg3a", label: "3PA", align: "right", render: (r) => formatNumber(r.fg3a) },
    { key: "fg3Pct", label: "3P%", align: "right", render: (r) => formatNumber(r.fg3Pct) },
    { key: "fg2m", label: "2PM", align: "right", render: (r) => formatNumber(r.fg2m) },
    { key: "fg2a", label: "2PA", align: "right", render: (r) => formatNumber(r.fg2a) },
    { key: "fg2Pct", label: "2P%", align: "right", render: (r) => formatNumber(r.fg2Pct) },
    { key: "efgPct", label: "eFG%", align: "right", render: (r) => formatNumber(r.efgPct) },
    { key: "ftm", label: "FTM", align: "right", render: (r) => formatNumber(r.ftm) },
    { key: "fta", label: "FTA", align: "right", render: (r) => formatNumber(r.fta) },
    { key: "ftPct", label: "FT%", align: "right", render: (r) => formatNumber(r.ftPct) },
    { key: "orb", label: "OREB", align: "right", render: (r) => formatNumber(r.orb) },
    { key: "drb", label: "DREB", align: "right", render: (r) => formatNumber(r.drb) },
    { key: "reb", label: "REB", align: "right", render: (r) => formatNumber(r.reb) },
    { key: "ast", label: "AST", align: "right", render: (r) => formatNumber(r.ast) },
    { key: "stl", label: "STL", align: "right", render: (r) => formatNumber(r.stl) },
    { key: "blk", label: "BLK", align: "right", render: (r) => formatNumber(r.blk) },
    { key: "tov", label: "TOV", align: "right", render: (r) => formatNumber(r.tov) },
    { key: "pf", label: "PF", align: "right", render: (r) => formatNumber(r.pf) },
    { key: "pts", label: "PTS", align: "right", render: (r) => formatNumber(r.pts) },
  ];
}

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string; sort?: string; dir?: string; page?: string; type?: string }>;
}) {
  const sp = await searchParams;
  const seasons = await getStatsSeasons();
  const season = sp.season ?? seasons[0] ?? "ALL";
  const sort = sp.sort ?? "pts";
  const dir = sp.dir === "asc" ? "asc" : "desc";
  const page = Number(sp.page ?? "1");
  const statType: StatType = sp.type === "totals" ? "totals" : "per_game";

  const { rows, totalCount } =
    statType === "totals"
      ? await getPlayerStatsTotals({ season, sort, dir, page })
      : await getPlayerStatsPerGame({ season, sort, dir, page });

  return (
    <div className="p-6 max-w-[1400px] mx-auto text-white">
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <h1 className="text-2xl font-semibold">Player Stats</h1>
        <StatTypeToggle basePath="/stats" statType={statType} season={season} sort={sort} dir={dir} />
      </div>
      <DataTable
        basePath="/stats"
        columns={getColumns(season === "ALL", statType)}
        rows={rows}
        rowKey={(r) => r.id}
        seasons={seasons}
        currentSeason={season}
        sort={sort}
        dir={dir}
        page={page}
        totalCount={totalCount}
        pageSize={PAGE_SIZE}
        extraParams={{ type: statType }}
      />
    </div>
  );
}
