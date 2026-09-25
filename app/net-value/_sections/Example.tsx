import { Step, Working } from "@/components/Formula";
import { AVAILABILITY_FLOOR, type NetValueExample } from "@/lib/db/queries";
import { formatRank, formatScore, formatStat } from "@/lib/format";
import { DepthSection } from "./DepthSection";
import { PROSE } from "./Section";
import { dollars, nvp, workedExample, type Pricing } from "./numbers";

/**
 * One step per line of the full formula, in the same order and under the same
 * names, so the two can be read against each other.
 */
function Steps({
  hero,
  pricing,
  season,
}: {
  hero: NetValueExample;
  pricing: Pricing;
  season: string;
}) {
  const ex = workedExample(hero, pricing);
  const availability = hero.availability.toFixed(2);
  const charged = ex.chargedShare.toFixed(2);
  const fullMinutes = Math.round(hero.fullWorkload).toLocaleString();
  const produced = formatStat(pricing.produced);

  return (
    <>
      <p className={PROSE}>
        The best Net Value in the league that season, one line of the formula at
        a time.
      </p>

      <ol className="mt-6 space-y-6">
        <Step
          n={1}
          title="Value Produced: what he did"
          working={`${nvp(hero.production)} NVPs Value Produced`}
        >
          His share of the points his team&rsquo;s offense and defense generated
          above league average, counted up from replacement level.{" "}
          <a href="#production" className="underline">
            How it&rsquo;s built
          </a>{" "}
          is covered below.
        </Step>

        <Step
          n={2}
          title="League Production: what everyone did"
          working={`Σ Value Produced over ${pricing.players} players = ${produced} NVPs League Production`}
        >
          {`Adding up the Value Produced of all ${pricing.players} players paid in ${season} gives ${produced} NVPs, about ${formatStat(pricing.produced / 30)} per team.`}
        </Step>

        <Step
          n={3}
          title="Price per NVP: the going rate"
          working={`${dollars(pricing.pool)} League Payroll / ${produced} NVPs League Production = ${dollars(ex.pricePerNvp)} per NVP`}
        >
          {`League Payroll is every salary paid in ${season}. Between them, those salaries bought all of League Production, so dividing one by the other gives what a single NVP cost that season. Setting the price inside each season is what makes eras comparable: an NVP cost far more in 2026 than in 1994, and this absorbs that without any inflation adjustment.`}
        </Step>

        <Step
          n={4}
          title="Availability and Charged Share: how much of the contract counts"
          working={[
            `30 minutes × ${ex.gamesInSeason} Games in the Season = ${fullMinutes} Full-Season Minutes`,
            `${Math.round(hero.minutes).toLocaleString()} Minutes Played / ${fullMinutes} Full-Season Minutes = ${availability} Availability`,
            `${AVAILABILITY_FLOOR} + ${1 - AVAILABILITY_FLOOR} × ${availability} Availability = ${charged} Charged Share`,
          ]}
        >
          Missing games already lowers Value Produced, so charging his whole
          salary as well would punish an injury twice. Charging nothing for time
          missed goes too far the other way: a player who never took the floor
          would cost nothing at all. So half the contract is always charged, and
          the other half scales with how much of a full season he played.
          Playing more than a full season doesn&rsquo;t raise the charge; the
          extra minutes show up in Value Produced instead.
        </Step>

        <Step
          n={5}
          title="Base Bought: what his salary buys"
          working={[
            `${dollars(hero.salary)} Salary / ${dollars(ex.pricePerNvp)} per NVP = ${nvp(ex.fullSeasonClaim)} NVPs for a full season`,
            `${nvp(ex.fullSeasonClaim)} NVPs × ${charged} Charged Share = ${nvp(ex.baseBought)} NVPs Base Bought`,
          ]}
        >
          {`${hero.name} was the ${formatRank(hero.salaryRank)} highest-paid player in the league at ${dollars(hero.salary)}. At the going rate that buys ${nvp(ex.fullSeasonClaim)} NVPs over a full season, and his Charged Share brings it to ${nvp(ex.baseBought)}.`}
        </Step>

        <Step
          n={6}
          title="Season Adjustment: centering the league on zero"
          working={`${nvp(ex.baseBought)} NVPs Base Bought ${
            ex.seasonAdjustment >= 0 ? "+" : "−"
          } ${nvp(Math.abs(ex.seasonAdjustment))} NVPs Season Adjustment = ${nvp(hero.expectedProduction)} NVPs Value Bought`}
        >
          {`Charged Share never exceeds 1, so the league's Base Bought adds up to a little less than League Production, which would leave the average player looking slightly positive. The gap is split evenly: every player in ${season} gets the same ${nvp(Math.abs(ex.seasonAdjustment))} NVPs added. It changes nobody's rank, and it makes zero mean "paid the going rate".`}
        </Step>

        <Step
          n={7}
          title="Net Value: what he did minus what was paid for"
          working={`${nvp(hero.production)} NVPs Value Produced − ${nvp(hero.expectedProduction)} NVPs Value Bought = ${formatScore(hero.netValueScore)} Net Value`}
        >
          {`He produced ${nvp(hero.production)} NVPs, the same figure his player page shows, and his contract paid for ${nvp(hero.expectedProduction)} of them. That leaves ${nvp(hero.netValueScore)} NVPs nobody paid for: about ${ex.winsAboveCost} wins, and ${formatRank(hero.seasonRank)} in the league.`}
        </Step>
      </ol>
    </>
  );
}

/** The whole calculation in one line, with the two figures behind it. */
function Summary({
  hero,
  pricing,
  season,
}: {
  hero: NetValueExample;
  pricing: Pricing;
  season: string;
}) {
  const ex = workedExample(hero, pricing);
  return (
    <>
      <p className={PROSE}>
        {`The best Net Value in the league that season. One NVP cost ${dollars(ex.pricePerNvp)} in ${season}, so his ${dollars(hero.salary)} salary bought ${nvp(hero.expectedProduction)} NVPs. He produced ${nvp(hero.production)}.`}
      </p>
      <Working
        className="mt-3"
        lines={`${nvp(hero.production)} NVPs Value Produced − ${nvp(hero.expectedProduction)} NVPs Value Bought = ${formatScore(hero.netValueScore)} NVPs Net Value`}
      />
      <p className={PROSE}>
        {`That is about ${ex.winsAboveCost} wins his team got without paying for them.`}
      </p>
    </>
  );
}

export function ExampleSection(props: {
  hero: NetValueExample;
  pricing: Pricing;
  season: string;
}) {
  return (
    <DepthSection
      title={`Example: ${props.hero.name}, ${props.hero.season}`}
      simple={<Summary {...props} />}
      detailed={<Steps {...props} />}
    />
  );
}
