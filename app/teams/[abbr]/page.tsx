import { Suspense } from "react";
import { notFound } from "next/navigation";
import { SimpleTable } from "@/components/SimpleTable";
import { PlayerLink } from "@/components/PlayerLink";
import { RosterSeasonFilter } from "@/components/RosterSeasonFilter";
import { TableOverlay } from "@/components/TableNav";
import type { ColumnDef } from "@/components/DataTable";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatStat,
  formatRank,
  formatScore,
} from "@/lib/format";
import {
  getTeamByAbbr,
  getTeamNetValues,
  getTeamHistory,
  getTeamRoster,
  getTeamRosterSeasons,
  getTeamIdentities,
  type TeamRosterRow,
  type TeamNetValue,
} from "@/lib/db/queries";

type HistoryRow = Awaited<ReturnType<typeof getTeamHistory>>[number] & {
  netValue?: TeamNetValue;
};

/**
 * The mark on a season played under an older identity.
 *
 * The abbreviation, which is what a dense table wants and what the rest of the
 * site shows — "NOH" beside 2012-13 rather than "New Orleans Hornets". It only
 * falls back to the name for the one case an abbreviation cannot carry:
 * Charlotte was the Bobcats from 2004-05 to 2013-14 under the same CHA it uses
 * today, so there the name is the only thing that differs.
 *
 * Null when the row is the franchise as it stands now, which is most of them.
 */
function eraMark(row: HistoryRow, currentAbbr: string, currentName: string) {
  if (row.eraAbbr && row.eraAbbr !== currentAbbr) return row.eraAbbr;
  if (row.eraName && row.eraName !== currentName) return row.eraName;
  return null;
}

function historyColumnsFor(
  currentAbbr: string,
  currentName: string,
): ColumnDef<HistoryRow>[] {
  return [
  {
    key: "season",
    label: "Season",
    // The heading names the franchise as it stands today, so seasons played
    // under an older identity say so here. Only when it differs — marking all
    // 36 of Portland's rows would be noise, and marking Seattle's 18 is the
    // whole point.
    render: (r) => {
      const era = eraMark(r, currentAbbr, currentName);
      return (
        <span className="flex items-center gap-2 whitespace-nowrap">
          {r.champion && (
            <span title="Won the championship" aria-label="Won the championship">
              🏆
            </span>
          )}
          <span
            className={`font-mono text-[0.8125rem] tabular-nums ${
              r.champion ? "font-semibold" : ""
            }`}
          >
            {r.season}
          </span>
          {era && (
            <span
              className="rounded border border-black/15 bg-black/5 px-1 py-px text-[0.625rem] font-medium tracking-wide text-black/50"
              title={r.eraName ?? undefined}
            >
              {era}
            </span>
          )}
        </span>
      );
    },
  },
  { key: "wins", label: "W", align: "right", render: (r) => r.wins ?? "—" },
  { key: "losses", label: "L", align: "right", render: (r) => r.losses ?? "—" },
  {
    key: "winPct",
    label: "Win%",
    align: "right",
    render: (r) =>
      r.winPct === null ? "—" : r.winPct.toFixed(3).replace(/^0/, ""),
  },
  {
    key: "srs",
    label: "SRS",
    align: "right",
    render: (r) =>
      r.srs === null ? "—" : `${r.srs > 0 ? "+" : ""}${formatStat(r.srs)}`,
  },
  {
    key: "payroll",
    label: "Payroll",
    align: "right",
    render: (r) => formatCurrency(r.payroll),
  },
  {
    key: "leagueCap",
    label: "League Cap",
    align: "right",
    render: (r) => formatCurrency(r.leagueCap),
  },
  {
    key: "payrollPctOfCap",
    label: "% of Cap",
    align: "right",
    render: (r) =>
      r.payrollPctOfCap === null ? "—" : `${formatStat(r.payrollPctOfCap)}%`,
  },
  {
    key: "teamNetValue",
    label: "Net Value",
    align: "right",
    description:
      "The roster's Net Value added up — wins the squad returned above what it cost. Counts only players on a full contract.",
    render: (r) => (r.netValue ? formatScore(r.netValue.total) : "—"),
  },
  {
    key: "teamNetValueRank",
    label: "NV Rank",
    align: "right",
    description: "Where that ranked among the league's teams that season.",
    render: (r) => (r.netValue ? formatRank(r.netValue.rank) : "—"),
  },
  {
    key: "deadMoney",
    label: "Dead Money",
    align: "right",
    description:
      "The part of Net Value owed to players this team paid but did not field — bought-out contracts it was still carrying. Always zero or negative, since the money bought no production.",
    render: (r) =>
      !r.netValue || r.netValue.deadMoneyPlayers === 0
        ? "—"
        : formatScore(r.netValue.deadMoney),
  },
  {
    key: "madePlayoffs",
    label: "Playoffs",
    align: "center",
    render: (r) =>
      r.madePlayoffs === null ? "—" : r.madePlayoffs ? "Yes" : "—",
  },
  ];
}

function rosterColumns(showSeason: boolean): ColumnDef<TeamRosterRow>[] {
  return [
    {
      key: "name",
      label: "Player",
      render: (r) => (
        <span className="flex items-center gap-2 whitespace-nowrap">
          <PlayerLink id={r.playerId} name={r.name} />
          {/* Money owed to somebody who played the season somewhere else. The
              stat columns on this row are his, but they were earned for
              another team, so the row says whose money it was rather than
              looking like a player who showed up and did nothing. */}
          {r.playedHere === false && (
            <span
              title="Bought out — this team owed the money, he played elsewhere"
              className="rounded border border-black/20 bg-black/5 px-1 py-px text-[0.625rem] font-medium uppercase tracking-wide text-black/50"
            >
              Waived
            </span>
          )}
        </span>
      ),
    },
    ...(showSeason
      ? [
          {
            key: "season",
            label: "Season",
            render: (r: TeamRosterRow) => (
              <span className="font-mono text-[0.8125rem] tabular-nums">
                {r.season}
              </span>
            ),
          },
        ]
      : []),
    {
      key: "salary",
      label: "Salary",
      align: "right",
      render: (r) => formatCurrency(r.salary),
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
      key: "netValueShare",
      label: "Net Value",
      align: "right",
      description:
        "This team's share of the player's Net Value. On a bought-out contract it is the charge alone, since the production went to whoever he played for.",
      render: (r) => formatScore(r.netValueShare),
    },
    {
      key: "gp",
      label: "GP",
      align: "right",
      // Dashed out for a waived player: the games are real but they were
      // played for another team, and printing them here reads as this team's.
      render: (r) => (r.playedHere === false ? "—" : formatNumber(r.gp)),
    },
    {
      key: "mp",
      label: "MPG",
      align: "right",
      description: "Minutes played. Per game.",
      render: (r) => (r.playedHere === false ? "—" : formatStat(r.mp)),
    },
    {
      key: "pts",
      label: "PTS",
      align: "right",
      description: "Points. Per game.",
      render: (r) => (r.playedHere === false ? "—" : formatStat(r.pts)),
    },
    {
      key: "reb",
      label: "REB",
      align: "right",
      description: "Total rebounds. Per game.",
      render: (r) => (r.playedHere === false ? "—" : formatStat(r.reb)),
    },
    {
      key: "ast",
      label: "AST",
      align: "right",
      description: "Assists. Per game.",
      render: (r) => (r.playedHere === false ? "—" : formatStat(r.ast)),
    },
  ];
}

/**
 * The roster table, awaiting its own query.
 *
 * Split out so the season filter can restream just this much of the page. Its
 * subtitle counts the rows, so it has to live on this side of the await.
 */
async function RosterTable({
  rosterPromise,
  rosterSeason,
}: {
  rosterPromise: Promise<TeamRosterRow[]>;
  rosterSeason: string;
}) {
  const roster = await rosterPromise;
  return (
    <SimpleTable
      subtitle={
        rosterSeason === "ALL"
          ? `Everyone this team paid, ${roster.length} player-seasons.`
          : `${roster.length} players paid in ${rosterSeason}.`
      }
      columns={rosterColumns(rosterSeason === "ALL")}
      rows={roster}
      rowKey={(r) => r.id}
      emptyMessage="No salary data for this team and season."
    />
  );
}

/** Holds the roster's space on a cold load, before the query comes back. */
function RosterFallback() {
  return (
    <div className="mb-8">
      <div className="mb-2 min-h-5 text-sm text-white/60">Loading roster…</div>
      <div className="h-96 rounded-lg border-2 border-accent bg-surface" />
    </div>
  );
}

/**
 * A labelled figure in the header strip.
 *
 * Laid out the way the player page lays its header boxes out: on a phone each
 * box is a full-width row with the label on the left and the number hard
 * right, so four of them read as a list instead of a cramped grid. From `md`
 * they sit side by side and stack label over value.
 */
function Stat({
  label,
  value,
  caption,
}: {
  label: string;
  value: string;
  caption?: string;
}) {
  return (
    <div className="w-full rounded-lg border-2 border-accent bg-background-box px-3 py-2 md:w-auto md:px-4">
      <div className="flex items-center justify-between gap-3 md:block">
        <div className="text-sm text-white/60">
          {label}
          <div className="text-xs text-white/40 md:hidden">{caption}</div>
        </div>
        <div className="shrink-0 text-right font-mono text-lg font-semibold tabular-nums text-accent md:text-left md:text-xl">
          {value}
        </div>
      </div>
      {/* Reserved even when empty so boxes beside each other stay level. */}
      <div className="hidden min-h-4 text-xs text-white/40 md:block">
        {caption}
      </div>
    </div>
  );
}

export default async function TeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ abbr: string }>;
  searchParams: Promise<{ roster?: string }>;
}) {
  const [{ abbr }, sp] = await Promise.all([params, searchParams]);
  const team = await getTeamByAbbr(abbr);
  if (!team) notFound();

  const [rawHistory, rosterSeasons, teamNetValues, identities] =
    await Promise.all([
      getTeamHistory(team.id),
      getTeamRosterSeasons(team.abbr),
      getTeamNetValues(team.abbr),
      getTeamIdentities(team.id),
    ]);
  // Only the names it no longer uses; the current one is the heading.
  const formerNames = identities.filter((i) => i.lastSeason !== null);
  const netValueBySeason = new Map(teamNetValues.map((n) => [n.season, n]));
  const history: HistoryRow[] = rawHistory.map((h) => ({
    ...h,
    netValue: netValueBySeason.get(h.season),
  }));
  // Newest first from the query, so this is the latest season actually played.
  const latestNetValue = teamNetValues[0] ?? null;

  const rosterSeason =
    sp.roster && (sp.roster === "ALL" || rosterSeasons.includes(sp.roster))
      ? sp.roster
      : (rosterSeasons[0] ?? "ALL");
  // Deliberately not awaited. Handing the promise to a child inside Suspense
  // lets the rest of the page render and reach the browser while this query is
  // still running, so changing the season restreams the roster alone instead
  // of holding up everything above it.
  const rosterPromise = getTeamRoster(team.abbr, rosterSeason);

  const titles = history.filter((h) => h.champion);
  const playoffRuns = history.filter((h) => h.madePlayoffs).length;
  const totalWins = history.reduce((n, h) => n + (h.wins ?? 0), 0);
  const totalLosses = history.reduce((n, h) => n + (h.losses ?? 0), 0);
  const seasonsCovered = history.length;

  return (
    <div className="mx-auto w-full min-w-0 max-w-350 p-6 text-white">
      <h1 className="min-w-0 wrap-break-word text-2xl font-semibold tracking-tight">
        {team.name}
      </h1>
      {/* A franchise keeps one page across every name it has used, so the page
          says which those were rather than leaving a reader to wonder why the
          Thunder have eighteen seasons in Seattle. */}
      {formerNames.length > 0 && (
        <p className="mt-1 text-sm text-white/50">
          {formerNames
            .map((i) => `${i.name} (${i.abbr}) through ${i.lastSeason}`)
            .join(" \u00b7 ")}
        </p>
      )}
      <div className="mb-6" />

      <div className="mb-8 flex w-full flex-col items-stretch gap-3 md:w-fit md:flex-row">
        <Stat
          label="Record"
          value={`${totalWins}-${totalLosses}`}
          caption={`Since 1991 (${((totalWins / (totalWins + totalLosses)) * 100).toFixed(1)}%)`}
        />
        <Stat
          label="Playoff seasons"
          value={`${playoffRuns} of ${seasonsCovered}`}
          caption={`Since 1991 (${((playoffRuns / seasonsCovered) * 100).toFixed(1)}%)`}
        />
        <Stat
          label="Championships"
          value={String(titles.length)}
          caption="Since 1991"
        />
        {latestNetValue && (
          <Stat
            label="Team Net Value"
            value={formatScore(latestNetValue.total)}
            caption={`#${latestNetValue.rank} of ${latestNetValue.teams} for ${latestNetValue.season}`}
          />
        )}
        {latestNetValue && latestNetValue.deadMoneyPlayers > 0 && (
          <Stat
            label="Dead money"
            value={formatScore(latestNetValue.deadMoney)}
            caption={`${latestNetValue.deadMoneyPlayers} bought-out contract${
              latestNetValue.deadMoneyPlayers === 1 ? "" : "s"
            }`}
          />
        )}
      </div>

      {/* Deliberately outside TableOverlay. Nothing on this page filters the
          history, so dimming it whenever the roster season changes was the
          whole reason the page looked like it was reloading. */}
      <SimpleTable
        title="Payroll by Season"
        subtitle="Payroll against the league cap, with how the team finished."
        columns={historyColumnsFor(team.abbr, team.name)}
        rows={history}
        rowKey={(r) => r.season}
        emptyMessage="No seasons on file for this team."
      />

      <div className="mb-2 flex min-w-0 flex-col items-stretch justify-between gap-4 md:flex-row md:items-center">
        <h2 className="text-lg font-semibold text-white">Roster</h2>
        <RosterSeasonFilter
          abbr={team.abbr}
          seasons={rosterSeasons}
          currentSeason={rosterSeason}
        />
      </div>
      <TableOverlay>
        <Suspense fallback={<RosterFallback />}>
          <RosterTable
            rosterPromise={rosterPromise}
            rosterSeason={rosterSeason}
          />
        </Suspense>
      </TableOverlay>
    </div>
  );
}
