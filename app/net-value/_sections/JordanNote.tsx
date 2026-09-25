import { SeasonLink } from "@/components/SeasonLink";
import type { NetValueExample } from "@/lib/db/queries";
import { formatCurrency, formatScore, formatStat } from "@/lib/format";
import { Section, PROSE } from "./Section";

const TH = "px-3 py-2 text-right font-medium sm:px-4";
const TD = "px-3 py-2 text-right sm:px-4";

/**
 * The two seasons held out of the worst list, and why. At the foot of the page
 * rather than beside the list, so the four tables stay together; the worst
 * list's subtitle links down here.
 */
export function JordanNote({ overCap }: { overCap: NetValueExample[] }) {
  if (overCap.length === 0) return null;
  return (
    <Section
      id="jordan"
      title="Why Michael Jordan is left off the worst list"
      className="mb-4"
    >
      <p className={PROSE}>
        {`Michael Jordan was paid more than the entire league salary cap in ${overCap
          .map((r) => r.season)
          .join(
            " and ",
          )}. A quirk of the collective bargaining agreement let Chicago re-sign their own free agent for any amount, and nobody else in NBA history has been paid above the cap. The next highest share anyone has taken is 81%.`}
      </p>
      <div className="mt-4 overflow-x-auto rounded-lg border border-white/15 bg-background-box/90">
        <table className="min-w-full text-xs whitespace-nowrap sm:text-sm">
          <thead className="border-b border-white/15 text-white/60">
            <tr>
              <th className="px-3 py-2 text-left font-medium sm:px-4">
                Season
              </th>
              <th className={TH}>Salary</th>
              <th className={TH}>Share of cap</th>
              <th className={TH}>Value Produced</th>
              <th className={TH}>Value Bought</th>
              <th className={TH}>Net Value</th>
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums text-white/80">
            {overCap.map((r) => (
              <tr key={r.season} className="border-t border-white/10">
                <td className="px-3 py-2 sm:px-4">
                  <SeasonLink season={r.season} />
                </td>
                <td className={TD}>{formatCurrency(r.salary)}</td>
                <td className={TD}>
                  {r.leagueCap
                    ? `${formatStat((100 * r.salary) / r.leagueCap)}%`
                    : "N/A"}
                </td>
                <td className={TD}>{formatStat(r.production)} NVPs</td>
                <td className={TD}>{formatStat(r.expectedProduction)} NVPs</td>
                <td className={TD}>{formatScore(r.netValueScore)} NVPs</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={PROSE}>
        The arithmetic is right and the conclusion is still wrong. To break even
        on a contract that size he would have had to produce more than any
        player ever has in a season, so the bar was unreachable before he played
        a game, and he was the best player alive both years, winning the title
        each time. It is a fact about a contract no team can sign today, not a
        judgment on the player, so listing it beside genuine overpays would
        mislead.
      </p>
      <p className={PROSE}>
        <a href="#worst-seasons" className="underline">
          Back to the worst seasons
        </a>
      </p>
    </Section>
  );
}
