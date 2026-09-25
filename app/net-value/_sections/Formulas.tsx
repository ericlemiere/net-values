import type { ReactNode } from "react";
import { Def, Frac, Op, V } from "@/components/Formula";
import { AVAILABILITY_FLOOR } from "@/lib/db/queries";
import { DepthSection } from "./DepthSection";
import { PROSE } from "./Section";

function FormulaBox({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 w-fit max-w-full overflow-x-auto rounded-lg border-2 border-accent bg-background-box/80 px-4 py-4 font-mono sm:px-5 sm:py-5">
      <p className="text-sm text-accent sm:text-base">
        <V>Net Value</V>
        <Op>=</Op>
        <V>Value Produced</V>
        <Op>−</Op>
        <V>Value Bought</V>
      </p>
      {children}
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return (
    <p className="font-sans text-xs tracking-wide text-white/50 uppercase">
      {children}
    </p>
  );
}

const DEFS = "space-y-4 text-xs text-white/85 sm:text-sm";

/**
 * The headline, its two terms in plain words, and the three rules that shape
 * Value Bought, each of which the detailed version spells out as a line.
 */
function SimpleFormula() {
  return (
    <>
      <FormulaBox>
        <div className={`mt-4 border-t border-white/15 pt-4 ${DEFS}`}>
          <Def
            name="Value Produced"
            note="What he did: his share of the points his team scored and prevented above league average, counted up from what a freely available replacement player would give."
          />
          <Def
            name="Value Bought"
            note="What his salary should have bought: his pay divided by what an NVP cost that season, reduced a little if he missed time."
          />
        </div>
      </FormulaBox>
      <ul className={`${PROSE} list-disc space-y-2 pl-5`}>
        <li>
          The price of an NVP is set inside each season: everything the league
          paid, divided by everything it produced. That keeps a 1994 season
          comparable with a 2026 one without any inflation adjustment.
        </li>
        <li>
          Missing games already lowers what a player produces, so only half of
          his contract is reduced for time missed. An injured season still costs
          something, but isn&rsquo;t punished twice.
        </li>
        <li>
          Every season averages exactly zero, so a score always means
          &ldquo;better or worse than the going rate&rdquo; that year.
        </li>
      </ul>
    </>
  );
}

/**
 * The headline, then every term in it defined from the ground up, each one
 * only in terms of lines above it, then the whole thing written out. A term
 * that appears anywhere in the box has a line of its own; keep it that way
 * when adding to it.
 */
function FullFormula() {
  return (
    <FormulaBox>
      <div className={`mt-4 border-t border-white/15 pt-4 ${DEFS}`}>
        <Label>Where</Label>
        <Def
          name="Value Produced"
          note={
            <>
              The player&rsquo;s share of the points his team&rsquo;s offense
              and defense generated above league average that season, counted up
              from a replacement-level floor, in NVPs. A season below the floor
              counts as zero.{" "}
              <a href="#production" className="underline">
                How it&rsquo;s built
              </a>
              .
            </>
          }
        />
        <Def name="Salary" note="What the player was paid that season." />
        <Def
          name="Minutes Played"
          note="His total minutes on the floor that season."
        />
        <Def
          name="Games in the Season"
          note="Games on each team's schedule that season: 82 normally, fewer in lockout and shortened seasons."
        />
        <Def
          name="Number of Players"
          note="Every player paid a salary that season."
        />
        <Def
          name="League Production"
          note="Every player's Value Produced that season, added up."
        >
          Σ&nbsp;<V>Value Produced</V>
        </Def>
        <Def
          name="League Payroll"
          note="Every player's Salary that season, added up."
        >
          Σ&nbsp;<V>Salary</V>
        </Def>
        <Def
          name="Price per NVP"
          note="The going rate: what one NVP cost that season."
        >
          <Frac num={<V>League Payroll</V>} den={<V>League Production</V>} />
        </Def>
        <Def
          name="Full-Season Minutes"
          note="A starter playing 30 minutes a night in every game on that season's schedule."
        >
          30<Op>×</Op>
          <V>Games in the Season</V>
        </Def>
        <Def
          name="Availability"
          note="The share of a full season he was on the floor for, never more than 1."
        >
          <span className="inline-flex items-center">
            min(1,&nbsp;
            <Frac
              num={<V>Minutes Played</V>}
              den={<V>Full-Season Minutes</V>}
            />
            )
          </span>
        </Def>
        <Def
          name="Charged Share"
          note="Half of a contract is charged no matter what; the other half scales with Availability."
        >
          {AVAILABILITY_FLOOR}
          <Op>+</Op>
          {1 - AVAILABILITY_FLOOR}
          <Op>×</Op>
          <V>Availability</V>
        </Def>
        <Def
          name="Base Bought"
          note="The NVPs his salary buys at the going rate, for the part of the season he is charged for."
        >
          <Frac num="Salary" den={<V>Price per NVP</V>} />
          <Op>×</Op>
          <V>Charged Share</V>
        </Def>
        <Def
          name="Season Adjustment"
          note="Because Charged Share never exceeds 1, the Base Bought figures add up to a little less than League Production. This splits the gap evenly across every player that season, so the league averages exactly zero. Everyone gets the same amount, so it changes nobody's rank."
        >
          <Frac
            num={
              <>
                <V>League Production</V>
                <Op>−</Op>Σ&nbsp;<V>Base Bought</V>
              </>
            }
            den={<V>Number of Players</V>}
          />
        </Def>
        <Def
          name="Value Bought"
          note="What his contract paid for at that season's going rate."
        >
          <V>Base Bought</V>
          <Op>+</Op>
          <V>Season Adjustment</V>
        </Def>
      </div>

      <div className="mt-5 border-t border-white/15 pt-4">
        <Label>All together</Label>
        <p className="mt-3 flex flex-wrap items-center gap-y-2 text-xs text-accent sm:text-sm">
          <V>Net Value</V>
          <Op>=</Op>
          <V>Value Produced</V>
          <Op>−</Op>(
          <Frac num="Salary" den={<V>Price per NVP</V>} />
          <Op>×</Op>
          <V>Charged Share</V>
          <Op>+</Op>
          <V>Season Adjustment</V>)
        </p>
      </div>
    </FormulaBox>
  );
}

export function FormulaSection() {
  return (
    <DepthSection
      title="The formula"
      simple={<SimpleFormula />}
      detailed={<FullFormula />}
    />
  );
}
