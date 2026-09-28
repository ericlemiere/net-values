import { DataTable, type ColumnDef } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { PlayerLink } from "@/components/PlayerLink";
import { awardKey, type Award } from "@/lib/awards";
import { SeasonTeams } from "@/components/TeamLink";
import { SeasonLink } from "@/components/SeasonLink";
import {
  formatCurrency,
  formatPercent,
  formatScore,
  formatSignedCurrency,
  payGapClass,
} from "@/lib/format";
import {
  getCurrentCap,
  getLeagueCap,
  getSalaries,
  getSalariesSeasons,
  getTeams,
  PAGE_SIZE,
  getAwardsForRows,
  type PlayerContract,
  type SalaryRow,
} from "@/lib/db/queries";
import { parsePosition } from "@/lib/positions";
import { GLOSSARY } from "@/lib/glossary";
import { PAGE_COLUMN } from "@/lib/layout";
import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata({
  title: "NBA Salaries",
  description:
    "Every NBA player salary since 1990-91 with team payroll, share of the salary cap, deserved pay and Net Value, showing who was overpaid and who was a bargain.",
  path: "/salaries",
});

/** `part` is set on the rows set under a season: one team's piece of it. */
type Row = SalaryRow & { part?: PlayerContract };

/** One contract of a season as a row under it, like the player page's. */
function contractRow(row: Row, c: PlayerContract): Row {
  return {
    ...row,
    part: c,
    id: row.id,
    team: c.team,
    teamLabel: c.teamLabel,
    teams: null,
    contracts: [],
    salary: c.salary,
    estimated: Boolean(c.estimated),
    playedHere: c.playedHere,
    salaryRank: null,
    netValueRank: null,
    teamPayroll: c.teamPayroll ?? null,
    pctOfTeamCap:
      c.salary !== null && c.teamPayroll
        ? Math.round((10000 * c.salary) / c.teamPayroll) / 100
        : null,
    pctOfLeagueCap:
      c.salary !== null && row.leagueCap
        ? Math.round((10000 * c.salary) / row.leagueCap) / 100
        : null,
    // A waived contract isn't the player's to be judged on; the model charges
    // it to the team that waived him.
    netValueScore: c.playedHere ? (c.score ?? null) : null,
    deservedSalary: null,
    payDifference: null,
  };
}

/** A traded season's teams, behind its +/− button. */
function tradedSplits(row: Row): Row[] | undefined {
  const played = row.contracts.filter((c) => c.playedHere);
  return played.length > 1 ? played.map((c) => contractRow(row, c)) : undefined;
}

/** A waived contract, always shown under the season it was paid in. */
function waivedContracts(row: Row): Row[] | undefined {
  const waived = row.contracts.filter((c) => !c.playedHere && c.salary);
  return waived.length > 0 ? waived.map((c) => contractRow(row, c)) : undefined;
}

function getColumns(
  showSeason: boolean,
  showCapAdjusted: boolean,
  currentCap: Awaited<ReturnType<typeof getCurrentCap>>,
  awards: Map<string, Award[]>,
): ColumnDef<Row>[] {
  // Restating an old salary at today's cap needs both the player's share of
  // his own season's cap and the cap we're restating into.
  const capAdjusted = (r: Row) =>
    // Scaled from the raw salary and the two caps rather than from % of League
    // Cap, which is rounded to two decimals; multiplying that back out lands up
    // to ~$8,000 away from the real figure.
    currentCap?.leagueCap && r.salary !== null && r.leagueCap
      ? formatCurrency(
          Math.round((r.salary * currentCap.leagueCap) / r.leagueCap),
        )
      : "—";
  return [
    // Name stays left-aligned (and the row-number column, which DataTable
    // renders itself); every other column is centered.
    {
      key: "name",
      label: "Name",
      defaultDir: "asc",
      render: (r) => (
        <PlayerLink
          id={r.playerId}
          name={r.name}
          awards={awards.get(awardKey(r.playerId, r.season))}
        />
      ),
    },
    ...(showSeason
      ? [
          {
            key: "season",
            label: "Season",
            align: "center" as const,
            defaultDir: "asc" as const,
            render: (r: Row) => <SeasonLink season={r.season} />,
          },
        ]
      : []),
    {
      key: "pos",
      label: "Pos",
      align: "center",
      defaultDir: "asc",
      // Contracts carry no position of their own, so this is the position he
      // was listed at nearest the contract year. It is the only way the
      // upcoming season - all salaries, no games played yet - has one at all.
      definition: GLOSSARY.posNearest,
      render: (r) => r.pos ?? "\u2014",
    },
    {
      key: "team",
      label: "Team",
      align: "center",
      defaultDir: "asc",
      // A waived contract is marked, so the row reads as money a team still
      // owed rather than a season he played there.
      render: (r) => (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          {r.part ? (
            <SeasonTeams abbr={r.team} label={r.teamLabel} />
          ) : (
            <SeasonTeams abbr={r.team} label={r.teamLabel} teams={r.teams} />
          )}
          {!r.playedHere && (
            <span
              title="Waived: this team still owed him, he played elsewhere"
              className="rounded border border-black/20 bg-black/5 px-1 py-px text-[0.625rem] font-medium uppercase tracking-wide text-black/50"
            >
              Waived
            </span>
          )}
        </span>
      ),
    },
    {
      key: "salary",
      label: "Salary",
      align: "center",
      render: (r) =>
        r.estimated ? (
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
      key: "teamPayroll",
      label: "Team Payroll",
      align: "center",
      render: (r) => formatCurrency(r.teamPayroll),
    },
    {
      key: "pctOfTeamCap",
      label: "% of Team Payroll",
      align: "center",
      render: (r) => formatPercent(r.pctOfTeamCap),
    },
    {
      key: "pctOfLeagueCap",
      label: "% of League Cap",
      align: "center",
      render: (r) => formatPercent(r.pctOfLeagueCap),
    },
    // Restating a salary at today's cap only says something about a season
    // that isn't today's, so the column drops out when you are already looking
    // at the current one.
    ...(showCapAdjusted && currentCap
      ? [
          {
            key: "capAdjustedSalary",
            label: "Today's Equivalent",
            align: "center" as const,
            // Not sortable: it's a fixed multiple of % of League Cap, so
            // sorting by it would just repeat that column's order.
            render: capAdjusted,
          },
        ]
      : []),
    {
      key: "netValueScore",
      label: "Net Value",
      align: "center",
      render: (r) => formatScore(r.netValueScore),
    },
    {
      key: "deservedSalary",
      label: "Deserved Pay",
      align: "center",
      render: (r) => formatCurrency(r.deservedSalary),
    },
    {
      key: "payDifference",
      label: "Difference",
      align: "center",
      definition: GLOSSARY.payDifferenceContract,
      render: (r) => {
        // A row that is one team's part of a season: the gap is measured
        // against his whole season, so printing it beside a fraction of the
        // money would misstate it. Blank on the rows set under a season, and
        // explained where a team filter makes the part the row itself.
        if (r.part) return "\u2014";
        if (r.salary !== r.seasonSalary) {
          return (
            <span
              title="Part of a season split between two teams. The gap is a whole-season figure; see this player's page."
              className="text-black/40"
            >
              &mdash;
            </span>
          );
        }
        // Colored against the season's own cap, so the bar for "a lot of money"
        // moves with the league rather than staying fixed in 2026 dollars.
        return (
          <span className={payGapClass(r.payDifference, r.leagueCap)}>
            {formatSignedCurrency(r.payDifference)}
          </span>
        );
      },
    },
  ];
}

export default async function SalariesPage({
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
    getSalariesSeasons(),
    getTeams(),
  ]);
  const season = sp.season ?? seasons[0] ?? "ALL";
  const team = sp.team ?? "ALL";
  const pos = parsePosition(sp.pos);
  // Highest paid first. Every sort link carries its own dir, so defaulting to
  // desc here only decides the unsorted landing view.
  const sort = sp.sort ?? "salary";
  const dir: "asc" | "desc" = sp.dir === "asc" ? "asc" : "desc";
  const page = Number(sp.page ?? "1");

  // Null when season is "ALL" — a single cap figure would be meaningless
  // across seasons, so the banner is omitted entirely in that case.
  const [{ rows, totalCount }, leagueCap, currentCap] = await Promise.all([
    getSalaries({ season, team, pos, sort, dir, page }),
    getLeagueCap(season),
    getCurrentCap(),
  ]);

  // Badges for just the rows on this page.
  const awards = await getAwardsForRows(rows);

  return (
    <div className={PAGE_COLUMN}>
      <PageHeader
        title="Salaries"
        meta={
          leagueCap !== null && (
            <div className="inline-flex max-w-full flex-wrap items-baseline justify-center md:justify-start gap-x-3 gap-y-1 rounded-lg border-2 border-accent bg-background px-2 md:px-4 py-2">
              <span className="text-sm text-white/60">
                {season} League Salary Cap
              </span>
              <span className="font-mono md:text-lg font-semibold tabular-nums text-accent">
                {formatCurrency(leagueCap)}
              </span>
            </div>
          )
        }
      />
      <DataTable
        basePath="/salaries"
        columns={getColumns(
          season === "ALL",
          season !== currentCap?.season,
          currentCap,
          awards,
        )}
        rows={rows as Row[]}
        rowKey={(r) => `${r.id}-${r.part?.team ?? ""}`}
        splits={tradedSplits}
        splitsLabel="pay and Net Value by team"
        attached={waivedContracts}
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
      <p className="text-sm text-white/60 mt-8">
        Salaries from Basketball-Reference, with gaps filled from HoopsHype.
      </p>
    </div>
  );
}
