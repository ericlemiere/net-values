import Link from "next/link";
import { Suspense } from "react";
import {
  CapConverterForm,
  type CapInputMode,
} from "@/components/CapConverterForm";
import { HeaderBox } from "@/components/HeaderBox";
import { PageHeader } from "@/components/PageHeader";
import { PlayerLink } from "@/components/PlayerLink";
import { SeasonLink } from "@/components/SeasonLink";
import { TeamLink } from "@/components/TeamLink";
import {
  SHEET,
  SHEET_HEAD,
  SHEET_ROW_HOVER,
  stripeClass,
} from "@/components/DataTable";
import {
  formatCompactCurrency,
  formatCurrency,
  formatScore,
  netValueClass,
} from "@/lib/format";
import {
  getCapLadder,
  getCapSeasons,
  getCapShareOutcomes,
  getPlayerById,
  getPlayerCapSeasons,
  type CapLadderRow,
  type CapSeason,
  type CapShareOutcomes,
  type PlayerCapSeason,
} from "@/lib/db/queries";
import { PAGE_COLUMN } from "@/lib/layout";
import { DEFAULT_PRICE_STAT, priceCheckHref } from "@/lib/price-check";
import { jsonLd, pageMetadata, SITE_URL } from "@/lib/site";

const DESCRIPTION =
  "What an NBA salary, or any player's contract, is worth in any other season, measured as a share of the salary cap, and what that share of the cap has bought.";

/**
 * A player's conversion gets its own title and description, so a shared link
 * says whose contract it is. Every conversion stays canonical to the bare page:
 * the query strings are endless, and they're one tool, not separate pages.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const playerId = parseId(sp.player);
  const [capSeasons, player] = await Promise.all([
    getCapSeasons(),
    playerId === null ? null : loadPlayer(playerId),
  ]);
  const paid = player
    ? (player.seasons.find((s) => s.season === sp.season) ?? player.seasons[0])
    : null;
  const cap = paid && capSeasons.find((s) => s.season === paid.season);
  if (!player || !paid || !cap)
    return pageMetadata({
      title: "NBA Salary Cap Converter",
      description: DESCRIPTION,
      path: "/cap-converter",
    });
  const pct = ((100 * paid.salary) / cap.leagueCap).toFixed(2);
  return pageMetadata({
    title: `${player.name}'s ${paid.season} Salary in Today's Cap`,
    description: `${player.name} was paid ${formatMillions(paid.salary / 1e6)} in ${paid.season}, ${pct}% of the league cap. What that share of the cap is worth in every other season, and what it has bought.`,
    path: "/cap-converter",
  });
}

/** How far either side of the target share still counts as the same money. */
const TOLERANCE = 1;

/**
 * The ladder's window, in points of the cap. Much wider than TOLERANCE: it
 * only ever shows the one closest contract per season, so a wide window costs
 * nothing in precision and leaves far fewer seasons with "No one" in them.
 */
const LADDER_TOLERANCE = 10;

const PANEL = "flex min-w-0 flex-col gap-3 rounded-lg bg-white/5 p-4";
/** The two blocks up top, the form and the summary: lighter than the page and
 *  than the controls inside them, so each reads as one unit. */
const BLOCK = "rounded-lg bg-neutral-800 p-4";
const CELL = "whitespace-nowrap px-3 py-1.5";
const NUM = `${CELL} text-right font-mono text-[0.8125rem] tabular-nums`;
/** The ladder's columns at fixed widths, so the player's own row in its table
 *  above lines up with the ladder under it. The player's name takes the rest. */
const LADDER_TABLE = "w-full min-w-176 table-fixed text-sm text-black";
const NAME_CELL = `${CELL} overflow-hidden text-ellipsis`;

function LadderCols() {
  return (
    <colgroup>
      <col className="w-24" />
      <col />
      <col className="w-18" />
      <col className="w-26" />
      <col className="w-26" />
      <col className="w-21" />
      <col className="w-23" />
    </colgroup>
  );
}

/** "1 best season", "10 best seasons". */
function seasons(n: number, kind = "") {
  return `${n.toLocaleString("en-US")} ${kind}season${n === 1 ? "" : "s"}`;
}

/** Millions to the hundredth, without trailing zeros: $48.07M, $7.5M, $20M. */
function formatMillions(millions: number) {
  return `$${Number(millions.toFixed(2))}M`;
}

function parseAmount(value: string | undefined) {
  const n = Number(value);
  return value && Number.isFinite(n) && n > 0 ? n : null;
}

function parseId(value: string | undefined) {
  const n = Number(value);
  return value && Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * The player ?player= names, with his pay in every season the converter
 * covers. Null for an id that isn't a player or a player never paid in one of
 * those seasons, and the page falls back to converting a salary.
 */
async function loadPlayer(playerId: number) {
  const [player, seasons] = await Promise.all([
    getPlayerById(playerId),
    getPlayerCapSeasons(playerId),
  ]);
  if (!player || seasons.length === 0) return null;
  return { id: player.id, name: player.name, seasons };
}

export default async function CapConverterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const playerId = parseId(sp.player);
  const [capSeasons, player] = await Promise.all([
    getCapSeasons(),
    playerId === null ? null : loadPlayer(playerId),
  ]);
  const latest = capSeasons[capSeasons.length - 1];
  // A player's season if he was paid in it, otherwise his latest.
  const paid = player
    ? (player.seasons.find((s) => s.season === sp.season) ?? player.seasons[0])
    : null;
  const season =
    capSeasons.find((s) => s.season === (paid?.season ?? sp.season)) ?? latest;
  // Entered as a player, whose pay that season is the salary; as a salary in
  // millions; or as a share of the cap. The others follow from the season's
  // cap. A player wins over both, and a share over a salary.
  const pctParam = parseAmount(sp.pct);
  const mode: CapInputMode = paid
    ? "player"
    : pctParam !== null
      ? "pct"
      : "salary";
  const amount = paid
    ? paid.salary / 1e6
    : pctParam !== null
      ? ((Math.round(pctParam * 100) / 100 / 100) * season.leagueCap) / 1e6
      : (parseAmount(sp.amount) ?? 20);
  const pct =
    pctParam !== null && !paid
      ? Math.round(pctParam * 100) / 100
      : Math.round((10000 * amount * 1e6) / season.leagueCap) / 100;
  const entered = mode === "pct" ? pct : amount;
  // The form starts on the player's pay as a salary, so leaving player mode
  // carries it across.
  const conversion = `${season.season}:${mode}:${player?.id ?? entered}`;

  const rows = [...capSeasons].reverse();
  // A player's own season gets a row of its own, so the ladder and outcomes
  // leave him out: everyone else paid what he was.
  const excluded = paid ? player!.id : null;
  const ladder = getCapLadder(pct, LADDER_TOLERANCE, excluded);
  const outcomes = getCapShareOutcomes(pct, TOLERANCE, 10, excluded);

  return (
    <div className={PAGE_COLUMN}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd({
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "NBA Salary Cap Converter",
          url: `${SITE_URL}/cap-converter`,
          description: DESCRIPTION,
          applicationCategory: "SportsApplication",
          operatingSystem: "Any",
          isAccessibleForFree: true,
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        })}
      />
      <PageHeader title="Cap Converter" />
      <p className="mb-6 max-w-2xl text-sm text-white/60">
        What an NBA salary is worth in any other season, measured as a share of
        the salary cap. Enter a salary, a percentage of the cap, or a
        player&rsquo;s season to see the same money in every season since
        1990-91, and what that share of the cap has bought.
      </p>
      {/* Both queries start here and neither is awaited: the summary beside
          the form and the tables under it each wait on what they need, inside
          their own boundary, and the cached call behind them runs once. */}
      {/* Side by side from 71rem: the narrowest the summary, beside the form,
          still has the 42rem its headline and stat boxes need to share one
          line (its @2xl layout). Any narrower and the boxes drop under the
          headline, standing the summary far taller than the form, so the two
          stack instead. The gap is the form's error message's to hang in, two
          lines of it on a phone. */}
      <div className="mb-8 grid grid-cols-1 gap-10 md:gap-8 min-[71rem]:grid-cols-[auto_minmax(0,1fr)] min-[71rem]:gap-4">
        {/* Keyed on the conversion, so back and forward reset the inputs to
            the URL rather than keeping whatever was last typed. */}
        <CapConverterForm
          key={`form:${conversion}`}
          capSeasons={rows}
          season={season.season}
          mode={mode}
          value={Math.round(entered * 100) / 100}
          player={
            player && {
              id: player.id,
              name: player.name,
              seasons: player.seasons.map(({ season, salary }) => ({
                season,
                salary,
              })),
            }
          }
        />
        {/* Keyed on the inputs, so a new conversion mounts a new boundary and
            shows the skeleton while it loads. Without the key the client-side
            navigation keeps the old results on screen until the new ones land. */}
        <Suspense
          key={`summary:${conversion}`}
          fallback={<div className={`${BLOCK} min-h-32 animate-pulse`} />}
        >
          <Summary
            season={season}
            amount={amount}
            pct={pct}
            outcomes={outcomes}
          />
        </Suspense>
      </div>

      <Suspense
        key={`results:${conversion}`}
        fallback={<ResultsSkeleton />}
      >
        <Results
          capSeasons={capSeasons}
          season={season}
          pct={pct}
          ladder={ladder}
          outcomes={outcomes}
          player={player && paid && { id: player.id, name: player.name, paid }}
        />
      </Suspense>
    </div>
  );
}

async function Results({
  capSeasons,
  season,
  pct,
  ladder: ladderPromise,
  outcomes: outcomesPromise,
  player,
}: {
  capSeasons: CapSeason[];
  season: CapSeason;
  pct: number;
  ladder: Promise<CapLadderRow[]>;
  outcomes: Promise<CapShareOutcomes>;
  /** The player the conversion started from, left out of the tables. */
  player: { id: number; name: string; paid: PlayerCapSeason } | null;
}) {
  const [ladder, outcomes] = await Promise.all([
    ladderPromise,
    outcomesPromise,
  ]);
  const bySeason = new Map(ladder.map((r) => [r.season, r]));
  const rows = [...capSeasons].reverse();

  return (
    <>
      {player && (
        // In the ladder's column, so its cells sit over the ladder's own.
        <div className="mb-8 grid grid-cols-1 min-[85rem]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] min-[85rem]:gap-8">
          <PlayerRow player={player} season={season} pct={pct} />
        </div>
      )}
      {/* Side by side only from 85rem, the narrowest the ladder fits its share
          of the row without scrolling sideways; below that the outcomes stack
          under it. Side by side, the ladder takes its height from the outcomes
          and scrolls inside that, rather than running the full forty seasons. */}
      <div className="grid grid-cols-1 items-start gap-8 min-[85rem]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] min-[85rem]:items-stretch">
        <section className="flex min-w-0 flex-col">
          <h2 className="text-lg font-semibold">
            The same money, every season
          </h2>
          <p className="mb-2 text-sm text-white/60">
            {pct.toFixed(2)}% of each season&rsquo;s cap, and the player paid
            closest to it.
          </p>
          <div className="min-[85rem]:relative min-[85rem]:min-h-80 min-[85rem]:flex-1">
            <div
              className={`max-h-144 ${SHEET} min-[85rem]:absolute! min-[85rem]:inset-0 min-[85rem]:max-h-none`}
            >
              <table className={LADDER_TABLE}>
                <LadderCols />
                <thead className={`sticky top-0 z-10 ${SHEET_HEAD}`}>
                  <tr>
                    <th className={`${CELL} text-center font-medium`}>
                      Season
                    </th>
                    <th className={`${CELL} text-left font-medium`}>
                      Closest Player
                    </th>
                    <th className={`${CELL} text-center font-medium`}>Team</th>
                    <th className={`${CELL} text-right font-medium`}>
                      Same Share
                    </th>
                    <th className={`${CELL} text-right font-medium`}>
                      League Cap
                    </th>
                    <th className={`${CELL} text-right font-medium`}>
                      % of Cap
                    </th>
                    <th className={`${CELL} text-right font-medium`}>
                      Net Value
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s, i) => {
                    const rung = bySeason.get(s.season);
                    const picked = s.season === season.season;
                    return (
                      <tr
                        key={s.season}
                        className={`${picked ? "bg-accent/30" : stripeClass(i)} ${SHEET_ROW_HOVER}`}
                      >
                        <td
                          className={`${CELL} text-center font-mono text-[0.8125rem] tabular-nums`}
                        >
                          <SeasonLink season={s.season} />
                        </td>
                        {rung ? (
                          <>
                            <td className={NAME_CELL}>
                              <PlayerLink id={rung.playerId} name={rung.name} />
                            </td>
                            <td
                              className={`${CELL} text-center font-mono text-[0.8125rem]`}
                            >
                              <TeamLink
                                abbr={rung.team}
                                label={rung.teamLabel}
                              />
                            </td>
                          </>
                        ) : (
                          <td colSpan={2} className={`${CELL} text-black/40`}>
                            No one within {LADDER_TOLERANCE}% of this share
                          </td>
                        )}
                        <td className={`${NUM} font-semibold`}>
                          {formatCompactCurrency((pct / 100) * s.leagueCap)}
                        </td>
                        <td className={NUM}>
                          {formatCompactCurrency(s.leagueCap)}
                        </td>
                        <td className={NUM}>
                          {rung ? `${rung.pctOfLeagueCap.toFixed(2)}%` : "—"}
                        </td>
                        <td className={NUM}>
                          {rung ? (
                            <span className={netValueClass(rung.netValueScore)}>
                              {formatScore(rung.netValueScore)}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="min-w-0">
          <h2 className="text-lg font-semibold">
            What {pct.toFixed(1)}% of the cap has bought (&plusmn;{TOLERANCE}%)
          </h2>
          {outcomes.count === 0 ? (
            <p className={`${PANEL} mt-2 text-sm text-white/50`}>
              No season with a Net Value was paid this share of the cap.
            </p>
          ) : (
            // Stacked under the ladder, the section has the row to itself, so
            // best and worst sit side by side once each has room for its four
            // columns. Beside the ladder they stack again.
            <div className="mt-1 grid grid-cols-1 gap-4 lg:grid-cols-2 min-[85rem]:grid-cols-1">
              <OutcomeList
                title={`${seasons(outcomes.best.length, "best ")} at this percentage`}
                rows={outcomes.best}
              />
              <OutcomeList
                title={`${seasons(outcomes.worst.length, "worst ")} at this percentage`}
                rows={outcomes.worst}
              />
            </div>
          )}
        </section>
      </div>
    </>
  );
}

/**
 * The player the conversion started from, in the ladder's columns so his
 * season reads against the ones below it, and a way on to what his salary
 * bought stat by stat.
 */
function PlayerRow({
  player,
  season,
  pct,
}: {
  player: { id: number; name: string; paid: PlayerCapSeason };
  season: CapSeason;
  pct: number;
}) {
  const { paid } = player;
  return (
    <section className="min-w-0">
      {/* The ladder scrolls, so this keeps a scrollbar's width spare on the
          right too, or its columns sit that far off the ladder's. */}
      <div className={`${SHEET} [scrollbar-gutter:stable]`}>
        <table className={LADDER_TABLE}>
          <LadderCols />
          <thead className={SHEET_HEAD}>
            <tr>
              <th className={`${CELL} text-center font-medium`}>Season</th>
              <th className={`${CELL} text-left font-medium`}>Player</th>
              <th className={`${CELL} text-center font-medium`}>Team</th>
              <th className={`${CELL} text-right font-medium`}>Salary</th>
              <th className={`${CELL} text-right font-medium`}>League Cap</th>
              <th className={`${CELL} text-right font-medium`}>% of Cap</th>
              <th className={`${CELL} text-right font-medium`}>Net Value</th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-accent/30">
              <td
                className={`${CELL} text-center font-mono text-[0.8125rem] tabular-nums`}
              >
                <SeasonLink season={paid.season} />
              </td>
              <td className={NAME_CELL}>
                <PlayerLink id={player.id} name={player.name} />
              </td>
              <td className={`${CELL} text-center font-mono text-[0.8125rem]`}>
                {paid.team ? (
                  <TeamLink abbr={paid.team} label={paid.teamLabel} />
                ) : (
                  "—"
                )}
              </td>
              <td className={`${NUM} font-semibold`}>
                {formatCompactCurrency(paid.salary)}
              </td>
              <td className={NUM}>{formatCompactCurrency(season.leagueCap)}</td>
              <td className={NUM}>{pct.toFixed(2)}%</td>
              <td className={NUM}>
                <span className={netValueClass(paid.netValueScore)}>
                  {formatScore(paid.netValueScore)}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <Link
        href={priceCheckHref({
          p1: player.id,
          s1: paid.season,
          p2: null,
          s2: null,
          stat: DEFAULT_PRICE_STAT,
          stat2: null,
          view: "dollars",
        })}
        className="mt-2 inline-block text-sm text-accent decoration-accent underline-offset-4 hover:underline"
      >
        Price check this season &rarr;
      </Link>
    </section>
  );
}

/** Stands in for the tables under the form, in the same shapes. */
function ResultsSkeleton() {
  const block = "animate-pulse rounded-lg bg-white/5";
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="grid grid-cols-1 gap-8 min-[85rem]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div>
          <div className={`${block} mb-2 h-12 w-2/3`} />
          <div className={`${block} h-144`} />
        </div>
        <div>
          <div className={`${block} mb-2 h-12 w-2/3`} />
          <div className={`${block} mb-4 h-68`} />
          <div className={`${block} h-72`} />
        </div>
      </div>
    </div>
  );
}

/**
 * The conversion and what that share of the cap has bought, in the panel
 * beside the form.
 */
async function Summary({
  season,
  amount,
  pct,
  outcomes: outcomesPromise,
}: {
  season: CapSeason;
  amount: number;
  pct: number;
  outcomes: Promise<CapShareOutcomes>;
}) {
  const outcomes = await outcomesPromise;
  return (
    // Laid out by its own width, not the viewport's: the same panel is full
    // width below xl and shares the row with the form above it. Beside the
    // form it stretches to the form's height, and its content is centered
    // in that height.
    <section
      className={`${BLOCK} @container flex min-w-0 flex-col justify-center`}
    >
      <div className="flex flex-col gap-4 @2xl:flex-row @2xl:items-center @2xl:justify-between @2xl:gap-10">
        <div className="min-w-0">
          <p className="text-2xl font-semibold tracking-tight">
            <span className="font-mono">{formatMillions(amount)}</span>{" "}
            <span className="whitespace-nowrap">in {season.season}</span>
          </p>
          <p className="mt-1 text-lg text-white/80">
            was{" "}
            <span className="font-mono font-semibold text-accent">
              {pct.toFixed(2)}%
            </span>{" "}
            <span className="whitespace-nowrap">of the league cap</span>
          </p>
          <p className="mt-1 text-sm text-white/50">
            League cap:{" "}
            <span className="font-mono">
              {formatCurrency(season.leagueCap)}
            </span>
          </p>
        </div>
        {outcomes.count > 0 && (
          <div className="flex flex-col gap-3 @md:flex-row">
            <HeaderBox
              label="Median Net Value"
              value={formatScore(outcomes.median)}
              caption={`${seasons(outcomes.count)} at ${pct.toFixed(1)}% ±${TOLERANCE}%`}
            />
            <HeaderBox
              label="Players with a +NV"
              value={`${Math.round(100 * (outcomes.shareAbove ?? 0))}%`}
              caption={`${Math.round((outcomes.shareAbove ?? 0) * outcomes.count).toLocaleString("en-US")} of ${outcomes.count.toLocaleString("en-US")}`}
            />
          </div>
        )}
      </div>
    </section>
  );
}

function OutcomeList({
  title,
  rows,
}: {
  title?: string;
  rows: CapLadderRow[];
}) {
  return (
    <div>
      {title && (
        <h3 className="mb-1 text-sm font-medium text-white/70">{title}</h3>
      )}
      <div className={SHEET}>
        <table className="w-full text-sm text-black">
          <thead className={SHEET_HEAD}>
            <tr>
              <th className={`${CELL} text-left font-medium`}>Player</th>
              <th className={`${CELL} text-center font-medium`}>Season</th>
              <th className={`${CELL} text-right font-medium`}>% of Cap</th>
              <th className={`${CELL} text-right font-medium`}>Net Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={`${r.playerId}-${r.season}`}
                className={`${stripeClass(i)} ${SHEET_ROW_HOVER}`}
              >
                <td className={CELL}>
                  <PlayerLink id={r.playerId} name={r.name} />
                </td>
                <td
                  className={`${CELL} text-center font-mono text-[0.8125rem] tabular-nums`}
                >
                  <SeasonLink season={r.season} />
                </td>
                <td className={NUM}>{r.pctOfLeagueCap.toFixed(2)}%</td>
                <td className={NUM}>
                  <span className={netValueClass(r.netValueScore)}>
                    {formatScore(r.netValueScore)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
