import { Section, PROSE } from "./Section";

const TH = "px-3 py-2 text-right font-medium sm:px-4";
const TD = "px-3 py-2 text-right sm:px-4";

/** Why Net Value is a difference rather than a ratio. */
export function WhySubtract() {
  return (
    <Section title="Why subtract instead of divide">
      <p className={PROSE}>
        &ldquo;Production per dollar&rdquo; sounds like the natural way to
        measure value, but it breaks immediately: a small number divided by a
        tiny number is enormous, so the leaderboard fills with minimum-contract
        bench players and every star sinks. Subtraction asks the question people
        actually mean: how much more was he worth than he cost?
      </p>
      <div className="mt-4 overflow-x-auto rounded-lg border border-white/15 bg-background-box/90">
        <table className="min-w-full text-xs whitespace-nowrap sm:text-sm">
          <thead className="border-b border-white/15 text-white/60">
            <tr>
              <th className="px-3 py-2 text-left font-medium sm:px-4">
                Player
              </th>
              <th className={TH}>Value Produced</th>
              <th className={TH}>Salary</th>
              <th className={TH}>Divided</th>
              <th className={TH}>Subtracted (Net Value)</th>
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums text-white/80">
            <tr className="border-b border-white/10">
              <td className="px-3 py-2 font-sans sm:px-4">
                A star on a max deal
              </td>
              <td className={TD}>9.0 NVPs</td>
              <td className={TD}>$50,000,000</td>
              <td className={`${TD} text-white/40`}>0.18 NVPs per $1M</td>
              <td className={`${TD} text-accent`}>+5.8 NVPs</td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-sans sm:px-4">
                A 12th man on the minimum
              </td>
              <td className={TD}>0.4 NVPs</td>
              <td className={TD}>$1,200,000</td>
              <td className={`${TD} text-accent`}>0.33 NVPs per $1M</td>
              <td className={`${TD} text-white/40`}>+0.3 NVPs</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-3 max-w-prose text-sm text-white/60">
        Divided, the 12th man wins by almost double. Subtracted, the star is
        worth nearly twenty times more, which is the answer anyone building a
        roster would recognize.
      </p>
    </Section>
  );
}
