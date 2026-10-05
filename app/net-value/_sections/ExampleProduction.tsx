import { Step } from "@/components/Formula";
import type { NetValueExample } from "@/lib/db/queries";
import type { ProductionBreakdown, ProductionStint } from "@/lib/db/schema";
import { DEFENSE_WEIGHTS, nvp, PRODUCTION as P } from "./numbers";

/** Fixed decimals, thousands separators and a real minus sign. */
function fmt(value: number, digits = 1) {
  return value
    .toLocaleString("en-US", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })
    .replace("-", "−");
}

/** Terms written as a sum, so a negative term reads "− 3.1" rather than "+ −3.1". */
function sum(terms: number[], digits = 1) {
  return terms
    .map((t, i) =>
      i === 0 ? fmt(t, digits) : `${t < 0 ? "−" : "+"} ${fmt(Math.abs(t), digits)}`,
    )
    .join(" ");
}

/** The stint the steps walk through: the one he played most minutes in. */
function mainStint(breakdown: ProductionBreakdown) {
  return breakdown.stints.reduce((a, b) => (b.box.mp > a.box.mp ? b : a));
}

function QualityTable({ stint }: { stint: ProductionStint }) {
  const labels = new Map(DEFENSE_WEIGHTS.map((w) => [w.key, w.label]));
  const rows = stint.quality.features.filter(
    (f) => f.value !== null && f.z !== null,
  );
  return (
    <div className="mt-2 w-fit max-w-full overflow-x-auto rounded-md border border-white/15 bg-background-box/90 px-3 py-2">
      <table className="text-xs text-white/85 sm:text-sm">
        <thead>
          <tr className="text-left text-white/50">
            <th className="pr-4 pb-1 font-normal">Stat</th>
            <th className="pr-4 pb-1 text-right font-normal">Per 100 Slots</th>
            <th className="pr-4 pb-1 text-right font-normal">z</th>
            <th className="pr-4 pb-1 text-right font-normal">Weight</th>
            <th className="pb-1 text-right font-normal">Weight × z</th>
          </tr>
        </thead>
        <tbody className="font-mono">
          {rows.map((f) => (
            <tr key={f.key}>
              <td className="pr-4 font-sans">{labels.get(f.key) ?? f.key}</td>
              <td className="pr-4 text-right">{fmt(f.value!, 1)}</td>
              <td className="pr-4 text-right">{fmt(f.z!, 2)}</td>
              <td className="pr-4 text-right">{fmt(f.weight, 2)}</td>
              <td className="text-right text-accent">
                {fmt(f.weight * f.z!, 2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Value Produced for the worked example's player, one step per stage of the
 * production formula box and under the same names. Returns nothing where the
 * season has no team anchor (a stat line naming no team), and the caller
 * falls back to quoting the figure.
 */
export function productionSteps({
  hero,
  breakdown,
  start,
}: {
  hero: NetValueExample;
  breakdown: ProductionBreakdown | null;
  start: number;
}) {
  if (!breakdown || breakdown.stints.length === 0) return null;
  const s = mainStint(breakdown);
  const a = s.anchor;
  if (!a) return null;

  const lg = breakdown.league;
  const traded = breakdown.stints.length > 1;
  const team = s.team ?? "his team";
  const where = traded ? ` with ${team}, the team he played most for` : "";
  const b = s.box;
  const o = s.off;
  const d = s.def;
  const q = s.quality;
  const offParts = [o.shooting, o.turnovers, o.assists, o.rebounds, o.creation];
  const defParts = [d.steals, d.blocks, d.rebounds, d.fouls];

  return [
    <Step
      key="floor"
      n={start}
      title="Floor time: how much of the game he was out there"
      working={[
        `${fmt(b.mp, 0)} MP / ${fmt(s.rosterMp ?? 0, 0)} Σ MP on the roster = ${fmt(s.floorShare, 4)} Floor Share`,
        `5 × ${fmt(s.floorShare, 4)} Floor Share = ${fmt(s.onFloor, 3)} On-Floor`,
        `${fmt(s.onFloor, 3)} On-Floor × ${fmt(a.teamPoss, 0)} Team Possessions = ${fmt(s.poss, 0)} Possessions`,
        `${fmt(s.poss, 0)} Possessions / 5 = ${fmt(s.slots, 1)} Slots`,
      ]}
    >
      {`${hero.name} played ${fmt(b.mp, 0)} of the ${fmt(s.rosterMp ?? 0, 0)} minutes ${team}'s players logged${traded ? " while he was there" : ""}, so he was on the floor for ${fmt(s.onFloor * 100, 0)}% of its game time.${traded ? ` He was traded mid-season; these steps follow his time${where}, and the last one adds up every stint.` : ""}`}
    </Step>,

    <Step
      key="offense"
      n={start + 1}
      title="Box Offense: what the box score says he added"
      working={[
        `${fmt(b.fga, 0)} FGA + 0.44 × ${fmt(b.fta, 0)} FTA = ${fmt(o.tsa, 0)} TSA`,
        `${fmt(b.pts, 0)} PTS / (2 × ${fmt(o.tsa, 0)} TSA) = ${fmt(o.ts, 4)} TS%`,
        `${fmt(o.ts, 5)} TS% − ${fmt(lg.ts, 5)} League TS% = ${fmt(o.ts - lg.ts, 5)} above average`,
        `2 × ${fmt(o.tsa, 0)} TSA × ${fmt(o.ts - lg.ts, 5)} × (1 − ${P.assistedCreditShare} × ${fmt(o.assisted, 3)} Assisted Share) = ${fmt(o.shooting)} Shooting`,
        `${fmt(o.tsa, 0)} TSA + ${fmt(b.tov, 0)} TOV = ${fmt(o.used, 0)} Used`,
        `−${fmt(lg.ppp, 3)} League PPP × (${fmt(b.tov, 0)} TOV − ${fmt(lg.tov_rate, 4)} League TOV Rate × ${fmt(o.used, 0)} Used) = ${fmt(o.turnovers)} Turnovers`,
        `${P.perAssist} × ${fmt(b.ast, 0)} AST = ${fmt(o.assists)} Assists`,
        `${P.perOffRebound} × (${fmt(b.orb, 0)} ORB − ${fmt(lg.orb_rate, 4)} League ORB Rate × ${fmt(s.slots, 1)} Slots) = ${fmt(o.rebounds)} Offensive Rebounds`,
        `${P.perPossessionUsed} × (${fmt(o.used, 0)} Used − ${fmt(lg.used_rate, 4)} League Used Rate × ${fmt(s.slots, 1)} Slots) = ${fmt(o.creation)} Creation`,
        `${sum(offParts)} − ${fmt(s.offRate, 4)} Position Rate × ${fmt(s.slots, 1)} Slots = ${fmt(s.boxOff)} Box Offense`,
      ]}
    >
      {`Shooting, turnovers, assists, offensive rebounds, and shot creation, each against what an average player does with the same floor time.${o.assistedLeague ? " His own assisted share isn't on record for this season, so the league's stands in." : ""} The last line measures him against other ${positionName(s.posGroup)}: the average at his position is worth ${fmt(s.offRate * s.slots)} points over his Slots.`}
    </Step>,

    <Step
      key="defense"
      n={start + 2}
      title="Box Defense: the part of his defense a box score sees"
      working={[
        `${P.perSteal} × (${fmt(b.stl, 0)} STL − ${fmt(lg.stl_rate, 4)} × ${fmt(s.slots, 1)} Slots) = ${fmt(d.steals)}`,
        `${P.perBlock} × (${fmt(b.blk, 0)} BLK − ${fmt(lg.blk_rate, 4)} × ${fmt(s.slots, 1)} Slots) = ${fmt(d.blocks)}`,
        `${P.drbPositionWeight} × ${fmt(s.drbPositionRate, 4)} Position DRB Rate + ${1 - P.drbPositionWeight} × ${fmt(lg.drb_rate, 4)} League DRB Rate = ${fmt(s.drbBaseline, 4)} DRB Baseline`,
        `${P.perDefRebound} × (${fmt(b.drb, 0)} DRB − ${fmt(s.drbBaseline, 4)} DRB Baseline × ${fmt(s.slots, 1)} Slots) = ${fmt(d.rebounds)}`,
        `−${Math.abs(P.perFoul)} × (${fmt(b.pf, 0)} PF − ${fmt(lg.pf_rate, 4)} × ${fmt(s.slots, 1)} Slots) = ${fmt(d.fouls)}`,
        `${sum(defParts)} = ${fmt(s.boxDef)} Box Defense`,
      ]}
    >
      {`Steals, blocks, and fouls, each against the league rate over his Slots. Defensive rebounds are measured against a baseline that leans toward other ${positionName(s.posGroup)}, since much of any player's rebounding comes from where his position puts him.`}
    </Step>,

    <Step
      key="quality"
      n={start + 3}
      title="Defensive Quality: how good a defender he was"
      working={[
        `Σ weight × z = ${fmt(q.score, 2)} Quality Score`,
        `(${fmt(q.score, 2)} Quality Score − ${fmt(q.mean, 3)}) / ${fmt(q.sd, 3)} = ${fmt(q.quality, 2)} Defensive Quality`,
        `${fmt(s.poss, 0)} Possessions × e^(${P.gamma} × ${fmt(q.quality, 2)}) = ${fmt(s.defWeight ?? 0, 0)} Defensive Weight`,
      ]}
      before={<QualityTable stint={s} />}
    >
      {`Each stat per 100 Slots, how far it sits from the season's average player, and what the fitted weight makes of it.${q.tracked ? " This season has tracking data, so the tracking weights apply." : " This season has no tracking data, so the box-score weights apply."} A Defensive Quality of ${fmt(q.quality, 2)} gives him ${fmt(Math.exp(P.gamma * q.quality), 2)}× the defensive share his minutes alone would earn.`}
    </Step>,

    <Step
      key="anchor"
      n={start + 4}
      title="Offense and Defense Points: his share of what the team did"
      working={[
        `(${fmt(a.ortg, 2)} Team ORtg − ${fmt(a.leagueOrtg, 2)} League ORtg) × ${fmt(a.teamPoss, 0)} / 100 = ${fmt(a.teamOff)} Team Offense`,
        `(${fmt(a.leagueDrtg, 2)} League DRtg − ${fmt(a.drtg, 2)} Team DRtg) × ${fmt(a.teamPoss, 0)} / 100 = ${fmt(a.teamDef)} Team Defense`,
        `${fmt(s.boxOff)} Box Offense + (${fmt(a.teamOff)} − ${fmt(a.sumBoxOff)} Σ Box Offense) × ${fmt(s.poss, 0)} / ${fmt(a.sumPoss, 0)} Σ Possessions = ${fmt(s.offPoints)} Offense Points`,
        `${fmt(s.boxDef)} Box Defense + (${fmt(a.teamDef)} − ${fmt(a.sumBoxDef)} Σ Box Defense) × ${fmt(s.defWeight ?? 0, 0)} / ${fmt(a.sumDefWeight, 0)} Σ Defensive Weight = ${fmt(s.defPoints)} Defense Points`,
      ]}
    >
      {`${team} scored ${fmt(Math.abs(a.teamOff), 0)} points ${a.teamOff >= 0 ? "more" : "fewer"} than an average team would have over its possessions and allowed ${fmt(Math.abs(a.teamDef), 0)} ${a.teamDef >= 0 ? "fewer" : "more"}. Its players' box scores account for ${fmt(a.sumBoxOff, 0)} and ${fmt(a.sumBoxDef, 0)} of those, and the rest is shared out: offense by possessions played, defense by Defensive Weight.`}
    </Step>,

    <Step
      key="value"
      n={start + 5}
      title="Value Produced: what he did, in NVPs"
      working={[
        `100 × (${fmt(s.offPoints)} Offense Points + ${fmt(s.defPoints)} Defense Points) / ${fmt(s.poss, 0)} Possessions = ${fmt(s.impact, 2)} Impact`,
        `(${fmt(s.impact, 2)} Impact + ${fmt(Math.abs(P.replacement))}) × ${fmt(s.onFloor, 3)} On-Floor × ${s.games} / 82 = ${nvp(s.value)} NVPs Stint Value`,
        ...(traded
          ? [
              `${breakdown.stints.map((x) => `${nvp(x.value)} (${x.team})`).join(" + ")} = ${nvp(breakdown.stints.reduce((t, x) => t + x.value, 0))} NVPs`,
            ]
          : []),
        `max(0, ${nvp(breakdown.stints.reduce((t, x) => t + x.value, 0))}) = ${nvp(hero.production)} NVPs Value Produced`,
      ]}
    >
      {`He was ${fmt(s.impact, 1)} points per 100 possessions better than an average player, and ${fmt(s.impact - P.replacement, 1)} better than a replacement one. Scaled by his floor time, that is the figure his player page shows.`}
    </Step>,
  ];
}

const POSITION_NAMES: Record<string, string> = {
  PG: "point guards",
  SG: "shooting guards",
  SF: "small forwards",
  PF: "power forwards",
  C: "centers",
};

function positionName(group: string) {
  return POSITION_NAMES[group] ?? "players at his position";
}
