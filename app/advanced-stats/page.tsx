import { DataTable, type ColumnDef } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { PlayerLink } from "@/components/PlayerLink";
import { TeamLink } from "@/components/TeamLink";
import { formatNumber, formatStat } from "@/lib/format";
import {
  getAdvancedStats,
  getAdvancedStatsSeasons,
  getTeams,
  PAGE_SIZE,
} from "@/lib/db/queries";
import { parsePosition } from "@/lib/positions";

type Row = Awaited<ReturnType<typeof getAdvancedStats>>["rows"][number];

function getColumns(showSeason: boolean): ColumnDef<Row>[] {
  return [
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
            defaultDir: "asc" as const,
            render: (r: Row) => r.season,
          },
        ]
      : []),
    {
      key: "team",
      label: "Team",
      defaultDir: "asc",
      render: (r) => <TeamLink abbr={r.team} label={r.teamLabel} />,
    },
    {
      key: "pos",
      label: "Pos",
      defaultDir: "asc",
      render: (r) => r.pos ?? "—",
    },
    {
      key: "age",
      label: "Age",
      align: "right",
      render: (r) => formatNumber(r.age),
    },
    {
      key: "gp",
      label: "GP",
      align: "right",
      render: (r) => formatNumber(r.gp),
    },
    {
      key: "mp",
      label: "MP",
      align: "right",
      description: "Minutes played. Season total.",
      render: (r) => formatNumber(r.mp),
    },
    {
      key: "per",
      label: "PER",
      align: "right",
      render: (r) => formatStat(r.per),
    },
    {
      key: "tsPct",
      label: "TS%",
      align: "right",
      render: (r) => formatStat(r.tsPct),
    },
    {
      key: "usgPct",
      label: "USG%",
      align: "right",
      render: (r) => formatStat(r.usgPct),
    },
    {
      key: "ows",
      label: "OWS",
      align: "right",
      render: (r) => formatStat(r.ows),
    },
    {
      key: "dws",
      label: "DWS",
      align: "right",
      render: (r) => formatStat(r.dws),
    },
    { key: "ws", label: "WS", align: "right", render: (r) => formatStat(r.ws) },
    {
      key: "obpm",
      label: "OBPM",
      align: "right",
      render: (r) => formatStat(r.obpm),
    },
    {
      key: "dbpm",
      label: "DBPM",
      align: "right",
      render: (r) => formatStat(r.dbpm),
    },
    {
      key: "bpm",
      label: "BPM",
      align: "right",
      render: (r) => formatStat(r.bpm),
    },
    {
      key: "vorp",
      label: "VORP",
      align: "right",
      render: (r) => formatStat(r.vorp),
    },
  ];
}

export default async function AdvancedStatsPage({
  searchParams,
}: {
  searchParams: Promise<{
    season?: string;
    team?: string;
    pos?: string;
    sort?: string;
    dir?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;
  const [seasons, teams] = await Promise.all([
    getAdvancedStatsSeasons(),
    getTeams(),
  ]);
  const season = sp.season ?? seasons[0] ?? "ALL";
  const team = sp.team ?? "ALL";
  const pos = parsePosition(sp.pos);
  const sort = sp.sort ?? "name";
  const dir = sp.dir === "desc" ? "desc" : "asc";
  const page = Number(sp.page ?? "1");

  const { rows, totalCount } = await getAdvancedStats({
    season,
    team,
    pos,
    sort,
    dir,
    page,
  });

  return (
    <div className="p-6 max-w-350 mx-auto text-white">
      <PageHeader title="Advanced Stats" />
      <DataTable
        basePath="/advanced-stats"
        columns={getColumns(season === "ALL")}
        rows={rows}
        rowKey={(r) => r.id}
        seasons={seasons}
        currentSeason={season}
        teams={teams}
        currentTeam={team}
        currentPos={pos}
        sort={sort}
        dir={dir}
        page={page}
        totalCount={totalCount}
        pageSize={PAGE_SIZE}
      />
    </div>
  );
}
