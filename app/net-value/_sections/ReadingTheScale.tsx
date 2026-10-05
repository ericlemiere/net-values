import type { ReactNode } from "react";
import {
  formatScore,
  NET_VALUE_MARK,
  NET_VALUE_STRONG,
  netValueClass,
} from "@/lib/format";
import type { NetValueScale } from "@/lib/db/queries";
import { Section, PROSE } from "./Section";

const MARK = formatScore(NET_VALUE_MARK).slice(1);
const STRONG = formatScore(NET_VALUE_STRONG).slice(1);

/** A rough end of the scale, signed and rounded to a whole NVP: "+9". */
function wholeScore(value: number): string {
  return formatScore(Math.round(value)).replace(/\.00$/, "");
}

/** A band's share of every scored player-season, as a whole percent. */
function share(count: number, total: number): string {
  if (total === 0) return "0%";
  const pct = (100 * count) / total;
  return pct > 0 && pct < 1 ? "under 1%" : `${Math.round(pct)}%`;
}

/**
 * The scale's bands, best first. Each is one of the colors the tables print a
 * Net Value in, so the boxes double as the tables' legend. The shares are
 * counted live, so they keep up as seasons are added.
 */
function bands(
  scale: NetValueScale,
): { sample: number; name: string; body: ReactNode }[] {
  const of = (n: number) =>
    `${share(n, scale.total)} of player-seasons land here.`;
  const elite =
    scale.elite > 0
      ? ` At the top end are the all-time bargains: ${scale.elitePlayers} ${
          scale.elitePlayers === 1 ? "player has" : "players have"
        } reached +5 in a season, ${scale.elite} ${
          scale.elite === 1 ? "time" : "times"
        } in all${
          scale.elitePctCap === null
            ? ""
            : `, and in those seasons they averaged a pay of around ${Math.round(scale.elitePctCap)}% of that season’s salary cap`
        }.`
      : "";
  return [
    {
      sample: 2.4,
      name: `+${STRONG} NVPs and up`,
      body: `A clear win for the team. ${of(scale.strongGood)}${elite}`,
    },
    {
      sample: 0.9,
      name: `+${MARK} to +${STRONG} NVPs`,
      body: `Good value: a useful player on sensible money. ${of(scale.good)}`,
    },
    {
      sample: 0.1,
      name: `\u2212${MARK} to +${MARK} NVPs`,
      body: `Paid about right, within about a win either way. ${of(scale.fair)}`,
    },
    {
      sample: -0.9,
      name: `\u2212${STRONG} to \u2212${MARK} NVPs`,
      body: `Overpaid, but not badly. ${of(scale.bad)}`,
    },
    {
      sample: -2.2,
      name: `Below \u2212${STRONG} NVPs`,
      body: `The contract is underwater: injury, decline, or an overpay. ${of(scale.strongBad)}`,
    },
  ];
}

/** What a given Net Value means. */
export function ReadingTheScale({ scale }: { scale: NetValueScale }) {
  return (
    <Section title="Reading the scale">
      <p className={PROSE}>
        Net Value is counted in NVPs, not dollars, so it doesn&rsquo;t inflate
        with the cap. Across the whole database it runs from about{" "}
        {wholeScore(scale.min)} to {wholeScore(scale.max)} NVPs, and every
        season averages zero. The tables color each figure by the band it falls
        in, as shown on the left of each box below. Each box also gives the
        share of all {`${scale.total.toLocaleString("en-US")} player-seasons`}{" "}
        on record that land in it, where one player-season is one player&rsquo;s
        year: Nikola Jokić&rsquo;s 2025-2026, for instance.
      </p>
      <dl className="mt-4 grid max-w-2xl gap-3">
        {bands(scale).map((b) => (
          <div
            key={b.name}
            className="flex items-start gap-4 rounded-lg border border-white/15 bg-background-box/90 px-4 py-3"
          >
            {/* The figure as a table prints it, on the table's own white. */}
            <span className="w-16 shrink-0 rounded bg-surface px-2 py-1 text-right font-mono text-[0.8125rem] tabular-nums text-black">
              <span className={netValueClass(b.sample)}>
                {formatScore(b.sample)}
              </span>
            </span>
            <div>
              <dt className="font-mono text-sm font-semibold text-accent">
                {b.name}
              </dt>
              <dd className="mt-1 text-sm text-white/70">{b.body}</dd>
            </div>
          </div>
        ))}
      </dl>
    </Section>
  );
}
