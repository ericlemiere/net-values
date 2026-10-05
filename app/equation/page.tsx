import type { Metadata } from "next";
import { getNetValueExamples } from "@/lib/db/queries";
import { hasEquationAccess } from "@/lib/equation-access";
import { PAGE_COLUMN_PROSE } from "@/lib/layout";
import { ExampleSteps } from "../net-value/_sections/Example";
import { FullFormula } from "../net-value/_sections/Formulas";
import { ProductionFormula } from "../net-value/_sections/ProductionFormula";
import { WinFitBox } from "../net-value/_sections/ProductionSource";
import { PROSE, Section } from "../net-value/_sections/Section";
import { PasswordForm } from "./PasswordForm";

/**
 * Kept out of search and AI answers: no canonical, no social card, no sitemap
 * entry, and noindex here as well as in the X-Robots-Tag header next.config
 * sends. robots.ts turns the AI crawlers away from it outright.
 */
export const metadata: Metadata = {
  title: "Private",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

const CONTENTS = [
  { id: "production", label: "Value Produced, from the box score up" },
  { id: "wins", label: "What an NVP is worth in wins" },
  { id: "net-value", label: "From Value Produced to Net Value" },
  { id: "example", label: "A real season, worked line by line" },
];

/**
 * Every equation behind Net Value, defined bottom-up and numbered, then one
 * real season run through all of them. The explainer at /net-value is the
 * readable version; this is the reference.
 */
export default async function EquationPage() {
  // Checked on the server before anything else: without the unlock cookie the
  // response holds the form and nothing more, so no equation reaches the
  // browser, not even hidden.
  if (!(await hasEquationAccess())) {
    return (
      <div className={PAGE_COLUMN_PROSE}>
        <h1 className="text-3xl font-semibold tracking-tight">Private page</h1>
        <p className="mt-3 max-w-prose text-white/70">
          Enter the password to continue.
        </p>
        <PasswordForm />
      </div>
    );
  }

  const { season, latestTop, pricing, heroBreakdown } =
    await getNetValueExamples();
  const hero = latestTop[0];

  return (
    <div className={`${PAGE_COLUMN_PROSE} eq-numbered`}>
      <h1 className="text-3xl font-semibold tracking-tight">The Equations</h1>
      <p className="mt-3 max-w-prose text-white/70">
        Every equation behind Net Value, written out in full. Each term is
        defined only from lines above it, so the page reads top to bottom: the
        box score first, then the team totals it is anchored to, then the price
        of an NVP and what a contract buys. Equations are numbered down the
        right-hand side. The last section runs one real season through every one
        of them.
      </p>
      <p className="mt-3 max-w-prose text-white/70">
        For the plain-language version, see{" "}
        <a href="/net-value" className="underline">
          how Net Value works
        </a>
        .
      </p>

      <nav aria-label="Contents" className="mt-6">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-white/70">
          {CONTENTS.map((c) => (
            <li key={c.id}>
              <a href={`#${c.id}`} className="underline">
                {c.label}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <Section id="production" title="1. Value Produced, from the box score up">
        <p className={PROSE}>
          Value Produced starts from what each team actually did, its points
          scored and allowed above league average, and divides that between its
          players. The box score sets each player&rsquo;s starting share; the
          team total settles what is left over. A player traded mid-season is
          worked separately for each team and the parts are added at the end.
        </p>
        <ProductionFormula />
      </Section>

      <Section id="wins" title="2. What an NVP is worth in wins">
        <p className={PROSE}>
          Every team-season&rsquo;s total production fitted against the games it
          actually won. This is the check on the whole model, and where
          &ldquo;one NVP is about two and a half wins&rdquo; comes from.
        </p>
        <WinFitBox />
      </Section>

      <Section id="net-value" title="3. From Value Produced to Net Value">
        <p className={PROSE}>
          What a contract should have bought at that season&rsquo;s going rate,
          and the gap between that and what the player produced.
        </p>
        <FullFormula />
      </Section>

      {hero && pricing && (
        <Section
          id="example"
          title={`4. A real season: ${hero.name}, ${hero.season}`}
        >
          <ExampleSteps
            hero={hero}
            pricing={pricing}
            season={season}
            breakdown={heroBreakdown}
          />
        </Section>
      )}
    </div>
  );
}
