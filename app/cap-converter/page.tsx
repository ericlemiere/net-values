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
  type CapLadderRow,
  type CapSeason,
  type CapShareOutcomes,
} from "@/lib/db/queries";
import { PAGE_COLUMN } from "@/lib/layout";
import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Cap Converter",
  description:
    "What an NBA salary is worth in any other season, measured as a share of the salary cap, and what that share of the cap has bought.",
  path: "/cap-converter",
});

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

/** Millions to the hundredth, without trailing zeros: $48.07M, $7.5M, $20M. */
function formatMillions(millions: number) {
  return `$${Number(millions.toFixed(2))}M`;
}

function parseAmount(value: string | undefined) {
  const n = Number(value);
  return value && Number.isFinite(n) && n > 0 ? n : null;
}

export default async function CapConverterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const capSeasons = await getCapSeasons();
  const latest = capSeasons[capSeasons.length - 1];
  const season = capSeasons.find((s) => s.season === sp.season) ?? latest;
  // Entered either as a salary in millions or as a share of the cap; the
  // other one follows from the season's cap. A share wins if both are given.
  const pctParam = parseAmount(sp.pct);
  const mode: CapInputMode = pctParam !== null ? "pct" : "salary";
  const pct =
    pctParam !== null
      ? Math.round(pctParam * 100) / 100
      : Math.round(
          (10000 * (parseAmount(sp.amount) ?? 20) * 1e6) / season.leagueCap,
        ) / 100;
  const amount =
    pctParam !== null
      ? ((pct / 100) * season.leagueCap) / 1e6
      : (parseAmount(sp.amount) ?? 20);
  const entered = mode === "pct" ? pct : amount;

  const rows = [...capSeasons].reverse();
  const ladder = getCapLadder(pct, LADDER_TOLERANCE);
  const outcomes = getCapShareOutcomes(pct, TOLERANCE, 10);

  return (
    <div className={PAGE_COLUMN}>
      <PageHeader title="Cap Converter" />
      {/* Both queries start here and neither is awaited: the summary beside
          the form and the tables under it each wait on what they need, inside
          their own boundary, and the cached call behind them runs once. */}
      {/* Side by side only from xl: below that the summary is squeezed into
          what the form leaves, and its headline breaks a word to a line. The
          gap is the form's error message's to hang in, two lines of it on a
          phone. */}
      <div className="mb-8 grid grid-cols-1 gap-10 md:gap-8 xl:grid-cols-[auto_minmax(0,1fr)] xl:gap-4">
        {/* Keyed on the conversion, so back and forward reset the inputs to
            the URL rather than keeping whatever was last typed. */}
        <CapConverterForm
          key={`form:${season.season}:${mode}:${entered}`}
          capSeasons={rows}
          season={season.season}
          mode={mode}
          value={entered}
        />
        {/* Keyed on the inputs, so a new conversion mounts a new boundary and
            shows the skeleton while it loads. Without the key the client-side
            navigation keeps the old results on screen until the new ones land. */}
        <Suspense
          key={`summary:${season.season}:${mode}:${entered}`}
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
        key={`results:${season.season}:${mode}:${entered}`}
        fallback={<ResultsSkeleton />}
      >
        <Results
          capSeasons={capSeasons}
          season={season}
          pct={pct}
          ladder={ladder}
          outcomes={outcomes}
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
}: {
  capSeasons: CapSeason[];
  season: CapSeason;
  pct: number;
  ladder: Promise<CapLadderRow[]>;
  outcomes: Promise<CapShareOutcomes>;
}) {
  const [ladder, outcomes] = await Promise.all([
    ladderPromise,
    outcomesPromise,
  ]);
  const bySeason = new Map(ladder.map((r) => [r.season, r]));
  const rows = [...capSeasons].reverse();

  return (
    <>
      {/* On desktop the ladder takes its height from the outcomes beside it and
          scrolls inside that, rather than running the full forty seasons. */}
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-stretch">
        <section className="flex min-w-0 flex-col">
          <h2 className="text-lg font-semibold">
            The same money, every season
          </h2>
          <p className="mb-2 text-sm text-white/60">
            {pct.toFixed(2)}% of each season&rsquo;s cap, and the player paid
            closest to it.
          </p>
          <div className="lg:relative lg:min-h-80 lg:flex-1">
            <div
              className={`max-h-144 ${SHEET} lg:absolute! lg:inset-0 lg:max-h-none`}
            >
              <table className="w-max min-w-full text-sm text-black">
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
                            <td className={CELL}>
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
          <p className="mb-2 text-sm text-white/60">
            {outcomes.best.length} best seasons at this percentage
          </p>
          {outcomes.count === 0 ? (
            <p className={`${PANEL} text-sm text-white/50`}>
              No season with a Net Value was paid this share of the cap.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              <OutcomeList rows={outcomes.best} />
              <OutcomeList
                title={`${outcomes.worst.length} worst seasons at this percentage`}
                rows={outcomes.worst}
              />
            </div>
          )}
        </section>
      </div>
    </>
  );
}

/** Stands in for the tables under the form, in the same shapes. */
function ResultsSkeleton() {
  const block = "animate-pulse rounded-lg bg-white/5";
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
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
              caption={`${outcomes.count.toLocaleString("en-US")} seasons at ${pct.toFixed(1)}% ±${TOLERANCE}%`}
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
