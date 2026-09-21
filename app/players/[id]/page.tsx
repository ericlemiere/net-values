import { notFound } from "next/navigation";
import { TeamLink } from "@/components/TeamLink";
import { PlayerHeadshot } from "@/components/PlayerHeadshot";
import { SimpleTable } from "@/components/SimpleTable";
import { CompsTable } from "@/components/CompsTable";
import type { ColumnDef } from "@/components/DataTable";
import {
  formatNumber,
  formatStat,
  formatCurrency,
  formatPercent,
  formatRank,
  formatScore,
} from "@/lib/format";
import { GLOSSARY } from "@/lib/glossary";
import {
  getCurrentCap,
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

// Career Averages and Career Totals share this shape but not its precision:
// a per-game 10.8 FGM is fractional, a season total of 1034 is not.
function getStatsColumns(mode: "per_game" | "totals"): ColumnDef<StatsRow>[] {
  const stat = mode === "totals" ? formatNumber : formatStat;
  const per = mode === "totals" ? " Season total." : " Per game.";
  const note = (key: string) => (GLOSSARY[key] ?? "") + per;
  return [
    { key: "season", label: "Season", render: (r) => r.season },
    { key: "team", label: "Team", render: (r) => <TeamLink abbr={r.team} /> },
    { key: "pos", label: "Pos", render: (r) => r.pos ?? "—" },
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
      description: note("mp"),
      label: "MP",
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

const advancedColumns: ColumnDef<AdvRow>[] = [
  { key: "season", label: "Season", render: (r) => r.season },
  { key: "team", label: "Team", render: (r) => <TeamLink abbr={r.team} /> },
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

function getSalariesColumns(
  currentCap: Awaited<ReturnType<typeof getCurrentCap>>,
): ColumnDef<SalRow>[] {
  return [
    { key: "season", label: "Season", render: (r) => r.season },
    {
      key: "team",
      label: "Team",
      noRowLink: true,
      render: (r) => <TeamLink abbr={r.team} />,
    },
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
    {
      key: "capAdjustedSalary",
      label: currentCap ? `Salary in ${currentCap.season} $` : "Cap-Adjusted",
      align: "right",
      description: `The same share of the cap, restated at the ${
        currentCap?.season ?? "current"
      } cap. What this contract would pay if it were signed now.`,
      // Scaled from the raw salary and the two caps, not from % of League Cap:
      // that column is rounded to two decimals, and multiplying it back out
      // lands up to ~$8,000 from the real figure. Blank for the current
      // season, where restating today's salary at today's cap would only
      // repeat the Salary column beside it.
      render: (r) =>
        currentCap?.leagueCap &&
        r.salary !== null &&
        r.leagueCap &&
        r.season !== currentCap.season
          ? formatCurrency(
              Math.round((r.salary * currentCap.leagueCap) / r.leagueCap),
            )
          : "—",
    },
    {
      key: "salaryRank",
      label: "Pay Rank",
      align: "right",
      render: (r) => formatRank(r.salaryRank),
    },
    {
      key: "netValueScore",
      label: "Net Value",
      align: "right",
      render: (r) => formatScore(r.netValueScore),
    },
    {
      key: "netValueRank",
      label: "NV Rank",
      align: "right",
      render: (r) => formatRank(r.netValueRank),
    },
  ];
}

// The salaries table anchors the comps beside it: the ?salary= row if it names
// one, otherwise the player's most recent season that has both a salary and a
// league cap to divide it by.
/** One figure in the header strip: a label, the number, and a caption. */
function HeaderBox({
  label,
  value,
  caption,
}: {
  label: string;
  value: string;
  caption?: string;
}) {
  return (
    <div className="rounded-lg border-2 border-accent bg-background-box px-4 py-2 text-right">
      <div className="text-sm text-white/60">{label}</div>
      <div className="font-mono text-2xl font-semibold tabular-nums text-accent">
        {value}
      </div>
      {/* Reserved even when empty so boxes beside each other stay level. */}
      <div className="min-h-4 text-xs text-white/40">{caption}</div>
    </div>
  );
}

function pickAnchor(rows: SalRow[], salaryId: number | null) {
  const usable = rows.filter((r) => r.salary !== null && r.leagueCap);
  // An explicit ?salary= wins, whatever season it names.
  const chosen = usable.find((r) => r.id === salaryId);
  if (chosen) return chosen;
  // Otherwise default to the most recent season that has actually been played.
  // The newest salary row is often a season still to come, and anchoring there
  // gives comps with no net value and nothing to compare.
  const played = usable.filter((r) => r.netValueScore !== null);
  return played[played.length - 1] ?? usable[usable.length - 1] ?? null;
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

  const [perGame, totals, advanced, salaries, currentCap] = await Promise.all([
    getPlayerCareerStatsPerGame(playerId),
    getPlayerCareerStatsTotals(playerId),
    getPlayerCareerAdvancedStats(playerId),
    getPlayerCareerSalaries(playerId),
    getCurrentCap(),
  ]);

  const salaryId = Number(sp.salary);
  const anchor = pickAnchor(
    salaries,
    Number.isInteger(salaryId) ? salaryId : null,
  );
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
              anchorNetValue: anchor.netValueScore,
            }),
          ),
        );

  // Both comps tables hang off the same anchor, so they share a subtitle stem.
  const anchorLabel =
    anchorPct === null
      ? null
      : `${anchorPct.toFixed(2)}% of the cap \u00b1 ${COMP_TOLERANCE}`;
  // Summed from the career log already fetched above rather than a second
  // query. Seasons with no figure on record contribute nothing, so the box
  // says how many it covers instead of presenting a short total as complete.
  const paidSeasons = salaries.filter((r) => r.salary !== null);
  const careerEarnings = paidSeasons.reduce((sum, r) => sum + r.salary!, 0);
  const unknownSeasons = salaries.length - paidSeasons.length;

  // Only shown when the player is actually on a roster for the season now
  // starting. A season with no games played yet has no Net Value, so the box
  // says so with a dash rather than being hidden or showing a stale figure.
  const currentSeasonRow = currentCap
    ? salaries.find((r) => r.season === currentCap.season)
    : undefined;

  // Best season of his career by Net Value.
  const scored = salaries.filter((r) => r.netValueScore !== null);
  const bestSeason = scored.reduce<(typeof scored)[number] | null>(
    (best, r) =>
      best === null || r.netValueScore! > best.netValueScore! ? r : best,
    null,
  );

  const truncation = (comps: { rows: unknown[]; totalCount: number } | null) =>
    comps && comps.totalCount > comps.rows.length
      ? ` \u2014 closest ${comps.rows.length} of ${comps.totalCount}`
      : "";

  return (
    <div className="p-6 max-w-350 mx-auto text-white">
      <div className="mb-6 flex flex-wrap flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <PlayerHeadshot nbaPersonId={player.nbaPersonId} name={player.name} />
          <h1 className="text-2xl font-semibold tracking-tight">
            {player.name}
          </h1>
        </div>
        <div className="flex flex-col w-fit md:flex-row items-stretch gap-3">
          {paidSeasons.length > 0 && (
            <HeaderBox
              label="Career Earnings"
              value={formatCurrency(careerEarnings)}
              caption={
                `${paidSeasons.length} season${paidSeasons.length === 1 ? "" : "s"}` +
                (unknownSeasons > 0
                  ? `, ${unknownSeasons} with no figure on record`
                  : "")
              }
            />
          )}
          {currentSeasonRow && (
            <HeaderBox
              label="Current Net Value"
              value={formatScore(currentSeasonRow.netValueScore)}
              caption={currentCap!.season}
            />
          )}
          {bestSeason && (
            <HeaderBox
              label="Best Net Value"
              value={formatScore(bestSeason.netValueScore)}
              caption={bestSeason.season}
            />
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-start gap-8">
        <SimpleTable
          title="Salaries"
          subtitle={
            salaries.length > 0 &&
            "Select a season to compare it against the league."
          }
          columns={getSalariesColumns(currentCap)}
          rows={salaries}
          rowKey={(r) => r.id}
          fit
          rowHref={(r) => `/players/${playerId}?salary=${r.id}`}
          isActive={(r) => r.id === anchor?.id}
        />
        <div className="flex flex-wrap items-start gap-8">
          <CompsTable
            title={`${anchor!.season} Season Cap Comps`}
            subtitle={
              anchorLabel
                ? `${anchorLabel}${truncation(seasonComps)}`
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
        columns={getStatsColumns("per_game")}
        rows={perGame}
        rowKey={(r) => r.id}
      />
      {totals.length > 0 && (
        <SimpleTable
          title="Career Totals"
          columns={getStatsColumns("totals")}
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
