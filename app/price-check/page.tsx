import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { PlayerHeadshot } from "@/components/PlayerHeadshot";
import {
  AddPlayerSlot,
  PriceCard,
  PriceLinkToggle,
  PriceSeasonFilter,
  PriceStatFilter,
  PriceViewToggle,
  RemovePlayerButton,
} from "@/components/PriceCheckControls";
import { formatCurrency, formatScore } from "@/lib/format";
import {
  getPlayerById,
  getPlayerCareerSalaries,
  getPlayerCareerStatsTotals,
  getPriceRank,
  getTeams,
  type PlayerContract,
  type PriceRank,
} from "@/lib/db/queries";
import {
  PRICE_STATS,
  parsePriceStat,
  parsePriceView,
  type PriceCheckState,
  type PriceStat,
  type PriceStatDef,
  type PriceView,
} from "@/lib/price-check";
import { PAGE_COLUMN } from "@/lib/layout";
import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Price Check",
  description:
    "What an NBA player was paid for every game, minute, point, rebound, assist, steal and block of a season. Pick a player and a stat, or put two side by side.",
  path: "/price-check",
});

type Totals = Awaited<ReturnType<typeof getPlayerCareerStatsTotals>>[number];
type Pay = Awaited<ReturnType<typeof getPlayerCareerSalaries>>[number];
type Teams = Awaited<ReturnType<typeof getTeams>>;

function parseId(value: string | undefined) {
  const n = Number(value);
  return value && Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * The season total a salary gets divided by. Null means the stat isn't on
 * record that season (starts before they were tracked, say), which the card
 * says rather than showing a zero it doesn't know to be true.
 */
function statTotal(stat: PriceStat, t: Totals, pay: Pay | undefined) {
  switch (stat) {
    case "sec":
      return t.mp === null ? null : t.mp * 60;
    case "nvp":
      return pay?.production ?? null;
    case "miss":
      return t.fga === null || t.fgm === null ? null : t.fga - t.fgm;
    default:
      return t[stat];
  }
}

function formatTotal(stat: PriceStat, value: number) {
  if (stat === "nvp") return value.toFixed(2);
  // Minutes come to the hundredth from nba_api; a whole number reads better
  // as a headline, and the division below still uses the exact figure.
  return Math.round(value).toLocaleString("en-US");
}

/** Whole dollars, until the figure is small enough that cents matter. */
function formatPrice(value: number) {
  return value < 100
    ? `$${value.toFixed(2)}`
    : `$${Math.round(value).toLocaleString("en-US")}`;
}

function formatPerMillion(value: number) {
  if (value >= 100) return Math.round(value).toLocaleString("en-US");
  return value.toFixed(value >= 10 ? 1 : 2);
}

function ordinal(n: number) {
  const tens = n % 100;
  const suffix =
    tens >= 11 && tens <= 13
      ? "th"
      : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ??
        "th";
  return `${n.toLocaleString("en-US")}${suffix}`;
}

/** What the franchise was called that season: the Sonics, not the Thunder. */
function teamName(teams: Teams, abbr: string | null, season: string) {
  if (!abbr) return null;
  const team = teams.find((t) => t.abbr === abbr);
  if (!team) return abbr;
  const era = team.eras?.find(
    (e) =>
      season >= e.firstSeason && (e.lastSeason === null || season <= e.lastSeason),
  );
  return era?.name ?? team.name;
}

interface Slot {
  player: { id: number; name: string; nbaPersonId: number | null };
  /** Seasons with a stat line, newest first. Empty for a player who never
   *  played a game we have. */
  seasons: string[];
  season: string | null;
  stat: PriceStat;
  totals: Totals | null;
  pay: Pay | undefined;
  total: number | null;
  rank: PriceRank | null;
}

async function loadSlot(
  playerId: number,
  seasonParam: string | null,
  stat: PriceStat,
): Promise<Slot | null> {
  const player = await getPlayerById(playerId);
  if (!player) return null;
  const [careerTotals, careerPay] = await Promise.all([
    getPlayerCareerStatsTotals(playerId),
    getPlayerCareerSalaries(playerId),
  ]);
  const payBySeason = new Map(careerPay.map((r) => [r.season, r]));
  const seasons = careerTotals.map((t) => t.season).reverse();

  // An asked-for season if he played it; otherwise his latest season with both
  // a stat line and a salary, so the page opens on a figure rather than a
  // blank; failing that, his latest season of any kind.
  const season =
    (seasonParam && seasons.includes(seasonParam) ? seasonParam : null) ??
    seasons.find((s) => payBySeason.get(s)?.salary) ??
    seasons[0] ??
    null;

  const totals = careerTotals.find((t) => t.season === season) ?? null;
  const pay = season ? payBySeason.get(season) : undefined;
  const total = totals ? statTotal(stat, totals, pay) : null;
  const rank =
    season && pay?.salary && total ? await getPriceRank(playerId, season, stat) : null;

  return { player, seasons, season, stat, totals, pay, total, rank };
}

export default async function PriceCheckPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const p1 = parseId(sp.p1);
  const p2 = parseId(sp.p2);
  const stat = parsePriceStat(sp.stat);
  const view = parsePriceView(sp.view);
  // A second player's own stat only means anything when there is one.
  const stat2 = p2 !== null && sp.stat2 ? parsePriceStat(sp.stat2) : null;

  const [slot1, slot2, teams] = await Promise.all([
    p1 === null ? null : loadSlot(p1, sp.s1 ?? null, stat),
    p2 === null ? null : loadSlot(p2, sp.s2 ?? null, stat2 ?? stat),
    getTeams(),
  ]);

  // A bad id in the URL drops out rather than 404ing the page. If it was the
  // first player, the second moves up so the empty slot is always on the right.
  const [a, b] = slot1 ? [slot1, slot2] : [slot2, null];
  const state: PriceCheckState = {
    p1: a?.player.id ?? null,
    s1: a === slot1 ? (sp.s1 ?? null) : (sp.s2 ?? null),
    p2: b?.player.id ?? null,
    s2: b ? (sp.s2 ?? null) : null,
    stat: a && a === slot2 ? (stat2 ?? stat) : stat,
    stat2: b ? stat2 : null,
    view,
  };

  return (
    <div className={PAGE_COLUMN}>
      <PageHeader
        title="Price Check"
        meta={
          a && (
            <div className="flex flex-wrap items-center gap-3">
              <PriceViewToggle state={state} />
              {b && <PriceLinkToggle state={state} />}
            </div>
          )
        }
      />
      <p className="mb-6 max-w-2xl text-sm text-white/60">
        What a player was paid for everything he did in a season, one stat at a
        time.{!b && " Add a second player to compare."}
      </p>

      {a ? (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
            <PlayerCard slot={a} index={1} state={state} teams={teams} view={view} />
            {b ? (
              <PlayerCard slot={b} index={2} state={state} teams={teams} view={view} />
            ) : (
              <AddPlayerSlot
                state={state}
                slot={2}
                prompt="Compare him with someone else."
              />
            )}
        </div>
      ) : (
        <AddPlayerSlot
          state={state}
          slot={1}
          prompt="Pick a player to see what he cost per game, point, rebound and more."
          className="w-full max-w-2xl"
        />
      )}
    </div>
  );
}

const PANEL = "flex min-w-0 flex-col gap-3 rounded-lg bg-white/5 p-3";
const FIGURE_LABEL = "text-xs font-medium uppercase tracking-wide text-white/40";

function PlayerCard({
  slot,
  index,
  state,
  teams,
  view,
}: {
  slot: Slot;
  index: 1 | 2;
  state: PriceCheckState;
  teams: Teams;
  view: PriceView;
}) {
  const { player, season, stat, totals, pay, total, rank } = slot;
  const def = PRICE_STATS[stat];
  const salary = pay?.salary ?? null;

  return (
    <PriceCard label={player.name}>
      <div className="flex items-start gap-4">
        <PlayerHeadshot nbaPersonId={player.nbaPersonId} name={player.name} height={76} />
        <div className="min-w-0 flex-1 self-center">
          <h2 className="wrap-break-word text-xl font-semibold tracking-tight">
            <Link
              href={`/players/${player.id}`}
              className="decoration-accent underline-offset-4 hover:underline"
            >
              {player.name}
            </Link>
          </h2>
        </div>
        <RemovePlayerButton state={state} slot={index} name={player.name} />
      </div>

      {season === null ? (
        <p className="text-sm text-white/50">
          No stats on record for {player.name}, so there is nothing to price.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className={PANEL}>
              <PriceSeasonFilter
                state={state}
                slot={index}
                seasons={slot.seasons}
                value={season}
              />
              <div className="px-1">
                <div className={FIGURE_LABEL}>Salary</div>
                <div className="font-mono text-2xl font-semibold tabular-nums">
                  {formatCurrency(salary)}
                </div>
              </div>
              <div className="px-1">
                <div className={FIGURE_LABEL}>Net Value</div>
                <div className="font-mono text-lg font-semibold tabular-nums">
                  {formatScore(pay?.netValueScore ?? null)}
                </div>
              </div>
              <div className="px-1">
                <div className={FIGURE_LABEL}>Team</div>
                <TeamsPlayed pay={pay} totals={totals} teams={teams} season={season} />
              </div>
            </div>

            <div className={PANEL}>
              <PriceStatFilter state={state} slot={index} value={stat} />
              <div className="px-1">
                <div className={FIGURE_LABEL}>{def.label}</div>
                <div className="font-mono text-2xl font-semibold tabular-nums">
                  {total === null ? "—" : formatTotal(stat, total)}
                </div>
                {stat !== "gp" && totals?.gp != null && (
                  <div className="mt-1 text-xs text-white/40">
                    in {totals.gp} game{totals.gp === 1 ? "" : "s"}
                  </div>
                )}
              </div>
            </div>
          </div>

          <PriceFigure
            salary={salary}
            total={total}
            stat={stat}
            rank={rank}
            view={view}
            season={season}
          />
        </>
      )}
    </PriceCard>
  );
}

/**
 * Who he played for. One team is most seasons; a bought-out season names the
 * team he played for and, under it, what the team that waived him still paid.
 */
function TeamsPlayed({
  pay,
  totals,
  teams,
  season,
}: {
  pay: Pay | undefined;
  totals: Totals | null;
  teams: Teams;
  season: string;
}) {
  const contracts: PlayerContract[] =
    pay?.contracts?.filter((c) => c.team) ?? [];
  const played = contracts.filter((c) => c.playedHere);
  const owed = contracts.filter((c) => !c.playedHere && c.salary);
  // No contract on file: the stat line still knows where he played.
  const teamsPlayed =
    played.length > 0
      ? played.map((c) => c.team!)
      : [pay?.team ?? totals?.team].filter((t): t is string => !!t);

  if (teamsPlayed.length === 0) return <div className="text-white/50">—</div>;

  return (
    <div className="flex flex-col gap-1">
      {teamsPlayed.map((abbr) => (
        <Link
          key={abbr}
          href={`/teams/${abbr}`}
          className="w-fit text-base decoration-accent underline-offset-4 hover:underline"
        >
          {teamName(teams, abbr, season)}
        </Link>
      ))}
      {owed.map((c) => (
        <div key={c.team} className="text-xs text-white/50">
          <Link
            href={`/teams/${c.team}`}
            className="decoration-accent underline-offset-4 hover:underline"
          >
            {teamName(teams, c.team, season)}
          </Link>{" "}
          still owed {formatCurrency(c.salary)}
        </div>
      ))}
    </div>
  );
}

/**
 * "12th lowest price per point in the league in 2025-26", counted from
 * whichever end of the league he is nearer, so a max contract reads "40th
 * highest" rather than "456th lowest".
 */
function rankLine(
  rank: number,
  pool: number,
  view: PriceView,
  def: PriceStatDef,
  season: string,
) {
  const top = rank <= pool / 2;
  const place = ordinal(top ? rank : pool - rank + 1);
  if (view === "dollars")
    return `${place} ${top ? "lowest" : "highest"} price per ${def.one} in the league in ${season}`;
  return `${place} ${top ? "most" : "fewest"} ${def.many} per $1M in the league in ${season}`;
}

/** The answer: the salary divided by the stat, and where that sits in the league. */
function PriceFigure({
  salary,
  total,
  stat,
  rank,
  view,
  season,
}: {
  salary: number | null;
  total: number | null;
  stat: PriceStat;
  rank: PriceRank | null;
  view: PriceView;
  season: string;
}) {
  const def = PRICE_STATS[stat];

  let headline: string;
  let unit: string | null = null;
  if (!salary) {
    headline = "No salary on record";
  } else if (total === null) {
    headline = "Not on record";
  } else if (total <= 0) {
    headline = "Not paid for this";
  } else if (view === "dollars") {
    headline = formatPrice(salary / total);
    unit = `per ${def.one}`;
  } else {
    headline = formatPerMillion((total / salary) * 1_000_000);
    unit = `${def.many} per $1M`;
  }

  const median =
    rank?.median != null
      ? view === "dollars"
        ? `${formatPrice(rank.median)} per ${def.one}`
        : `${formatPerMillion(1_000_000 / rank.median)} ${def.many} per $1M`
      : null;

  return (
    <div className="rounded-lg border border-accent/40 bg-black/30 p-4">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span
          className={`font-mono font-semibold tabular-nums ${
            unit ? "text-4xl text-accent" : "text-2xl text-white/70"
          }`}
        >
          {headline}
        </span>
        {unit && <span className="text-lg text-white/70">{unit}</span>}
      </div>
      {rank?.rank != null && (
        <div className="mt-2 text-sm text-white/60">
          {rankLine(rank.rank, rank.pool, view, def, season)}
        </div>
      )}
      {median && (
        <div className="mt-1 text-sm text-white/40">League median: {median}</div>
      )}
    </div>
  );
}
