import { notFound } from "next/navigation";
import { SimpleTable } from "@/components/SimpleTable";
import { CompsTable } from "@/components/CompsTable";
import type { ColumnDef } from "@/components/DataTable";
import { formatNumber, formatCurrency, formatPercent } from "@/lib/format";
import {
  getPlayerById,
  getPlayerCareerStatsTotals,
  getPlayerCareerStatsPerGame,
  getPlayerCareerAdvancedStats,
  getPlayerCareerSalaries,
  getSalaryComps,
} from "@/lib/db/queries";

/** Percentage points either side of the anchor season that still count as a comp. */
const COMP_TOLERANCE = 0.5;
const COMP_LIMIT = 50;

type StatsRow = Awaited<ReturnType<typeof getPlayerCareerStatsPerGame>>[number];
type AdvRow = Awaited<ReturnType<typeof getPlayerCareerAdvancedStats>>[number];
type SalRow = Awaited<ReturnType<typeof getPlayerCareerSalaries>>[number];

const statsColumns: ColumnDef<StatsRow>[] = [
  { key: "season", label: "Season", render: (r) => r.season },
  { key: "team", label: "Team", render: (r) => r.team ?? "—" },
  { key: "pos", label: "Pos", render: (r) => r.pos ?? "—" },
  {
    key: "age",
    label: "Age",
    align: "right",
    render: (r) => formatNumber(r.age),
  },
  { key: "gp", label: "GP", align: "right", render: (r) => formatNumber(r.gp) },
  { key: "gs", label: "GS", align: "right", render: (r) => formatNumber(r.gs) },
  { key: "mp", label: "MP", align: "right", render: (r) => formatNumber(r.mp) },
  {
    key: "fgm",
    label: "FGM",
    align: "right",
    render: (r) => formatNumber(r.fgm),
  },
  {
    key: "fga",
    label: "FGA",
    align: "right",
    render: (r) => formatNumber(r.fga),
  },
  {
    key: "fgPct",
    label: "FG%",
    align: "right",
    render: (r) => formatNumber(r.fgPct),
  },
  {
    key: "fg3m",
    label: "3PM",
    align: "right",
    render: (r) => formatNumber(r.fg3m),
  },
  {
    key: "fg3a",
    label: "3PA",
    align: "right",
    render: (r) => formatNumber(r.fg3a),
  },
  {
    key: "fg3Pct",
    label: "3P%",
    align: "right",
    render: (r) => formatNumber(r.fg3Pct),
  },
  {
    key: "fg2m",
    label: "2PM",
    align: "right",
    render: (r) => formatNumber(r.fg2m),
  },
  {
    key: "fg2a",
    label: "2PA",
    align: "right",
    render: (r) => formatNumber(r.fg2a),
  },
  {
    key: "fg2Pct",
    label: "2P%",
    align: "right",
    render: (r) => formatNumber(r.fg2Pct),
  },
  {
    key: "efgPct",
    label: "eFG%",
    align: "right",
    render: (r) => formatNumber(r.efgPct),
  },
  {
    key: "ftm",
    label: "FTM",
    align: "right",
    render: (r) => formatNumber(r.ftm),
  },
  {
    key: "fta",
    label: "FTA",
    align: "right",
    render: (r) => formatNumber(r.fta),
  },
  {
    key: "ftPct",
    label: "FT%",
    align: "right",
    render: (r) => formatNumber(r.ftPct),
  },
  {
    key: "orb",
    label: "OREB",
    align: "right",
    render: (r) => formatNumber(r.orb),
  },
  {
    key: "drb",
    label: "DREB",
    align: "right",
    render: (r) => formatNumber(r.drb),
  },
  {
    key: "reb",
    label: "REB",
    align: "right",
    render: (r) => formatNumber(r.reb),
  },
  {
    key: "ast",
    label: "AST",
    align: "right",
    render: (r) => formatNumber(r.ast),
  },
  {
    key: "stl",
    label: "STL",
    align: "right",
    render: (r) => formatNumber(r.stl),
  },
  {
    key: "blk",
    label: "BLK",
    align: "right",
    render: (r) => formatNumber(r.blk),
  },
  {
    key: "tov",
    label: "TOV",
    align: "right",
    render: (r) => formatNumber(r.tov),
  },
  { key: "pf", label: "PF", align: "right", render: (r) => formatNumber(r.pf) },
  {
    key: "pts",
    label: "PTS",
    align: "right",
    render: (r) => formatNumber(r.pts),
  },
];

const advancedColumns: ColumnDef<AdvRow>[] = [
  { key: "season", label: "Season", render: (r) => r.season },
  { key: "team", label: "Team", render: (r) => r.team ?? "—" },
  { key: "pos", label: "Pos", render: (r) => r.pos ?? "—" },
  {
    key: "age",
    label: "Age",
    align: "right",
    render: (r) => formatNumber(r.age),
  },
  { key: "gp", label: "GP", align: "right", render: (r) => formatNumber(r.gp) },
  { key: "mp", label: "MP", align: "right", render: (r) => formatNumber(r.mp) },
  {
    key: "per",
    label: "PER",
    align: "right",
    render: (r) => formatNumber(r.per),
  },
  {
    key: "tsPct",
    label: "TS%",
    align: "right",
    render: (r) => formatNumber(r.tsPct),
  },
  {
    key: "usgPct",
    label: "USG%",
    align: "right",
    render: (r) => formatNumber(r.usgPct),
  },
  {
    key: "ows",
    label: "OWS",
    align: "right",
    render: (r) => formatNumber(r.ows),
  },
  {
    key: "dws",
    label: "DWS",
    align: "right",
    render: (r) => formatNumber(r.dws),
  },
  { key: "ws", label: "WS", align: "right", render: (r) => formatNumber(r.ws) },
  {
    key: "obpm",
    label: "OBPM",
    align: "right",
    render: (r) => formatNumber(r.obpm),
  },
  {
    key: "dbpm",
    label: "DBPM",
    align: "right",
    render: (r) => formatNumber(r.dbpm),
  },
  {
    key: "bpm",
    label: "BPM",
    align: "right",
    render: (r) => formatNumber(r.bpm),
  },
  {
    key: "vorp",
    label: "VORP",
    align: "right",
    render: (r) => formatNumber(r.vorp),
  },
];

const salariesColumns: ColumnDef<SalRow>[] = [
  { key: "season", label: "Season", render: (r) => r.season },
  { key: "team", label: "Team", render: (r) => r.team ?? "—" },
  {
    key: "salary",
    label: "Salary",
    align: "right",
    render: (r) => formatCurrency(r.salary),
  },
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
    key: "leagueCap",
    label: "League Cap",
    align: "right",
    render: (r) => formatCurrency(r.leagueCap),
  },
  {
    key: "pctOfLeagueCap",
    label: "% of League Cap",
    align: "right",
    render: (r) => formatPercent(r.pctOfLeagueCap),
  },
];

// The salaries table anchors the comps beside it: the ?salary= row if it names
// one, otherwise the player's most recent season that has both a salary and a
// league cap to divide it by.
function pickAnchor(rows: SalRow[], salaryId: number | null) {
  const usable = rows.filter((r) => r.salary !== null && r.leagueCap);
  return usable.find((r) => r.id === salaryId) ?? usable[usable.length - 1] ?? null;
}

export default async function PlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ salary?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const playerId = Number(id);
  if (!Number.isInteger(playerId)) notFound();

  const player = await getPlayerById(playerId);
  if (!player) notFound();

  const [perGame, totals, advanced, salaries] = await Promise.all([
    getPlayerCareerStatsPerGame(playerId),
    getPlayerCareerStatsTotals(playerId),
    getPlayerCareerAdvancedStats(playerId),
    getPlayerCareerSalaries(playerId),
  ]);

  const salaryId = Number(sp.salary);
  const anchor = pickAnchor(salaries, Number.isInteger(salaryId) ? salaryId : null);
  // Recomputed from the raw figures rather than read off pctOfLeagueCap, which
  // Postgres hands back as a numeric string.
  const anchorPct = anchor
    ? Math.round((10000 * anchor.salary!) / anchor.leagueCap!) / 100
    : null;
  const [seasonComps, historicalComps] =
    anchor === null || anchorPct === null
      ? [null, null]
      : await Promise.all(
          (["season", "historical"] as const).map((scope) =>
            getSalaryComps({
              playerId,
              targetPct: anchorPct,
              season: anchor.season,
              scope,
              tolerance: COMP_TOLERANCE,
              limit: COMP_LIMIT,
            })
          )
        );

  // Both comps tables hang off the same anchor, so they share a subtitle stem.
  const anchorLabel =
    anchorPct === null ? null : `${anchorPct.toFixed(2)}% of the cap \u00b1 ${COMP_TOLERANCE}`;
  const truncation = (comps: { rows: unknown[]; totalCount: number } | null) =>
    comps && comps.totalCount > comps.rows.length
      ? ` \u2014 closest ${comps.rows.length} of ${comps.totalCount}`
      : "";

  return (
    <div className="p-6 max-w-350 mx-auto text-white">
      <h1 className="text-2xl font-semibold mb-6">{player.name}</h1>
      <div className="flex flex-wrap items-start gap-8">
        <SimpleTable
          title="Salaries"
          subtitle={
            salaries.length > 0 && "Select a season to compare it against the league."
          }
          columns={salariesColumns}
          rows={salaries}
          rowKey={(r) => r.id}
          fit
          rowHref={(r) => `/players/${playerId}?salary=${r.id}`}
          isActive={(r) => r.id === anchor?.id}
        />
        <div className="flex flex-col">
          <CompsTable
            title="Season Cap Comps"
            subtitle={
              anchorLabel
                ? `${anchor!.season} only \u00b7 ${anchorLabel}${truncation(seasonComps)}`
                : undefined
            }
            rows={seasonComps?.rows ?? []}
            showSeason={false}
            emptyMessage={
              seasonComps
                ? "Nobody else took up this share of the cap that season."
                : "No salary with a known league cap to compare."
            }
          />
          <CompsTable
            title="Historical Cap Comps"
            subtitle={
              anchorLabel
                ? `Every other season \u00b7 ${anchorLabel}${truncation(historicalComps)}`
                : undefined
            }
            rows={historicalComps?.rows ?? []}
            emptyMessage={
              historicalComps
                ? "No other season matches this share of the cap."
                : "No salary with a known league cap to compare."
            }
          />
        </div>
      </div>
      <SimpleTable
        title="Career Averages"
        columns={statsColumns}
        rows={perGame}
        rowKey={(r) => r.id}
      />
      {totals.length > 0 && (
        <SimpleTable
          title="Career Totals"
          columns={statsColumns}
          rows={totals}
          rowKey={(r) => r.id}
        />
      )}
      <SimpleTable
        title="Advanced Stats"
        columns={advancedColumns}
        rows={advanced}
        rowKey={(r) => r.id}
      />
    </div>
  );
}
