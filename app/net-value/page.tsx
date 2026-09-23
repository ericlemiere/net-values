import { SimpleTable } from "@/components/SimpleTable";
import { PlayerLink } from "@/components/PlayerLink";
import { TeamLink } from "@/components/TeamLink";
import { Step, Term } from "@/components/Formula";
import type { ColumnDef } from "@/components/DataTable";
import {
  formatCurrency,
  formatRank,
  formatScore,
  formatStat,
} from "@/lib/format";
import {
  AVAILABILITY_FLOOR,
  getAwardsForRows,
  getNetValueExamples,
  type NetValueExample,
} from "@/lib/db/queries";
import { awardKey, type Award } from "@/lib/awards";

export const metadata = {
  title: "Net Value - The Net Values",
  description: "How the Net Value figure is calculated, with worked examples.",
};

function exampleColumns(
  showSeason: boolean,
  awards: Map<string, Award[]>,
): ColumnDef<NetValueExample>[] {
  return [
    {
      key: "name",
      label: "Player",
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
            render: (r: NetValueExample) => r.season,
          },
        ]
      : []),
    {
      key: "team",
      label: "Team",
      align: "center",
      render: (r) => <TeamLink abbr={r.team} label={r.teamLabel} />,
    },
    {
      key: "salary",
      label: "Salary",
      align: "right",
      render: (r) => formatCurrency(r.salary),
    },
    {
      key: "salaryRank",
      label: "Pay Rank",
      align: "right",
      render: (r) => formatRank(r.salaryRank),
    },
    {
      key: "production",
      label: "Produced",
      align: "right",
      description: "Wins above a replacement-level player (VORP).",
      render: (r) => formatStat(r.production),
    },
    {
      key: "expectedProduction",
      label: "Bought",
      align: "right",
      description:
        "The production his pay bought at the league's going rate, over the time he was available.",
      render: (r) => formatStat(r.expectedProduction),
    },
    {
      key: "netValueScore",
      label: "Net Value",
      align: "right",
      render: (r) => formatScore(r.netValueScore),
    },
  ];
}

export default async function NetValuePage() {
  const { season, best, worst, overCap, latestTop, latestBottom, pricing } =
    await getNetValueExamples();

  // Every example row on the page, so one lookup covers all four tables.
  const awards = await getAwardsForRows([
    ...best,
    ...worst,
    ...overCap,
    ...latestTop,
    ...latestBottom,
  ]);

  const dollarsPerWin = pricing ? pricing.pool / pricing.produced : null;
  const hero = latestTop[0];
  // What his pay claims before the season-wide re-centring, so the worked
  // example can show that shift as its own step rather than having a number
  // appear from nowhere.
  const chargedShare = hero
    ? AVAILABILITY_FLOOR + (1 - AVAILABILITY_FLOOR) * hero.availability
    : 0;
  const rawClaim =
    hero && pricing
      ? (hero.salary / pricing.pool) * pricing.produced * chargedShare
      : 0;
  const drift = hero ? hero.expectedProduction - rawClaim : 0;
  const salarySharePct =
    hero && pricing && pricing.pool ? (100 * hero.salary) / pricing.pool : 0;
  const availabilityShare = hero?.availability ?? 0;

  /*
   * `w-full min-w-0` on the column is what keeps the page inside a phone: it
   * is a flex item, so without it the widest table's own width becomes the
   * column's minimum and the whole page scrolls sideways instead of the table
   * scrolling inside its frame.
   */
  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl px-4 py-6 text-white sm:p-6">
      <h1 className="text-3xl font-semibold tracking-tight">Net Value</h1>
      <p className="mt-3 max-w-prose text-white/70">
        Every player is paid to produce. Net Value is the gap between what a
        player actually produced and what his salary bought at the going rate.
        Zero means he was paid about what he was worth. Positive means the team
        got more than it paid for.
      </p>
      <p className="mt-3 max-w-prose text-white/70">
        Production is counted in points of value over replacement, and one point
        is worth roughly <strong className="text-accent">two extra wins</strong>{" "}
        for a team. So a Net Value of +5 means a player returned about ten wins
        more than his contract paid for.
      </p>

      <div className="my-8 w-fit max-w-full overflow-x-auto rounded-lg border-2 border-accent bg-background-box/80 px-4 py-3 sm:px-5 sm:py-4">
        <p className="font-mono text-sm whitespace-normal text-accent sm:text-base sm:whitespace-nowrap">
          Net Value = value produced − value bought
        </p>
      </div>

      {/* ---------- worked example ---------- */}
      {hero && pricing && (
        <section className="mt-12">
          <h2 className="text-xl font-semibold tracking-tight">
            Worked example: {hero.name}, {hero.season}
          </h2>
          <p className="mt-2 max-w-prose text-sm text-white/70">
            The best Net Value in the league that season, step by step.
          </p>

          <ol className="mt-6 space-y-6">
            <Step
              n={1}
              title="Start from what a replacement player gives you"
              working={`a roster of replacement players wins roughly 20 of 82 games`}
            >
              A replacement player is the sort any team can sign who will
              produce at the level of a typical player. Production is measured
              against that floor, not against zero, because even a team fielding
              players below that level still wins some games. Everything above
              the floor is what real players add.
            </Step>

            <Step
              n={2}
              title="Add up every player's production for the season"
              working={`${pricing.players} players → ${formatStat(
                pricing.produced,
              )} points of value over replacement`}
            >
              {`Each player's figure is VORP, taken from Basketball-Reference rather than calculated here. Adding all ${pricing.players} players VORP gives ${formatStat(pricing.produced)} for ${season}, about ${formatStat(pricing.produced / 30)} per team, or roughly ${Math.round((pricing.produced / 30) * 2.17)} wins per team above the replacement floor.`}
            </Step>

            <Step
              n={3}
              title="Divide the league's payroll by it to get the price of a point"
              working={`$${Math.round(pricing.pool).toLocaleString()} ÷ ${formatStat(
                pricing.produced,
              )} = $${Math.round(dollarsPerWin!).toLocaleString()} per value point`}
            >
              Every salary paid in {season}, which totals $
              {Math.round(pricing.pool).toLocaleString()}, bought every point of
              production in {season}. Doing this within each season is what
              makes the figure comparable across eras. A point in 1994 and a
              point in 2026 cost wildly different amounts, and this accounts for
              it without any inflation adjustment.
            </Step>

            <Step
              n={4}
              title="Work out what this player's pay claims"
              working={[
                `$${hero.salary.toLocaleString()} ÷ $${Math.round(
                  pricing.pool,
                ).toLocaleString()} = ${salarySharePct.toFixed(2)}% of all salary`,
                `${salarySharePct.toFixed(2)}% × ${formatStat(
                  pricing.produced,
                )} points = ${formatStat(
                  (hero.salary / pricing.pool) * pricing.produced,
                )} points`,
              ]}
            >
              {`${hero.name} was the ${formatRank(hero.salaryRank)} highest paid player in the league, making $${hero.salary.toLocaleString()} in ${season}. Taking that share of everything the league produced is what his contract is buying.`}
            </Step>

            <Step
              n={5}
              title="Scale it by how much of the season he was available"
              working={[
                `${Math.round(hero.minutes).toLocaleString()} min played ÷ ${Math.round(
                  hero.fullWorkload,
                ).toLocaleString()} min full workload = ${availabilityShare.toFixed(2)} available`,
                `${AVAILABILITY_FLOOR} + ${1 - AVAILABILITY_FLOOR} × ${availabilityShare.toFixed(
                  2,
                )} = ${chargedShare.toFixed(2)} charged  →  ${formatStat(rawClaim)} points`,
              ]}
            >
              {`A full season's work is a starter playing 30 minutes a night, every game. That is ${Math.round(hero.fullWorkload / 30)} games in ${season}, so ${Math.round(hero.fullWorkload).toLocaleString()} minutes. Taking it from the schedule means lockout and suspended seasons size themselves. He played ${Math.round(hero.minutes).toLocaleString()}.`}
              <br />
              <br />
              {`Production already falls when a player misses games, so charging him against a full season's salary on top of that would penalise the injury twice. But only half the contract bends to it. Scaling all the way down to nothing would multiply the salary out of the sum entirely, and a player who never took the floor would be charged for nothing at all — which is how a $45.6M contract and a $464,050 one once came out with the same score. Half of what a contract buys is being available; half is what you do once you are.`}
            </Step>

            <Step
              n={6}
              title="Nudge every expectation so the league averages zero"
              working={`${formatStat(rawClaim)} ${
                drift >= 0 ? "+" : "−"
              } ${formatStat(Math.abs(drift))} = ${formatStat(
                hero.expectedProduction,
              )} points bought`}
            >
              {`The charged share is never more than 1, so across the league these expectations add up to a little less than what was actually produced, which would leave the average player looking slightly positive. Every expectation in ${season} is shifted by the same ${formatStat(Math.abs(drift))} points to correct it. It is the same nudge for everyone, so it changes nobody's rank, and it is what makes a score of zero mean "paid the going rate".`}
            </Step>

            <Step
              n={7}
              title="Subtract what he was bought for from what he produced"
              working={`${formatStat(hero.production)} produced − ${formatStat(
                hero.expectedProduction,
              )} bought = ${formatScore(hero.netValueScore)}`}
            >
              {`The ${formatStat(hero.production)} is his VORP for the season, straight off his player page. So he returned ${formatScore(hero.netValueScore)} points, about ${Math.round(hero.netValueScore * 2.17)} wins, more than his contract paid for, ${formatRank(hero.seasonRank)} in the league.`}
            </Step>
          </ol>
        </section>
      )}

      {/* ---------- the terms ---------- */}
      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight">
          The three inputs
        </h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          <Term name="Produced">
            Value over replacement (VORP), taken from Basketball-Reference. A
            counting stat: more minutes at the same level means more production.
          </Term>
          <Term name="Bought">
            The player&rsquo;s share of all salary paid that season, times all
            the production that season, scaled by his availability.
          </Term>
          <Term name="Availability">
            Minutes played as a share of a full season&rsquo;s work, meaning a
            starter at 30 minutes a night for every game on the schedule, capped
            at 1. Minutes rather than games played, because minutes is what
            production scales with. Half a contract is charged whatever this
            comes to, so a season spent injured still costs something.
          </Term>
        </dl>
      </section>

      {/* ---------- provenance ---------- */}
      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight">
          Where the production number comes from
        </h2>
        <p className="mt-2 max-w-prose text-sm text-white/70">
          It is not calculated here. Production is VORP,{" "}
          <em>value over replacement player</em>, published by{" "}
          <a
            href="https://www.basketball-reference.com/about/bpm2.html"
            className="text-accent hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            Basketball-Reference
          </a>
          , who derive it from the box score. Every season back to 1989-90 is
          read from them; Net Value adds the salary side and the pricing.
        </p>
        <p className="mt-3 max-w-prose text-sm text-white/70">
          VORP is not measured in wins, which is why the league total lands on a
          figure like {pricing ? formatStat(pricing.produced) : "350"} rather
          than the 1,230 games an NBA season actually contains. To check what a
          point is worth, every team&rsquo;s VORP was fitted against how many
          games that team really won, across 937 full 82-game team-seasons:
        </p>
        <p className="mt-3 overflow-x-auto rounded-md border border-white/15 bg-background-box/90 px-3 py-2 font-mono text-xs whitespace-normal text-accent sm:text-sm sm:whitespace-nowrap">
          team wins = 20.1 + 2.17 × team VORP&nbsp;&nbsp;&nbsp;(r = 0.95)
        </p>
        <p className="mt-3 max-w-prose text-sm text-white/70">
          So one point of VORP is worth about two and a fifth wins. That fit is
          also the reason to trust the input at all: a metric that tracks real
          results this closely is measuring something, whatever its flaws.
        </p>
      </section>

      {/* ---------- why subtraction ---------- */}
      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight">
          Why subtract instead of divide
        </h2>
        <p className="mt-2 max-w-prose text-sm text-white/70">
          &ldquo;Production per dollar&rdquo; sounds like the natural way to
          measure value, but it breaks immediately: a small number divided by a
          tiny number is enormous, so the leaderboard fills with
          minimum-contract bench players and every star sinks. Subtraction asks
          the question people actually mean: how much more was he worth than he
          cost?
        </p>
        <div className="mt-4 overflow-x-auto rounded-lg border border-white/15 bg-background-box/90">
          <table className="min-w-full text-xs whitespace-nowrap sm:text-sm">
            <thead className="border-b border-white/15 text-white/60">
              <tr>
                <th className="px-3 py-2 text-left font-medium sm:px-4">
                  Player
                </th>
                <th className="px-3 py-2 text-right font-medium sm:px-4">
                  Produced
                </th>
                <th className="px-3 py-2 text-right font-medium sm:px-4">
                  Paid
                </th>
                <th className="px-3 py-2 text-right font-medium sm:px-4">
                  Per dollar
                </th>
                <th className="px-3 py-2 text-right font-medium sm:px-4">
                  Subtracted
                </th>
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums text-white/80">
              <tr className="border-b border-white/10">
                <td className="px-3 py-2 font-sans sm:px-4">
                  A star on a max deal
                </td>
                <td className="px-3 py-2 text-right sm:px-4">9.0</td>
                <td className="px-3 py-2 text-right sm:px-4">$50,000,000</td>
                <td className="px-3 py-2 text-right text-white/40 sm:px-4">
                  0.18 per $1M
                </td>
                <td className="px-3 py-2 text-right text-accent sm:px-4">
                  +5.8
                </td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-sans sm:px-4">
                  A 12th man on the minimum
                </td>
                <td className="px-3 py-2 text-right sm:px-4">0.4</td>
                <td className="px-3 py-2 text-right sm:px-4">$1,200,000</td>
                <td className="px-3 py-2 text-right text-accent sm:px-4">
                  0.33 per $1M
                </td>
                <td className="px-3 py-2 text-right text-white/40 sm:px-4">
                  +0.3
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 max-w-prose text-sm text-white/60">
          Per dollar, the 12th man wins by almost double. Subtracted, the star
          is worth nearly twenty times more, which is the answer anyone building
          a roster would recognise.
        </p>
      </section>

      {/* ---------- reading the scale ---------- */}
      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight">
          Reading the scale
        </h2>
        <p className="mt-2 max-w-prose text-sm text-white/70">
          Net Value is measured in production, not money, so it doesn&rsquo;t
          inflate with the cap. Across the whole database it runs from about −7
          to +9, and every season averages exactly zero.
        </p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Term name="+5 and up">
            An all-time bargain. Usually a superstar still on a rookie deal.
          </Term>
          <Term name="+1 to +5">
            A clear win for the team. Good starters on sensible money.
          </Term>
          <Term name="−1 to +1">
            Paid about right. Most of the league lives here.
          </Term>
          <Term name="Below −1">
            The contract is underwater: injury, decline, or an overpay.
          </Term>
        </dl>
      </section>

      {/* ---------- real tables ---------- */}
      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight">
          Best Net Value seasons on record
        </h2>
        <p className="mt-2 mb-4 max-w-prose text-sm text-white/70">
          Every one of these is a superstar season on a contract signed before
          the player became a superstar.
        </p>
        <SimpleTable
          columns={exampleColumns(true, awards)}
          rows={best}
          rowKey={(r) => `${r.playerId}-${r.season}`}
        />

        <h2 className="mt-8 text-xl font-semibold tracking-tight">
          And the worst
        </h2>
        <p className="mt-2 mb-4 max-w-prose text-sm text-white/70">
          Large contracts that didn&rsquo;t return the wins, usually because the
          player got hurt or the deal outlived his prime.
        </p>
        <SimpleTable
          columns={exampleColumns(true, awards)}
          rows={worst}
          rowKey={(r) => `${r.playerId}-${r.season}`}
        />

        {overCap.length > 0 && (
          <aside className="mt-6 rounded-lg border border-white/15 bg-background-box/90 p-4 sm:p-5">
            <h3 className="font-semibold text-white">
              Two seasons are kept out of that list
            </h3>
            <p className="mt-2 max-w-prose text-sm text-white/70">
              {`Michael Jordan was paid more than the entire league salary cap in ${overCap
                .map((r) => r.season)
                .join(
                  " and ",
                )}. A quirk of the collective bargaining agreement let Chicago re-sign their own free agent for any amount, and nobody else in NBA history has been paid above the cap. The next highest share anyone has taken is 81%.`}
            </p>
            <div className="mt-4 overflow-x-auto rounded-lg border border-white/15">
              <table className="min-w-full text-xs whitespace-nowrap sm:text-sm">
                <thead className="border-b border-white/15 text-white/60">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium sm:px-4">
                      Season
                    </th>
                    <th className="px-3 py-2 text-right font-medium sm:px-4">
                      Salary
                    </th>
                    <th className="px-3 py-2 text-right font-medium sm:px-4">
                      Share of cap
                    </th>
                    <th className="px-3 py-2 text-right font-medium sm:px-4">
                      Produced
                    </th>
                    <th className="px-3 py-2 text-right font-medium sm:px-4">
                      Bought
                    </th>
                    <th className="px-3 py-2 text-right font-medium sm:px-4">
                      Net Value
                    </th>
                  </tr>
                </thead>
                <tbody className="font-mono tabular-nums text-white/80">
                  {overCap.map((r) => (
                    <tr key={r.season} className="border-t border-white/10">
                      <td className="px-3 py-2 sm:px-4">{r.season}</td>
                      <td className="px-3 py-2 text-right sm:px-4">
                        {formatCurrency(r.salary)}
                      </td>
                      <td className="px-3 py-2 text-right sm:px-4">
                        {r.leagueCap
                          ? `${formatStat((100 * r.salary) / r.leagueCap)}%`
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-right sm:px-4">
                        {formatStat(r.production)}
                      </td>
                      <td className="px-3 py-2 text-right sm:px-4">
                        {formatStat(r.expectedProduction)}
                      </td>
                      <td className="px-3 py-2 text-right sm:px-4">
                        {formatScore(r.netValueScore)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 max-w-prose text-sm text-white/70">
              The arithmetic is right and the conclusion is still wrong. To
              break even on a contract that size he would have had to produce
              more than any player ever has in a season, so the bar was
              unreachable before he played a game, and he was the best player
              alive both years, winning the title each time. It is a fact about
              a contract no team can sign today, not a judgement on the player,
              so listing it beside genuine overpays would mislead.
            </p>
          </aside>
        )}

        <h2 className="mt-8 text-xl font-semibold tracking-tight">
          Best of {season}
        </h2>
        <div className="mt-4">
          <SimpleTable
            columns={exampleColumns(false, awards)}
            rows={latestTop}
            rowKey={(r) => `${r.playerId}-${r.season}`}
          />
        </div>
        <h2 className="mt-8 text-xl font-semibold tracking-tight">
          Worst of {season}
        </h2>
        <div className="mt-4">
          <SimpleTable
            columns={exampleColumns(false, awards)}
            rows={latestBottom}
            rowKey={(r) => `${r.playerId}-${r.season}`}
          />
        </div>
      </section>

      {/* ---------- team net value ---------- */}
      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight">Team Net Value</h2>
        <p className="mt-2 max-w-prose text-sm text-white/70">
          A team&rsquo;s Net Value is its roster&rsquo;s added up, how many the
          squad returned above what it cost. It counts only players on a full
          contract, meaning a salary of at least 0.5% of that season&rsquo;s
          cap, which excludes two-way deals and part-season signings while
          leaving a standard 15-man roster in every era.
        </p>
        <p className="mt-3 max-w-prose text-sm text-white/70">
          It is a sum rather than an average on purpose. A team carrying extra
          bodies through injuries would see an average dragged toward its
          fill-ins, while the sum says plainly what the whole roster returned.
          Summed by team and compared with real results, it correlates with
          actual wins at r = 0.81.
        </p>
      </section>

      {/* ---------- honest limits ---------- */}
      <section className="mt-12 mb-4">
        <h2 className="text-xl font-semibold tracking-tight">
          What it can&rsquo;t do
        </h2>
        <ul className="mt-3 max-w-prose list-disc space-y-2 pl-5 text-sm text-white/70">
          <li>
            Production comes from VORP, which is built from the box score. Box
            scores record very little of what defence actually is, so defensive
            specialists are undersold.
          </li>
          <li>
            It measures value against pay, not talent. A very good player on the
            largest contract in the league will land near zero, because
            &ldquo;very good&rdquo; is what that contract is supposed to buy.
          </li>
          <li>
            Salary data starts in 1990-91, so no season before it has a Net
            Value, however good it was.
          </li>
          <li>
            Nothing here knows about team fit, role, or why a player was signed.
            A contract can be defensible and still score badly.
          </li>
        </ul>
      </section>
    </div>
  );
}
