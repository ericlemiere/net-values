import { DataTable, type ColumnDef } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { PlayerLink } from "@/components/PlayerLink";
import { awardKey, type Award } from "@/lib/awards";
import { TeamLink } from "@/components/TeamLink";
import { formatCurrency, formatPercent, formatScore } from "@/lib/format";
import {
  getCurrentCap,
  getLeagueCap,
  getSalaries,
  getSalariesSeasons,
  getTeams,
  PAGE_SIZE,
  getAwardsForRows,
} from "@/lib/db/queries";
import { parsePosition } from "@/lib/positions";

type Row = Awaited<ReturnType<typeof getSalaries>>["rows"][number];

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
      render: (r) => <PlayerLink
          id={r.playerId}
          name={r.name}
          awards={awards.get(awardKey(r.playerId, r.season))}
        />,
    },
    ...(showSeason
      ? [
          {
            key: "season",
            label: "Season",
            align: "center" as const,
            defaultDir: "asc" as const,
            render: (r: Row) => r.season,
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
      description:
        "Position, taken from the nearest season the player has a stat line for. Contracts for a season not yet played show the position he last played.",
      render: (r) => r.pos ?? "\u2014",
    },
    {
      key: "team",
      label: "Team",
      align: "center",
      defaultDir: "asc",
      // A bought-out contract is two rows, one per team paying it. The marker
      // says which of them was only writing cheques, so the Net Value beside
      // it — a charge with no production against it — reads as intended.
      render: (r) => (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <TeamLink abbr={r.team} label={r.teamLabel} />
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
    {
      key: "salary",
      label: "Salary",
      align: "center",
      render: (r) => formatCurrency(r.salary),
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
            label: `Salary in ${currentCap.season} $`,
            align: "center" as const,
            // Not sortable: it's a fixed multiple of % of League Cap, so
            // sorting by it would just repeat that column's order.
            description: `The same share of the cap, restated at the ${currentCap.season} cap. What this contract would pay if it were signed now.`,
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
  const sort = sp.sort ?? "name";
  const dir = sp.dir === "desc" ? "desc" : "asc";
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
    <div className="p-6 max-w-350 w-full mx-auto text-white">
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
      <p className="text-sm text-white/60 mt-8">
        Team payrolls come from Basketball-Reference for 2011-12 onward and from
        Hoopshype for 1990-91 through 2010-11. Salaries split the same way, but
        not cleanly: Basketball-Reference lists a figure only for players on a
        team&rsquo;s books at the time it was read, so Hoopshype still fills
        gaps in the modern era too, through 2022-23. Percentages are computed
        against that season&rsquo;s team payroll and league salary cap.
      </p>
      <p className="text-sm text-white/60 mt-3">
        Every team-season from 1990-91 on now carries a payroll. Phoenix before
        2011-12 and Washington before 1997-98 were long missing — the original
        import read each player&rsquo;s team from a roster table that never had
        them — and were recovered from the same Hoopshype source. Three
        training-camp contracts totalling $88,367 are still unmatched, listed in
        the scraper&rsquo;s unmatched_recovered_salaries.csv rather than guessed
        onto a player.
      </p>
    </div>
  );
}
