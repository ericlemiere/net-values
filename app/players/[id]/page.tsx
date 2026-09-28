import Link from "next/link";
import { notFound } from "next/navigation";
import { SeasonTeams, TeamLink } from "@/components/TeamLink";
import { AwardBadges, CareerAwardBadges } from "@/components/AwardBadges";
import { SeasonLink } from "@/components/SeasonLink";
import { PlayerHeadshot } from "@/components/PlayerHeadshot";
import { SimpleTable } from "@/components/SimpleTable";
import { SectionHeading } from "@/components/SectionHeading";
import { CompsTable } from "@/components/CompsTable";
import type { ColumnDef } from "@/components/DataTable";
import {
  formatNumber,
  formatStat,
  formatCurrency,
  formatPercent,
  formatRank,
  formatScore,
  formatSignedCurrency,
  payGapClass,
} from "@/lib/format";
import { GLOSSARY, withBasis } from "@/lib/glossary";
import {
  getCurrentCap,
  getAwardsForRows,
  getPlayerAwards,
  getPlayerById,
  getPlayerPositionForSeason,
  getPlayerCareerStatsTotals,
  getPlayerCareerStatsPerGame,
  getPlayerCareerAdvancedStats,
  getPlayerCareerSalaries,
  getPlayerTeamSplits,
  getSalaryComps,
  type PlayerAward,
  type PlayerContract,
} from "@/lib/db/queries";
import { POSITION_NAMES, type Position } from "@/lib/positions";
import { PAGE_COLUMN, TABLE_BREAKOUT } from "@/lib/layout";
import { SITE_URL, jsonLd, pageMetadata } from "@/lib/site";

/** Percentage points either side of the anchor season that still count as a comp. */
const COMP_TOLERANCE = 0.5;
const COMP_LIMIT = 50;

type StatsRow = Awaited<ReturnType<typeof getPlayerCareerStatsPerGame>>[number];
type AdvRow = Awaited<ReturnType<typeof getPlayerCareerAdvancedStats>>[number];
/**
 * A salary log row. `part` is set only on the rows folded under a season: one
 * team's piece of a season split between several.
 */
type SalRow = Awaited<ReturnType<typeof getPlayerCareerSalaries>>[number] & {
  part?: PlayerContract;
};
type SplitRow = Awaited<ReturnType<typeof getPlayerTeamSplits>>[number];

/** Fields every table's split row takes straight from the stint. */
function splitIdentity(s: SplitRow) {
  return {
    id: s.id,
    season: s.season,
    team: s.team,
    teamLabel: s.teamLabel,
    teams: null,
    pos: s.pos,
    age: s.age,
    gp: s.gp,
  };
}

/**
 * A traded player's stints, shaped as rows of the three stats tables and
 * keyed by season, for SimpleTable to fold under each season row.
 *
 * Stints are stored as totals, so the Career Averages rows divide by games
 * here. The percentages are already rates and pass through untouched.
 */
function groupSplits(splits: SplitRow[]) {
  const perGame = new Map<string, StatsRow[]>();
  const totals = new Map<string, StatsRow[]>();
  const advanced = new Map<string, AdvRow[]>();
  const push = <R,>(map: Map<string, R[]>, season: string, row: R) =>
    map.set(season, [...(map.get(season) ?? []), row]);

  for (const s of splits) {
    const box = {
      ...splitIdentity(s),
      gs: s.gs,
      mp: s.mp,
      fgm: s.fgm,
      fga: s.fga,
      fgPct: s.fgPct,
      fg3m: s.fg3m,
      fg3a: s.fg3a,
      fg3Pct: s.fg3Pct,
      fg2m: s.fg2m,
      fg2a: s.fg2a,
      fg2Pct: s.fg2Pct,
      efgPct: s.efgPct,
      ftm: s.ftm,
      fta: s.fta,
      ftPct: s.ftPct,
      orb: s.orb,
      drb: s.drb,
      reb: s.reb,
      ast: s.ast,
      stl: s.stl,
      blk: s.blk,
      tov: s.tov,
      pf: s.pf,
      pts: s.pts,
    };
    const each = (v: number | null) => (v === null || !s.gp ? null : v / s.gp);
    push(totals, s.season, box);
    push(perGame, s.season, {
      ...box,
      mp: each(box.mp),
      fgm: each(box.fgm),
      fga: each(box.fga),
      fg3m: each(box.fg3m),
      fg3a: each(box.fg3a),
      fg2m: each(box.fg2m),
      fg2a: each(box.fg2a),
      ftm: each(box.ftm),
      fta: each(box.fta),
      orb: each(box.orb),
      drb: each(box.drb),
      reb: each(box.reb),
      ast: each(box.ast),
      stl: each(box.stl),
      blk: each(box.blk),
      tov: each(box.tov),
      pf: each(box.pf),
      pts: each(box.pts),
    });
    push(advanced, s.season, {
      ...splitIdentity(s),
      mp: s.mp === null ? null : Math.round(s.mp),
      per: s.per,
      tsPct: s.tsPct,
      usgPct: s.usgPct,
      ows: s.ows,
      dws: s.dws,
      ws: s.ws,
      obpm: s.obpm,
      dbpm: s.dbpm,
      bpm: s.bpm,
      vorp: s.vorp,
    });
  }
  return { perGame, totals, advanced };
}

// Career Averages and Career Totals share this shape but not its precision:
// a per-game 10.8 FGM is fractional, a season total of 1034 is not.
function getStatsColumns(mode: "per_game" | "totals"): ColumnDef<StatsRow>[] {
  const stat = mode === "totals" ? formatNumber : formatStat;
  const note = (key: string) => withBasis(key, mode);
  return [
    {
      key: "season",
      label: "Season",
      render: (r) => <SeasonLink season={r.season} />,
    },
    {
      key: "team",
      label: "Team",
      render: (r) => (
        <SeasonTeams abbr={r.team} label={r.teamLabel} teams={r.teams} />
      ),
    },
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
      definition: note("mp"),
      label: "MP",
      align: "right",
      render: (r) => formatStat(r.mp),
    },
    {
      key: "fgm",
      definition: note("fgm"),
      label: "FGM",
      align: "right",
      render: (r) => stat(r.fgm),
    },
    {
      key: "fga",
      definition: note("fga"),
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
      definition: note("fg3m"),
      label: "3PM",
      align: "right",
      render: (r) => stat(r.fg3m),
    },
    {
      key: "fg3a",
      definition: note("fg3a"),
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
      definition: note("fg2m"),
      label: "2PM",
      align: "right",
      render: (r) => stat(r.fg2m),
    },
    {
      key: "fg2a",
      definition: note("fg2a"),
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
      definition: note("ftm"),
      label: "FTM",
      align: "right",
      render: (r) => stat(r.ftm),
    },
    {
      key: "fta",
      definition: note("fta"),
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
      definition: note("orb"),
      label: "OREB",
      align: "right",
      render: (r) => stat(r.orb),
    },
    {
      key: "drb",
      definition: note("drb"),
      label: "DREB",
      align: "right",
      render: (r) => stat(r.drb),
    },
    {
      key: "reb",
      definition: note("reb"),
      label: "REB",
      align: "right",
      render: (r) => stat(r.reb),
    },
    {
      key: "ast",
      definition: note("ast"),
      label: "AST",
      align: "right",
      render: (r) => stat(r.ast),
    },
    {
      key: "stl",
      definition: note("stl"),
      label: "STL",
      align: "right",
      render: (r) => stat(r.stl),
    },
    {
      key: "blk",
      definition: note("blk"),
      label: "BLK",
      align: "right",
      render: (r) => stat(r.blk),
    },
    {
      key: "tov",
      definition: note("tov"),
      label: "TOV",
      align: "right",
      render: (r) => stat(r.tov),
    },
    {
      key: "pf",
      definition: note("pf"),
      label: "PF",
      align: "right",
      render: (r) => stat(r.pf),
    },
    {
      key: "pts",
      definition: note("pts"),
      label: "PTS",
      align: "right",
      render: (r) => stat(r.pts),
    },
  ];
}

const advancedColumns: ColumnDef<AdvRow>[] = [
  {
    key: "season",
    label: "Season",
    render: (r) => <SeasonLink season={r.season} />,
  },
  {
    key: "team",
    label: "Team",
    render: (r) => (
      <SeasonTeams abbr={r.team} label={r.teamLabel} teams={r.teams} />
    ),
  },
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

/**
 * The team cell of the salary log: who he played for, and who else was paying.
 *
 * A season with one contract is just the team, which is almost all of them. A
 * bought-out season names the team he played for and lists the money still
 * owed underneath, because a $36.6M salary with Portland's name on it is
 * otherwise unreadable — the figure belongs to two teams at once and only one
 * of them ever saw him play.
 */
/**
 * Season and team-abbr cells in mono, matching the size `cellClass` gives the
 * numeric columns. Those columns get it from their `align`; these two are
 * left-aligned, so they have to ask for it.
 */
const MONO_CELL = "font-mono text-[0.8125rem]";

function ContractTeams({ row }: { row: SalRow }) {
  if (row.part)
    return (
      <span className="whitespace-nowrap">
        <span className={MONO_CELL}>
          <TeamLink abbr={row.team} label={row.teamLabel} />
        </span>
        {!row.part.playedHere && (
          <span
            className="ml-1 text-xs text-black/50"
            title="Still owed by a team that had waived him. He played elsewhere."
          >
            waived
          </span>
        )}
      </span>
    );
  return (
    <span className={MONO_CELL}>
      <SeasonTeams abbr={row.team} label={row.teamLabel} teams={row.teams} />
    </span>
  );
}

/** One contract of a season as a row of its own, under the season row. */
function contractRow(row: SalRow, c: PlayerContract): SalRow {
  return {
    ...row,
    part: c,
    team: c.team,
    teamLabel: c.teamLabel,
    teams: null,
    contracts: [],
    salary: c.salary,
    salaryRank: null,
    teamPayroll: c.teamPayroll ?? null,
    pctOfTeamCap:
      c.salary !== null && c.teamPayroll
        ? Math.round((10000 * c.salary) / c.teamPayroll) / 100
        : null,
    pctOfLeagueCap:
      c.salary !== null && row.leagueCap
        ? Math.round((10000 * c.salary) / row.leagueCap) / 100
        : null,
    // A waived contract isn't his to be judged on (the model charges it to
    // the team that waived him), so it carries no Net Value on his page.
    netValueScore: c.playedHere ? (c.score ?? null) : null,
    netValueRank: null,
    deservedSalary: null,
    seasonSalary: null,
  };
}

/**
 * The per-team rows folded under a traded season, behind its +/− button: what
 * each team he played for paid and its piece of his Net Value.
 */
function salarySplits(row: SalRow): SalRow[] | undefined {
  const played = (row.contracts ?? []).filter((c) => c.playedHere);
  return played.length > 1 ? played.map((c) => contractRow(row, c)) : undefined;
}

/**
 * A waived contract, always shown under the season it was paid in: money a
 * team still owed him after letting him go, which the season row above leaves
 * out. Damian Lillard's 2025-26 is Portland's $14.1M on the season row and
 * Milwaukee's $22.5M under it.
 */
function waivedContracts(row: SalRow): SalRow[] | undefined {
  const waived = (row.contracts ?? []).filter((c) => !c.playedHere && c.salary);
  return waived.length > 0 ? waived.map((c) => contractRow(row, c)) : undefined;
}

function getSalariesColumns(
  currentCap: Awaited<ReturnType<typeof getCurrentCap>>,
  awardsBySeason: Map<string, PlayerAward[]>,
): ColumnDef<SalRow>[] {
  return [
    {
      key: "season",
      label: "Season",
      // Opted out of the row-wide link, which anchors the comps below: an
      // anchor inside an anchor is invalid and the browser unnests it.
      noRowLink: true,
      // Badges ride the season rather than a name, because every row here is
      // the same player: what changes down the column is which year he won
      // something. It also puts the honors beside the contract that paid for
      // them, which is the comparison this table exists to make.
      render: (r) => (
        <span className="whitespace-nowrap">
          <span className={`${MONO_CELL} tabular-nums`}>
            <SeasonLink season={r.season} />
          </span>
          <AwardBadges awards={awardsBySeason.get(r.season) ?? []} />
        </span>
      ),
    },
    {
      key: "team",
      label: "Team",
      align: "center",
      noRowLink: true,
      render: (r) => <ContractTeams row={r} />,
    },
    {
      key: "salary",
      label: "Salary",
      align: "right",
      definition: GLOSSARY.salarySeasonTotal,
      render: (r) =>
        r.part?.estimated ? (
          // Marked with a dotted underline rather than a "~": a character
          // would widen the column the moment the row opened and shift the
          // whole table, where an underline takes no room.
          <span
            className="cursor-help underline decoration-black/40 decoration-dotted underline-offset-2"
            title="Estimated: his season salary is on file under one team, so it is split across his teams by days on each roster."
          >
            {formatCurrency(r.salary)}
          </span>
        ) : (
          formatCurrency(r.salary)
        ),
    },
    {
      key: "salaryRank",
      label: "Pay Rank",
      align: "right",
      render: (r) => formatRank(r.salaryRank),
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
      label: "Today's Equivalent",
      align: "right",
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
    {
      key: "deservedSalary",
      label: "Deserved Pay",
      align: "right",
      render: (r) => formatCurrency(r.deservedSalary),
    },
    {
      key: "payDifference",
      label: "Difference",
      align: "right",
      // Against the season's own cap, so the bar for "a lot of money" moves
      // with the league instead of staying fixed in today's dollars.
      render: (r) => {
        const gap =
          r.deservedSalary === null || r.seasonSalary === null
            ? null
            : r.deservedSalary - r.seasonSalary;
        return (
          <span className={payGapClass(gap, r.leagueCap)}>
            {formatSignedCurrency(gap)}
          </span>
        );
      },
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
    <div className="w-full rounded-lg border-2 border-accent bg-background-box px-3 py-2 md:w-auto md:px-4 md:text-right">
      <div className="flex items-center md:items-start justify-between gap-3 md:block">
        <div className="text-sm text-white/60">
          {label}
          <div className="text-xs text-white/40 md:hidden">{caption}</div>
        </div>
        <div className="shrink-0 text-right font-mono text-lg font-semibold tabular-nums text-accent md:text-2xl">
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

/**
 * The way into /price-check. A header box like its neighbors, but filled in
 * the accent and linked, so it reads as the one thing up here you can press —
 * and it leads with a real figure, which does more to invite a click than a
 * button label could.
 */
function PriceCheckBox({
  href,
  value,
  caption,
}: {
  href: string;
  value: string;
  caption: string;
}) {
  return (
    <Link
      href={href}
      // Hover stays yellow and grows a ring and a glow outside the box, which
      // none of its neighbors do. Swapping it to their dark fill made it look
      // like one of them, and running the fill and the text through opposite
      // color changes at once passed through a muddy frame that read as a
      // flicker.
      className="group w-full rounded-lg border-2 border-accent bg-accent px-3 py-2 text-accent-foreground transition-shadow duration-200 ease-out hover:shadow-[0_0_0_3px_var(--background),0_0_0_5px_var(--accent),0_0_24px_4px_color-mix(in_srgb,var(--accent)_45%,transparent)] focus-visible:shadow-[0_0_0_3px_var(--background),0_0_0_5px_var(--accent)] focus-visible:outline-none md:w-auto md:px-4 md:text-right"
    >
      <div className="flex items-center justify-between gap-3 md:block md:items-start">
        <div className="text-sm font-semibold">
          Price Check{" "}
          <span
            aria-hidden="true"
            className="inline-block transition-transform duration-200 ease-out group-hover:translate-x-1"
          >
            &rarr;
          </span>
          <div className="text-xs font-normal opacity-60 md:hidden">
            {caption}
          </div>
        </div>
        <div className="shrink-0 text-right font-mono text-lg font-semibold tabular-nums md:text-2xl">
          {value}
        </div>
      </div>
      <div className="hidden min-h-4 text-xs opacity-60 md:block">
        {caption}
      </div>
    </Link>
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

function headshotUrl(nbaPersonId: number | null) {
  return nbaPersonId
    ? `https://cdn.nba.com/headshots/nba/latest/1040x760/${nbaPersonId}.png`
    : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const playerId = Number((await params).id);
  const player = Number.isInteger(playerId)
    ? await getPlayerById(playerId)
    : undefined;
  if (!player) return { title: "Player not found" };
  const headshot = headshotUrl(player.nbaPersonId);
  return pageMetadata({
    title: `${player.name} Salary, Stats & Net Value`,
    description: `${player.name}'s NBA contract history, career stats and Net Value by season: what he produced on the court against what his salary paid for, with salary comparisons.`,
    // The ?salary= comp anchor is a view of this page, not a page of its own.
    path: `/players/${player.id}`,
    image: headshot
      ? { url: headshot, width: 1040, height: 760, alt: player.name }
      : undefined,
  });
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

  const [
    perGame,
    totals,
    advanced,
    salaries,
    currentCap,
    careerAwards,
    teamSplits,
  ] = await Promise.all([
    getPlayerCareerStatsPerGame(playerId),
    getPlayerCareerStatsTotals(playerId),
    getPlayerCareerAdvancedStats(playerId),
    getPlayerCareerSalaries(playerId),
    getCurrentCap(),
    getPlayerAwards(playerId),
    getPlayerTeamSplits(playerId),
  ]);
  const splits = groupSplits(teamSplits);

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
  // The position he was listed at that season, which splits the historical
  // comps. Null for a player who never took the floor, and the position table
  // then has nothing to show — see getSalaryComps.
  const anchorPos = anchor
    ? await getPlayerPositionForSeason(playerId, anchor.season)
    : null;

  const [seasonComps, teamComps, positionComps, otherComps] =
    anchor === null || anchorPct === null
      ? [null, null, null, null]
      : await Promise.all(
          (["season", "team", "position", "other"] as const).map((scope) =>
            getSalaryComps({
              playerId,
              targetPct: anchorPct,
              season: anchor.season,
              scope,
              team: anchor.team,
              pos: anchorPos,
              tolerance: COMP_TOLERANCE,
              limit: COMP_LIMIT,
              anchorNetValue: anchor.netValueScore,
            }),
          ),
        );

  // Badges for all four comps tables, in one lookup.
  const compAwards = await getAwardsForRows([
    ...(seasonComps?.rows ?? []),
    ...(teamComps?.rows ?? []),
    ...(positionComps?.rows ?? []),
    ...(otherComps?.rows ?? []),
  ]);

  // His own honors, filed by season for the badges in the salary log.
  const awardsBySeason = new Map<string, PlayerAward[]>();
  for (const a of careerAwards) {
    const list = awardsBySeason.get(a.season) ?? [];
    list.push(a);
    awardsBySeason.set(a.season, list);
  }

  // Headings for the two comps tables that are cut by something other than the
  // season. Both fall back in the title itself when there is nothing to name.
  const teamName = anchor?.teamLabel ?? anchor?.team ?? null;
  const positionName = anchorPos
    ? (POSITION_NAMES[anchorPos as Position] ?? anchorPos)
    : null;

  // All four comps tables hang off the same anchor, so they share a subtitle stem.
  const anchorLabel =
    anchorPct === null
      ? null
      : `${anchorPct.toFixed(2)}% of the cap \u00b1 ${COMP_TOLERANCE}`;
  // Summed from the career log already fetched above rather than a second
  // query. Seasons with no figure on record contribute nothing, so the box
  // says how many it covers instead of presenting a short total as complete.
  const paidSeasons = salaries.filter((r) => r.paidTotal !== null);
  // Everything he was paid, waived contracts included: the Salary column
  // leaves those out, but he was still paid them.
  const careerEarnings = paidSeasons.reduce((sum, r) => sum + r.paidTotal!, 0);
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

  // The Price Check tile's teaser: what his latest paid season cost per point,
  // the same season /price-check itself opens on.
  const payBySeason = new Map(salaries.map((r) => [r.season, r.salary]));
  const priceTeaser =
    [...totals]
      .reverse()
      .map((t) => ({
        season: t.season,
        salary: payBySeason.get(t.season) ?? null,
        pts: t.pts,
      }))
      .filter((t) => t.salary && t.pts)
      .map((t) => ({ season: t.season, perPoint: t.salary! / t.pts! }))[0] ??
    null;

  const truncation = (comps: { rows: unknown[]; totalCount: number } | null) =>
    comps && comps.totalCount > comps.rows.length
      ? ` \u2014 closest ${comps.rows.length} of ${comps.totalCount}`
      : "";

  const headshot = headshotUrl(player.nbaPersonId);

  return (
    <div className={PAGE_COLUMN}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd({
          "@context": "https://schema.org",
          "@type": "Person",
          name: player.name,
          url: `${SITE_URL}/players/${player.id}`,
          jobTitle: "Basketball player",
          ...(headshot && { image: headshot }),
        })}
      />
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div className="flex min-w-0 items-center gap-4">
          <PlayerHeadshot nbaPersonId={player.nbaPersonId} name={player.name} />
          <div className="min-w-0">
            <h1 className="min-w-0 wrap-break-word text-2xl font-semibold tracking-tight">
              {player.name}
            </h1>
            {careerAwards.length > 0 && (
              <div className="mt-2">
                <CareerAwardBadges awards={careerAwards} />
              </div>
            )}
          </div>
        </div>
        <div className="flex w-full flex-col items-stretch gap-3 md:w-auto md:flex-row">
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
          {priceTeaser && (
            <PriceCheckBox
              href={`/price-check?p1=${player.id}&s1=${priceTeaser.season}&stat=pts`}
              value={`$${Math.round(priceTeaser.perPoint).toLocaleString("en-US")}`}
              caption={`per point, ${priceTeaser.season}`}
            />
          )}
        </div>
      </div>
      {/* Three sections, each opened by a rule: what he was paid, who else was
          paid like that, and what he did for it. `items-start` rather than the
          default stretch, so the salary log keeps its fitted width instead of
          being pulled out to the page. */}
      <div className="flex min-w-0 flex-col items-start gap-4">
        <SectionHeading
          subtitle={
            salaries.length > 0 &&
            "Select a season to compare it against the league."
          }
        >
          Salaries
        </SectionHeading>
        <SimpleTable<SalRow>
          columns={getSalariesColumns(currentCap, awardsBySeason)}
          rows={salaries}
          rowKey={(r) => `${r.id}-${r.part?.team ?? ""}`}
          splits={salarySplits}
          splitsLabel="pay and Net Value by team"
          attached={waivedContracts}
          fit
          breakout
          rowHref={(r) => `/players/${playerId}?salary=${r.id}`}
          isActive={(r) => r.id === anchor?.id}
        />
        <SectionHeading
          subtitle={
            anchorLabel
              ? `Other players who had contracts that were ${anchorLabel}, viewed by season, team, position, and everyone else.`
              : undefined
          }
        >
          Comparisons
        </SectionHeading>
        {/* Four panels, each a narrower cut of the same cap window: two up on
            a laptop, one above the other on a phone. A grid rather than a
            wrapping flex row so the two in a row keep the same width whatever
            their rows are. The top row is the two cuts that are usually a
            handful of names, so they get shorter panels and the page does not
            open on two thirds of a screen of white. */}
        <div className="mt-4 grid w-full min-w-0 grid-cols-1 items-start gap-x-8 lg:grid-cols-2">
          <CompsTable
            // A player with no salary we have a league cap for has no anchor
            // at all, and the four panels below say so rather than throwing on
            // the way to a heading.
            title={
              anchor ? `${anchor.season} Season Cap Comps` : "Season Cap Comps"
            }
            // The cap window they all share is stated once, in the section
            // heading above, so each panel only has to say how it is cut.
            subtitle={
              anchor
                ? `The rest of the league${truncation(seasonComps)}`
                : undefined
            }
            rows={seasonComps?.rows ?? []}
            awards={compAwards}
            showSeason={false}
            short
            emptyMessage={
              seasonComps
                ? "Nobody else took up this share of the cap that season."
                : "No salary with a known league cap to compare."
            }
          />
          <CompsTable
            title={`${teamName ?? "Team"} Historical Cap Comps`}
            subtitle={
              anchor
                ? `Every other season, same franchise${truncation(teamComps)}`
                : undefined
            }
            rows={teamComps?.rows ?? []}
            awards={compAwards}
            short
            emptyMessage={
              anchor?.team
                ? "This franchise has never paid anyone else this share of the cap."
                : "No team on record for this season."
            }
          />
          <CompsTable
            title={`${positionName ?? "Positional"} Historical Cap Comps`}
            subtitle={
              anchor
                ? `Every other season, same position${truncation(positionComps)}`
                : undefined
            }
            rows={positionComps?.rows ?? []}
            awards={compAwards}
            emptyMessage={
              anchorPos
                ? "Nobody else at this position has been paid this share of the cap."
                : "No position on record for this season."
            }
          />
          <CompsTable
            title="Everyone Else, Historically"
            subtitle={
              anchor
                ? `Every other season, team and position aside${truncation(otherComps)}`
                : undefined
            }
            rows={otherComps?.rows ?? []}
            awards={compAwards}
            emptyMessage={
              otherComps
                ? "The two tables above already hold every comp there is."
                : "No salary with a known league cap to compare."
            }
          />
        </div>
        <SectionHeading subtitle="Season by season, then the rate stats behind them.">
          Stats
        </SectionHeading>
        {/* One wrapper around all three, rather than `breakout` on each: sized
            together they keep a common right edge, which is the whole reason
            they read as one block. */}
        <div className={`mt-4 w-full min-w-0 ${TABLE_BREAKOUT}`}>
          <SimpleTable
            title="Career Averages"
            columns={getStatsColumns("per_game")}
            rows={perGame}
            rowKey={(r) => r.id}
            splits={(r) => splits.perGame.get(r.season)}
          />
          {totals.length > 0 && (
            <SimpleTable
              title="Career Totals"
              columns={getStatsColumns("totals")}
              rows={totals}
              rowKey={(r) => r.id}
              splits={(r) => splits.totals.get(r.season)}
            />
          )}
          <SimpleTable
            title="Advanced Stats"
            columns={advancedColumns}
            rows={advanced}
            rowKey={(r) => r.id}
            splits={(r) => splits.advanced.get(r.season)}
          />
        </div>
      </div>
    </div>
  );
}
