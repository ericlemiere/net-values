import type { ReactNode } from "react";
import { Def, Frac, Op, V } from "@/components/Formula";
import { DEFENSE_WEIGHTS, PRODUCTION as P } from "./numbers";

function Label({ children }: { children: ReactNode }) {
  return (
    <p className="font-sans text-xs tracking-wide text-white/50 uppercase">
      {children}
    </p>
  );
}

/** A labeled group of definitions, ruled off from the one above it. */
function Stage({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-5 space-y-4 border-t border-white/15 pt-4">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

/** A per-event credit: weight × (count − league rate × Slots). */
function Credit({ weight, stat }: { weight: number; stat: string }) {
  return (
    <>
      {weight}
      <Op>×</Op>(<V>{stat}</V>
      <Op>−</Op>
      <V>League {stat} Rate</V>
      <Op>×</Op>
      <V>Slots</V>)
    </>
  );
}

/** The quality weights, box-score set beside tracking set. */
function WeightTable() {
  return (
    <table className="mt-1 font-sans text-xs text-white/85 sm:text-sm">
      <thead>
        <tr className="text-left text-white/50">
          <th className="pr-6 pb-1 font-normal">Stat, per 100 Slots</th>
          <th className="pr-6 pb-1 text-right font-normal">Box score</th>
          <th className="pb-1 text-right font-normal">With tracking</th>
        </tr>
      </thead>
      <tbody className="font-mono">
        {DEFENSE_WEIGHTS.map((w) => (
          <tr key={w.key}>
            <td className="pr-6 font-sans">{w.label}</td>
            <td className="pr-6 text-right">
              {w.box === null ? "—" : w.box.toFixed(2)}
            </td>
            <td className="text-right">{w.tracking.toFixed(2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Value Produced from the box score up, one stage per step of
 * compute_production.py and every term defined only from lines above it. The
 * worked example walks the same stages under the same names.
 */
export function ProductionFormula() {
  return (
    <div className="mt-4 w-fit max-w-full overflow-x-auto rounded-lg border-2 border-accent bg-background-box/80 px-4 py-4 font-mono sm:px-5 sm:py-5">
      <p className="text-sm text-accent sm:text-base">
        <V>Value Produced</V>
        <Op>=</Op>
        <V>max(0,</V>&nbsp;Σ&nbsp;<V>Stint Value)</V>
      </p>
      <div className="space-y-4 text-xs text-white/85 sm:text-sm">
        <Stage label="Inputs">
          <Def
            name="Box score"
            note="His season totals: MP minutes, PTS points, FGA shots, FTA free throws, AST assists, TOV turnovers, ORB and DRB offensive and defensive rebounds, STL steals, BLK blocks, PF fouls. A player traded mid-season is worked separately for each team, and each of those parts is a stint."
          />
          <Def
            name="Assisted Share"
            note="The share of his made shots a teammate assisted, from nba.com. Before 1996-97, the league average stands in."
          />
          <Def
            name="Position"
            note="His listed position: PG, SG, SF, PF or C. Used to set the offensive baseline and most of the defensive-rebound one."
          />
          <Def
            name="Team Possessions, Team Games"
            note="How many possessions his team played that season, and how many games, never counted above 82."
          />
          <Def
            name="Team ORtg, Team DRtg"
            note="Points his team scored and allowed per 100 possessions, from its game logs."
          />
          <Def
            name="League ORtg, League DRtg"
            note="The same two figures for the league as a whole, each team weighted by its possessions."
          />
          <Def
            name="Tracking stats"
            note="From 2013-14: shots he defended, what those shooters made against him and against everyone else, deflections, contests, loose balls and charges drawn."
          />
        </Stage>

        <Stage label="Floor time">
          <Def
            name="Floor Share"
            note="His part of all the minutes his team's players logged."
          >
            <Frac num={<V>MP</V>} den={<V>Σ MP on the roster</V>} />
          </Def>
          <Def
            name="On-Floor"
            note="The share of his team's game time he was out there. Five players are on the floor at once."
          >
            5<Op>×</Op>
            <V>Floor Share</V>
          </Def>
          <Def
            name="Possessions"
            note="Possessions played while he was on the floor."
          >
            <V>On-Floor</V>
            <Op>×</Op>
            <V>Team Possessions</V>
          </Def>
          <Def
            name="Slots"
            note="His fifth of those possessions: the most any one of the five can be responsible for. Every per-player rate is measured against it."
          >
            <Frac num={<V>Possessions</V>} den="5" />
          </Def>
        </Stage>

        <Stage label="League rates, per season">
          <Def
            name="League TS%"
            note="League-wide true shooting: points per shooting attempt, halved."
          >
            <Frac num={<V>Σ PTS</V>} den={<>2<Op>×</Op><V>Σ TSA</V></>} />
          </Def>
          <Def
            name="League PPP"
            note="What an average possession is worth in points. A turnover gives one away."
          >
            <Frac num={<V>Σ PTS</V>} den={<V>Σ Slots</V>} />
          </Def>
          <Def
            name="League TOV Rate"
            note="Turnovers per possession used."
          >
            <Frac num={<V>Σ TOV</V>} den={<V>Σ Used</V>} />
          </Def>
          <Def
            name="League [stat] Rate"
            note="For Used, ORB, DRB, STL, BLK and PF: the league total of that stat divided by the league's total Slots."
          >
            <Frac num={<V>Σ stat</V>} den={<V>Σ Slots</V>} />
          </Def>
        </Stage>

        <Stage label="Offense from the box score">
          <Def
            name="TSA"
            note="Shooting attempts, counting a trip to the line as 0.44 of a shot."
          >
            <V>FGA</V>
            <Op>+</Op>0.44<Op>×</Op>
            <V>FTA</V>
          </Def>
          <Def name="TS%" note="His true shooting.">
            <Frac num={<V>PTS</V>} den={<>2<Op>×</Op><V>TSA</V></>} />
          </Def>
          <Def
            name="Shooting"
            note={`Points above what an average shooter scores on the same attempts. ${P.assistedCreditShare * 100}% of the credit for an assisted basket goes to the passer instead.`}
          >
            2<Op>×</Op>
            <V>TSA</V>
            <Op>×</Op>(<V>TS%</V>
            <Op>−</Op>
            <V>League TS%</V>)<Op>×</Op>(1<Op>−</Op>
            {P.assistedCreditShare}
            <Op>×</Op>
            <V>Assisted Share</V>)
          </Def>
          <Def name="Used" note="Possessions he ended with a shot or a turnover.">
            <V>TSA</V>
            <Op>+</Op>
            <V>TOV</V>
          </Def>
          <Def
            name="Turnovers"
            note="Charged against the turnovers an average player commits on the same workload, not against zero."
          >
            −<V>League PPP</V>
            <Op>×</Op>(<V>TOV</V>
            <Op>−</Op>
            <V>League TOV Rate</V>
            <Op>×</Op>
            <V>Used</V>)
          </Def>
          <Def name="Assists" note="Points of credit per assist.">
            {P.perAssist}
            <Op>×</Op>
            <V>AST</V>
          </Def>
          <Def
            name="Offensive Rebounds"
            note="A fresh possession, net of the teammate who would have collected some of them anyway."
          >
            <Credit weight={P.perOffRebound} stat="ORB" />
          </Def>
          <Def
            name="Creation"
            note="Taking a shot on is worth something even at ordinary efficiency, because the alternative is a teammate doing it worse."
          >
            <Credit weight={P.perPossessionUsed} stat="Used" />
          </Def>
          <Def
            name="Position Rate"
            note="The average of the five credits above per Slot, across everyone at his position that season."
          >
            <Frac
              num={<>Σ&nbsp;<V>(Shooting + … + Creation)</V></>}
              den={<V>Σ Slots at his position</V>}
            />
          </Def>
          <Def
            name="Box Offense"
            note="His offense measured against others at his position, so a center isn't paid for rebounds his job puts in front of him."
          >
            <V>Shooting</V>
            <Op>+</Op>
            <V>Turnovers</V>
            <Op>+</Op>
            <V>Assists</V>
            <Op>+</Op>
            <V>Offensive Rebounds</V>
            <Op>+</Op>
            <V>Creation</V>
            <Op>−</Op>
            <V>Position Rate</V>
            <Op>×</Op>
            <V>Slots</V>
          </Def>
        </Stage>

        <Stage label="Defense from the box score">
          <Def
            name="Position DRB Rate"
            note="Defensive rebounds per Slot across everyone at his position that season."
          >
            <Frac
              num={<V>Σ DRB at his position</V>}
              den={<V>Σ Slots at his position</V>}
            />
          </Def>
          <Def
            name="DRB Baseline"
            note="The defensive rebounds he is expected to collect per Slot. It leans mostly on his position, because a center gathers many of his just by standing under the rim, but not entirely: boxing out is a real skill, so part of the gap is still his."
          >
            {P.drbPositionWeight}
            <Op>×</Op>
            <V>Position DRB Rate</V>
            <Op>+</Op>
            {1 - P.drbPositionWeight}
            <Op>×</Op>
            <V>League DRB Rate</V>
          </Def>
          <Def
            name="Box Defense"
            note="The part of defense a box score can see, each stat against what an average player records in the same floor time. Steals, blocks and fouls are measured against the whole league, not his position: rim protection is scarcer and worth more. Defensive rebounds are measured against the DRB Baseline."
          >
            <span className="inline-flex flex-col gap-1">
              <span>
                <Credit weight={P.perSteal} stat="STL" />
              </span>
              <span>
                <Op>+</Op>
                <Credit weight={P.perBlock} stat="BLK" />
              </span>
              <span>
                <Op>+</Op>
                {P.perDefRebound}
                <Op>×</Op>(<V>DRB</V>
                <Op>−</Op>
                <V>DRB Baseline</V>
                <Op>×</Op>
                <V>Slots</V>)
              </span>
              <span>
                <Op>−</Op>
                <Credit weight={Math.abs(P.perFoul)} stat="PF" />
              </span>
            </span>
          </Def>
        </Stage>

        <Stage label="Defensive quality">
          <Def
            name="Fewer Makes Allowed"
            note="From 2013-14: how many fewer shots the players he guarded made than they make against everyone else."
          >
            (<V>Their normal FG%</V>
            <Op>−</Op>
            <V>FG% against him</V>)<Op>×</Op>
            <V>Shots defended</V>
          </Def>
          <Def
            name="z"
            note="Each stat in the table below, per 100 Slots, as standard deviations above or below that season's average player."
          />
          <Def
            name="Quality Score"
            note="Each z times its weight, added up. The weights were fitted to 36 seasons of All-Defensive and Defensive Player of the Year voting; seasons with tracking data use the right-hand set."
          >
            Σ&nbsp;<V>weight</V>
            <Op>×</Op>
            <V>z</V>
          </Def>
          <WeightTable />
          <Def
            name="Defensive Quality"
            note="Quality Score re-scaled to standard deviations within the season."
          >
            <Frac
              num={
                <>
                  <V>Quality Score</V>
                  <Op>−</Op>
                  <V>season average</V>
                </>
              }
              den={<V>season standard deviation</V>}
            />
          </Def>
          <Def
            name="Defensive Weight"
            note={`How much of the team's defense he gets a share of. One standard deviation above average is worth about ${Math.exp(P.gamma).toFixed(1)}× his minutes' share; one below, about ${Math.exp(-P.gamma).toFixed(1)}×.`}
          >
            <V>Possessions</V>
            <Op>×</Op>
            <V>
              e<sup>{P.gamma} × Defensive Quality</sup>
            </V>
          </Def>
        </Stage>

        <Stage label="Anchoring to the team">
          <Def
            name="Team Offense"
            note="Points his team scored above league average over the season."
          >
            (<V>Team ORtg</V>
            <Op>−</Op>
            <V>League ORtg</V>)<Op>×</Op>
            <Frac num={<V>Team Possessions</V>} den="100" />
          </Def>
          <Def
            name="Team Defense"
            note="Points his team kept off the board compared with league average."
          >
            (<V>League DRtg</V>
            <Op>−</Op>
            <V>Team DRtg</V>)<Op>×</Op>
            <Frac num={<V>Team Possessions</V>} den="100" />
          </Def>
          <Def
            name="Offense Points"
            note="His Box Offense, plus a share of whatever the roster's box scores don't account for, split by possessions played. The roster's Offense Points always add up to exactly Team Offense."
          >
            <V>Box Offense</V>
            <Op>+</Op>(<V>Team Offense</V>
            <Op>−</Op>Σ&nbsp;<V>Box Offense</V>)<Op>×</Op>
            <Frac num={<V>Possessions</V>} den={<>Σ&nbsp;<V>Possessions</V></>} />
          </Def>
          <Def
            name="Defense Points"
            note="The same for defense, but split by Defensive Weight. Box scores miss most of defense, so this share is usually most of it."
          >
            <V>Box Defense</V>
            <Op>+</Op>(<V>Team Defense</V>
            <Op>−</Op>Σ&nbsp;<V>Box Defense</V>)<Op>×</Op>
            <Frac
              num={<V>Defensive Weight</V>}
              den={<>Σ&nbsp;<V>Defensive Weight</V></>}
            />
          </Def>
        </Stage>

        <Stage label="Scale to NVPs">
          <Def
            name="Impact"
            note="His points above league average per 100 possessions he played."
          >
            100<Op>×</Op>
            <Frac
              num={
                <>
                  <V>Offense Points</V>
                  <Op>+</Op>
                  <V>Defense Points</V>
                </>
              }
              den={<V>Possessions</V>}
            />
          </Def>
          <Def
            name="Stint Value"
            note={`Impact counted up from replacement level, ${Math.abs(P.replacement)} points per 100 below average, then scaled by how much of the team's time he played and by the season's length.`}
          >
            (<V>Impact</V>
            <Op>+</Op>
            {Math.abs(P.replacement)})<Op>×</Op>
            <V>On-Floor</V>
            <Op>×</Op>
            <Frac num={<V>Team Games</V>} den="82" />
          </Def>
          <Def
            name="Value Produced"
            note="His stints added up (one, unless he was traded). A season below replacement counts as zero."
          >
            max(0,&nbsp;Σ&nbsp;<V>Stint Value</V>)
          </Def>
        </Stage>
      </div>
    </div>
  );
}
