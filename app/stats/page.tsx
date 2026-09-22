import { DataTable, type ColumnDef } from "@/components/DataTable";
import { PlayerLink } from "@/components/PlayerLink";
import { TeamLink } from "@/components/TeamLink";
import { PageHeader } from "@/components/PageHeader";
import { StatTypeToggle, type StatType } from "@/components/StatTypeToggle";
import { formatNumber, formatStat } from "@/lib/format";
import { GLOSSARY } from "@/lib/glossary";
import {
  getPlayerStatsPerGame,
  getPlayerStatsTotals,
  getStatsSeasons,
  getTeams,
  PAGE_SIZE,
} from "@/lib/db/queries";

type Row = Awaited<ReturnType<typeof getPlayerStatsPerGame>>["rows"][number];

function getColumns(showSeason: boolean, statType: StatType): ColumnDef<Row>[] {
  const mpLabel = statType === "totals" ? "MIN" : "MPG";
  // Counting stats are fractional per game but whole in a season total, so
  // "Totals" drops the decimal. Percentages are fractional either way.
  const stat = statType === "totals" ? formatNumber : formatStat;
  // The same column means different things in the two views, so the tooltip
  // has to say which one you're looking at.
  const per = statType === "totals" ? " Season total." : " Per game.";
  const note = (key: string) => (GLOSSARY[key] ?? "") + per;
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
      key: "gs",
      label: "GS",
      align: "right",
      render: (r) => formatNumber(r.gs),
    },
    // Minutes are the one counting stat that's fractional in a season total:
    // nba_api reports them to hundredths (3126.87) while the pre-96 bref rows are
    // whole (3533), so the column rendered ragged — two decimals some years, none
    // in others. It takes formatStat in both modes rather than following `stat`.
    {
      key: "mp",
      label: mpLabel,
      align: "right",
      render: (r) => formatStat(r.mp),
    },
    {
      key: "fgm",
      description: note("fgm"),
      label: "FGM",
      align: "right",
      render: (r) => stat(r.fgm),
    },
    {
      key: "fga",
      description: note("fga"),
      label: "FGA",
      align: "right",
      render: (r) => stat(r.fga),
    },
    {
      key: "fgPct",
      label: "FG%",
      align: "right",
      render: (r) => formatStat(r.fgPct),
    },
    {
      key: "fg3m",
      description: note("fg3m"),
      label: "3PM",
      align: "right",
      render: (r) => stat(r.fg3m),
    },
    {
      key: "fg3a",
      description: note("fg3a"),
      label: "3PA",
      align: "right",
      render: (r) => stat(r.fg3a),
    },
    {
      key: "fg3Pct",
      label: "3P%",
      align: "right",
      render: (r) => formatStat(r.fg3Pct),
    },
    {
      key: "fg2m",
      description: note("fg2m"),
      label: "2PM",
      align: "right",
      render: (r) => stat(r.fg2m),
    },
    {
      key: "fg2a",
      description: note("fg2a"),
      label: "2PA",
      align: "right",
      render: (r) => stat(r.fg2a),
    },
    {
      key: "fg2Pct",
      label: "2P%",
      align: "right",
      render: (r) => formatStat(r.fg2Pct),
    },
    {
      key: "efgPct",
      label: "eFG%",
      align: "right",
      render: (r) => formatStat(r.efgPct),
    },
    {
      key: "ftm",
      description: note("ftm"),
      label: "FTM",
      align: "right",
      render: (r) => stat(r.ftm),
    },
    {
      key: "fta",
      description: note("fta"),
      label: "FTA",
      align: "right",
      render: (r) => stat(r.fta),
    },
    {
      key: "ftPct",
      label: "FT%",
      align: "right",
      render: (r) => formatStat(r.ftPct),
    },
    {
      key: "orb",
      description: note("orb"),
      label: "OREB",
      align: "right",
      render: (r) => stat(r.orb),
    },
    {
      key: "drb",
      description: note("drb"),
      label: "DREB",
      align: "right",
      render: (r) => stat(r.drb),
    },
    {
      key: "reb",
      description: note("reb"),
      label: "REB",
      align: "right",
      render: (r) => stat(r.reb),
    },
    {
      key: "ast",
      description: note("ast"),
      label: "AST",
      align: "right",
      render: (r) => stat(r.ast),
    },
    {
      key: "stl",
      description: note("stl"),
      label: "STL",
      align: "right",
      render: (r) => stat(r.stl),
    },
    {
      key: "blk",
      description: note("blk"),
      label: "BLK",
      align: "right",
      render: (r) => stat(r.blk),
    },
    {
      key: "tov",
      description: note("tov"),
      label: "TOV",
      align: "right",
      render: (r) => stat(r.tov),
    },
    {
      key: "pf",
      description: note("pf"),
      label: "PF",
      align: "right",
      render: (r) => stat(r.pf),
    },
    {
      key: "pts",
      description: note("pts"),
      label: "PTS",
      align: "right",
      render: (r) => stat(r.pts),
    },
  ];
}

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{
    season?: string;
    team?: string;
    sort?: string;
    dir?: string;
    page?: string;
    type?: string;
  }>;
}) {
  const sp = await searchParams;
  const [seasons, teams] = await Promise.all([getStatsSeasons(), getTeams()]);
  const season = sp.season ?? seasons[0] ?? "ALL";
  const team = sp.team ?? "ALL";
  const sort = sp.sort ?? "pts";
  const dir = sp.dir === "asc" ? "asc" : "desc";
  const page = Number(sp.page ?? "1");
  const statType: StatType = sp.type === "totals" ? "totals" : "per_game";

  const { rows, totalCount } =
    statType === "totals"
      ? await getPlayerStatsTotals({ season, team, sort, dir, page })
      : await getPlayerStatsPerGame({ season, team, sort, dir, page });

  return (
    <div className="p-6 max-w-350 mx-auto text-white">
      <PageHeader
        title="Player Stats"
        meta={
          <StatTypeToggle
            basePath="/stats"
            statType={statType}
            season={season}
            team={team}
            sort={sort}
            dir={dir}
          />
        }
      />
      <DataTable
        basePath="/stats"
        columns={getColumns(season === "ALL", statType)}
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
        extraParams={{ type: statType }}
      />
    </div>
  );
}
