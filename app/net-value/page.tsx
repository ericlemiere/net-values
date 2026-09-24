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
      description:
        "His share of the points his team's offense and defense produced above league average, in NVPs. About 2.5 team wins per NVP.",
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
  // What his pay claims before the season-wide re-centering, so the worked
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
  // The worked example has to add up on the page. These quantities are small
  // enough that one decimal rounds each term separately and leaves the sums
  // visibly wrong: 0.73 + 0.13 = 0.86 renders as "0.7 + 0.1 = 0.9".
  const nvp = (value: number) => value.toFixed(2);
  const claimBeforeAvailability =
    hero && pricing ? (hero.salary / pricing.pool) * pricing.produced : 0;
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
        Production is counted in{" "}
        <strong className="text-accent">Net Value Points (NVPs)</strong> and one
        NVP is worth roughly{" "}
        <strong className="text-accent">two and a half extra wins</strong> for
        a team. So a Net Value of +5 means a player returned about thirteen wins
        more than his contract paid for. An NVP is a unit of value, not a point
        scored. A rim protector earns them as readily as a scorer does.
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
              working={`5 players × −2 per 100 possessions = −10 per 100 ≈ 16 wins`}
            >
              A replacement player is one a team can always add without giving
              anything up for him: a veteran on a minimum deal, a two-way
              contract, a call-up from the G League. There is a steady supply,
              so a roster spot filled that way costs a team nothing but the
              minimum. That level is set two points per 100 possessions below a
              league-average player, which puts a whole roster of them about ten
              points per 100 below average, worth roughly sixteen wins over a
              season. Production is measured from that floor rather than from
              zero, because a team filled with freely available players still
              wins some games. What counts is what a player adds on top of
              what any team could have had for nothing.
            </Step>

            <Step
              n={2}
              title="Add up every player's production for the season"
              working={`${pricing.players} players → ${formatStat(
                pricing.produced,
              )} NVPs of value over replacement`}
            >
              {`Each player's figure is his share of the points his team's offense and defense actually generated above league average. A season spent below the replacement floor counts as zero rather than as a negative, because a team gets nothing back from those minutes and is not paid for them either. Adding up the ${pricing.players} salaried players on that basis gives ${formatStat(pricing.produced)} NVPs for ${season}, about ${formatStat(pricing.produced / 30)} per team.`}
            </Step>

            <Step
              n={3}
              title="Divide the league's payroll by it to get the price of an NVP"
              working={`$${Math.round(pricing.pool).toLocaleString()} ÷ ${formatStat(
                pricing.produced,
              )} = $${Math.round(dollarsPerWin!).toLocaleString()} per NVP`}
            >
              Every salary paid in {season}, which totals $
              {Math.round(pricing.pool).toLocaleString()}, bought every NVP of
              production in {season}. Doing this within each season is what
              makes the figure comparable across eras. An NVP in 1994 and an NVP
              in 2026 cost wildly different amounts, and this accounts for it
              without any inflation adjustment.
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
                )} NVPs = ${nvp(claimBeforeAvailability)} NVPs`,
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
                )} = ${chargedShare.toFixed(2)} charged`,
                `${nvp(claimBeforeAvailability)} NVPs × ${chargedShare.toFixed(
                  2,
                )} = ${nvp(rawClaim)} NVPs`,
              ]}
            >
              {`A full season's work is a starter playing 30 minutes a night, every game. That is ${Math.round(hero.fullWorkload / 30)} games in ${season}, so ${Math.round(hero.fullWorkload).toLocaleString()} minutes. Taking it from the schedule means lockout and suspended seasons size themselves. He played ${Math.round(hero.minutes).toLocaleString()}.`}
              <br />
              <br />
              {`Production already falls when a player misses games, so charging him against a full season's salary on top of that would penalize the injury twice. But only half the contract bends to it. Scaling all the way down to nothing would multiply the salary out of the sum entirely, and a player who never took the floor would be charged for nothing at all. Half of what a contract buys is being available; half is what you do once you are.`}
            </Step>

            <Step
              n={6}
              title="Nudge every expectation so the league averages zero"
              working={`${nvp(rawClaim)} ${
                drift >= 0 ? "+" : "−"
              } ${nvp(Math.abs(drift))} = ${nvp(
                hero.expectedProduction,
              )} NVPs bought`}
            >
              {`The charged share is never more than 1, so across the league these expectations add up to a little less than what was actually produced, which would leave the average player looking slightly positive. Every expectation in ${season} is shifted by the same ${nvp(Math.abs(drift))} NVPs to correct it. It is the same nudge for everyone, so it changes nobody's rank, and it is what makes a score of zero mean "paid the going rate".`}
            </Step>

            <Step
              n={7}
              title="Subtract what he was bought for from what he produced"
              working={`${nvp(hero.production)} produced − ${nvp(
                hero.expectedProduction,
              )} bought = ${formatScore(hero.netValueScore)}`}
            >
              {`The ${nvp(hero.production)} is what he produced that season, straight off his player page. So he returned ${formatScore(hero.netValueScore)} NVPs, about ${Math.round(hero.netValueScore * 2.51)} wins, more than his contract paid for, ${formatRank(hero.seasonRank)} in the league.`}
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
            His share of the points his team&rsquo;s offense and defense
            generated above league average, measured against a replacement-level
            floor. A counting stat: more minutes at the same level means more
            production.
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
          It is built here, from nba.com&rsquo;s own data, and it works the
          opposite way round from a box-score metric. A box-score metric
          estimates a player from his own counting stats and hopes a roster adds
          up to the team. This starts from what the team demonstrably did, taking
          every team&rsquo;s offensive and defensive points above league average
          from the possessions and points in its game logs, and divides that
          between the players. The total is therefore never wrong, and the whole
          modeling problem becomes the split.
        </p>
        <p className="mt-3 max-w-prose text-sm text-white/70">
          Offense is split by box-score credit, which the box score is good at:
          shooting efficiency above league average on the player&rsquo;s own
          volume, weighted down by how much of it team-mates created for him,
          plus playmaking, turnovers, offensive rebounds and the plain value of
          taking a shot on. Defense is split by minutes, tilted by a
          defensive-quality model fitted to thirty-six seasons of All-Defensive
          voting, and from 2013-14 on, by tracking data on shots defended and
          how badly the shooters did.
        </p>
        <p className="mt-3 max-w-prose text-sm text-white/70">
          Production is not measured in wins, which is why the league total
          lands on a figure like{" "}
          {pricing ? formatStat(pricing.produced) : "300"} rather than the 1,230
          games an NBA season actually contains. To check what an NVP is worth,
          every team&rsquo;s production was fitted against how many games that
          team really won, across 935 full 82-game team-seasons:
        </p>
        <p className="mt-3 overflow-x-auto rounded-md border border-white/15 bg-background-box/90 px-3 py-2 font-mono text-xs whitespace-normal text-accent sm:text-sm sm:whitespace-nowrap">
          team wins = 15.8 + 2.51 × team production&nbsp;&nbsp;&nbsp;(r = 0.97)
        </p>
        <p className="mt-3 max-w-prose text-sm text-white/70">
          So one NVP is worth about two and a half wins, and a roster
          producing nothing at all lands on the sixteen wins step one started
          from. That fit is also the reason
          to trust the figure at all: something tracking real results this
          closely is measuring something, whatever its flaws.
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
          a roster would recognize.
        </p>
      </section>

      {/* ---------- reading the scale ---------- */}
      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight">
          Reading the scale
        </h2>
        <p className="mt-2 max-w-prose text-sm text-white/70">
          Net Value is measured in production, not money, so it doesn&rsquo;t
          inflate with the cap. Across the whole database it runs from about −5
          to +9, and every season averages zero.
        </p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Term name="+5 and up">
            An all-time bargain, and rare: 73 seasons out of 17,000, at an
            average of 19% of the cap.
          </Term>
          <Term name="+1 to +5">
            A clear win for the team. Good starters on sensible money.
          </Term>
          <Term name="−1 to +1">
            Paid about right. Five of every six player-seasons land here.
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
          All-time seasons bought cheaply. Some are rookie deals, the rest are
          long contracts signed before the cap and the player&rsquo;s price
          caught up with him. The ten of them averaged 19% of the cap.
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
          Contracts that didn&rsquo;t return what they cost. Six of these ten
          players were available all season, so this is mostly money running
          well ahead of production rather than time lost to injury.
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
                          : "N/A"}
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
              a contract no team can sign today, not a judgment on the player,
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
          actual wins at r = 0.77.
        </p>
      </section>

      {/* ---------- honest limits ---------- */}
      <section className="mt-12 mb-4">
        <h2 className="text-xl font-semibold tracking-tight">
          What it can&rsquo;t do
        </h2>
        <ul className="mt-3 max-w-prose list-disc space-y-2 pl-5 text-sm text-white/70">
          <li>
            Because production is anchored to what each team actually did, a
            player can only be credited with a share of his own team&rsquo;s
            results. Someone excellent on a team that underachieves him will
            read low, and that is the model working as designed rather than a
            fault in it.
          </li>
          <li>
            Defense is still the weak half. A team&rsquo;s defensive total is
            known, but who inside the team earned it is not, and no free data
            settles it. The split leans on minutes, on the thin defensive
            columns a box score carries, and on tracking data that only exists
            from 2013-14.
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
