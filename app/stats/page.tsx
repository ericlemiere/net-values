import type { ReactNode } from "react";
import { DataTable } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { StatTypeToggle } from "@/components/StatTypeToggle";
import {
  getAdvancedStats,
  getAdvancedStatsSeasons,
  getPlayerStatsPerGame,
  getPlayerStatsTotals,
  getStatsSeasons,
  getTeams,
  PAGE_SIZE,
  getAwardsForRows,
} from "@/lib/db/queries";
import { parsePosition } from "@/lib/positions";
import { DEFAULT_SORT, parseStatType } from "@/lib/stat-types";
import { getAdvancedColumns, getBoxScoreColumns } from "./columns";
import { PAGE_COLUMN } from "@/lib/layout";
import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata({
  title: "NBA Player Stats",
  description:
    "NBA player stats for every season since 1990-91: per-game averages, season totals and advanced metrics like TS% and usage, filterable by season, team and position.",
  path: "/stats",
});

/**
 * Every player table on the site, behind one heading and one toggle.
 *
 * Averages, Totals and Advanced were three routes and are now three views of
 * /stats, because they answer the same question about the same players and
 * splitting them across the nav made you leave the page — and your season,
 * team and position filters with it — to compare a scoring average against the
 * efficiency behind it. The toggle carries all three filters across, so the
 * view changes and the question you were asking doesn't.
 */
export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{
    season?: string;
    team?: string;
    pos?: string;
    sort?: string;
    dir?: string;
    page?: string;
    type?: string;
  }>;
}) {
  const sp = await searchParams;
  const statType = parseStatType(sp.type);
  const advanced = statType === "advanced";

  // The two tables cover the same 37 seasons today, but they're filled by
  // different backfills and needn't stay in step, so each view offers the
  // seasons its own table actually holds.
  const [seasons, teams] = await Promise.all([
    advanced ? getAdvancedStatsSeasons() : getStatsSeasons(),
    getTeams(),
  ]);

  const season = sp.season ?? seasons[0] ?? "ALL";
  const team = sp.team ?? "ALL";
  const pos = parsePosition(sp.pos);
  const sort = sp.sort ?? DEFAULT_SORT[statType].sort;
  const dir: "asc" | "desc" = sp.dir === "asc" ? "asc" : "desc";
  const page = Number(sp.page ?? "1");

  const params = { season, team, pos, sort, dir, page } as const;
  // Everything the table needs that doesn't depend on which query ran.
  const chrome = {
    basePath: "/stats",
    seasons,
    currentSeason: season,
    teams,
    currentTeam: team,
    currentPos: pos,
    sort,
    dir,
    page,
    pageSize: PAGE_SIZE,
    extraParams: { type: statType },
  };

  /*
   * The branch builds the finished table rather than just the rows: the box
   * score and the advanced table have different row shapes, and handing
   * DataTable a union of the two would leave its `columns` and `rowKey`
   * generics with nothing concrete to bind to.
   */
  let table: ReactNode;
  if (advanced) {
    const { rows, totalCount } = await getAdvancedStats(params);
    const awards = await getAwardsForRows(rows);
    table = (
      <DataTable
        {...chrome}
        columns={getAdvancedColumns(season === "ALL", awards)}
        rows={rows}
        rowKey={(r) => r.id}
        totalCount={totalCount}
      />
    );
  } else {
    const { rows, totalCount } =
      statType === "totals"
        ? await getPlayerStatsTotals(params)
        : await getPlayerStatsPerGame(params);
    // Badges for just the rows on this page.
    const awards = await getAwardsForRows(rows);
    table = (
      <DataTable
        {...chrome}
        columns={getBoxScoreColumns(season === "ALL", statType, awards)}
        rows={rows}
        rowKey={(r) => r.id}
        totalCount={totalCount}
      />
    );
  }

  return (
    <div className={PAGE_COLUMN}>
      <PageHeader
        title="Player Stats"
        meta={
          <StatTypeToggle
            basePath="/stats"
            statType={statType}
            season={season}
            team={team}
            pos={pos}
            sort={sort}
            dir={dir}
          />
        }
      />
      {table}
    </div>
  );
}
