import { getAwardsForRows, getNetValueExamples } from "@/lib/db/queries";
import { PAGE_COLUMN_PROSE } from "@/lib/layout";
import { pageMetadata } from "@/lib/site";
import { ExampleSection } from "./_sections/Example";
import { ExampleTables } from "./_sections/ExampleTables";
import { FormulaSection } from "./_sections/Formulas";
import { JordanNote } from "./_sections/JordanNote";
import { Limits } from "./_sections/Limits";
import { ProductionSection } from "./_sections/ProductionSource";
import { ReadingTheScale } from "./_sections/ReadingTheScale";
import { TeamNetValue } from "./_sections/TeamNetValue";
import { WhySubtract } from "./_sections/WhySubtract";

export const metadata = pageMetadata({
  title: "How Net Value Works",
  description:
    "How Net Value is calculated: the formula comparing an NBA player's on-court production with what his salary bought, with a step-by-step worked example.",
  path: "/net-value",
});

/**
 * The explainer. The sections that carry arithmetic (the formula, the example
 * and where production comes from) each have their own Simple/Detailed
 * toggle; the rest read at one depth. Each section lives in `_sections/`, so
 * this file is only the order they come in.
 */
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
  const hero = latestTop[0];

  return (
    <div className={PAGE_COLUMN_PROSE}>
      <h1 className="text-3xl font-semibold tracking-tight">Net Value</h1>
      <p className="mt-3 max-w-prose text-white/70">
        Net Value asks whether a player was worth his contract. It compares what
        he produced on the court with what his salary should have bought at that
        season&rsquo;s going rate. Zero means he was paid about right. Positive
        means his team got more than it paid for, and negative means it got
        less.
      </p>
      <p className="mt-3 max-w-prose text-white/70">
        Both sides are counted in{" "}
        <strong className="text-accent">Net Value Points (NVPs)</strong>. One
        NVP is worth about{" "}
        <strong className="text-accent">two and a half wins</strong> to a team,
        so a Net Value of +5 NVPs means a player returned roughly twelve more
        wins than his contract paid for. An NVP is a unit of value, not a point
        scored: a rim protector earns them as readily as a scorer.
      </p>

      <FormulaSection />
      {hero && pricing && (
        <ExampleSection hero={hero} pricing={pricing} season={season} />
      )}
      <ProductionSection pricing={pricing} />
      <WhySubtract />
      <ReadingTheScale />
      <Limits />
      <ExampleTables
        season={season}
        best={best}
        worst={worst}
        overCap={overCap}
        latestTop={latestTop}
        latestBottom={latestBottom}
        awards={awards}
      />
      <JordanNote overCap={overCap} />
    </div>
  );
}
