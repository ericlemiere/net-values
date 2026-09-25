import { Def, Op, V, Working } from "@/components/Formula";
import { formatStat } from "@/lib/format";
import { DepthSection } from "./DepthSection";
import { PROSE } from "./Section";
import { WIN_FIT, type Pricing } from "./numbers";

/** The method in a paragraph. */
function Simple() {
  return (
    <p className={PROSE}>
      Value Produced starts from what each team actually did: the points it
      scored and allowed compared with league average, taken from its game logs.
      That total is split between the team&rsquo;s players, offense by box-score
      credit and defense by minutes and defensive quality. Checked against real
      results, every NVP a team produces is worth about {WIN_FIT.winsPerNvp}{" "}
      wins, and team totals track actual wins very closely.
    </p>
  );
}

/** How Value Produced is built, and the fit that says what an NVP is worth. */
function Detailed({ pricing }: { pricing: Pricing | null }) {
  const leagueTotal = pricing ? formatStat(pricing.produced) : "300";
  return (
    <>
      <p className={PROSE}>
        It is built here from nba.com&rsquo;s own data, and it works the
        opposite way round from a box-score metric. A box-score metric estimates
        each player from his own stats and hopes they add up to the team. This
        starts from what each team actually did, its offensive and defensive
        points above league average taken from the possessions and points in its
        game logs, and divides that between its players. The team total is
        always right; the model&rsquo;s whole job is the split.
      </p>
      <p className={PROSE}>
        It is counted up from replacement level rather than from zero. A
        replacement player is one any team can sign for the minimum at any time:
        a veteran on a minimum deal, a two-way contract, a G League call-up.
        That level sits two points per 100 possessions below an average player,
        so a whole roster of them still wins about 16 games. Only what a player
        adds above that floor counts, and a season below it counts as zero.
      </p>
      <Working
        className="mt-3"
        lines="5 replacement players × −2 points per 100 possessions = −10 points per 100 possessions ≈ 16 wins"
      />
      <p className={PROSE}>
        Offense is split by box-score credit, which the box score is good at:
        shooting efficiency above league average on the player&rsquo;s own
        volume, weighted down by how much of it teammates created for him, plus
        playmaking, turnovers, offensive rebounds and the plain value of taking
        a shot on. Defense is split by minutes, tilted by a defensive-quality
        model fitted to thirty-six seasons of All-Defensive voting, and from
        2013-14 on, by tracking data on shots defended and how badly the
        shooters did.
      </p>
      <p className={PROSE}>
        {`Value Produced isn't measured in wins, which is why League Production lands on a figure like ${leagueTotal} NVPs rather than the 1,230 games in a season. To find what an NVP is worth, every team's total was fitted against the games it actually won, across ${WIN_FIT.teamSeasons} full 82-game team-seasons:`}
      </p>
      {/* Every number in the fit gets its own line, the same way the formula
          box at the top defines its terms. */}
      <div className="mt-3 w-fit max-w-full overflow-x-auto rounded-md border border-white/15 bg-background-box/90 px-4 py-3 font-mono text-xs sm:text-sm">
        <p className="flex flex-wrap items-center gap-y-2 text-accent">
          <V>Team Wins</V>
          <Op>=</Op>
          <V>{WIN_FIT.intercept} wins</V>
          <Op>+</Op>
          <V>{WIN_FIT.winsPerNvp} wins per NVP</V>
          <Op>×</Op>
          <V>Team Production</V>
        </p>
        <div className="mt-3 space-y-3 border-t border-white/15 pt-3 text-white/85">
          <Def
            name="Team Production"
            note="Every Value Produced by the team's players that season, added up, in NVPs."
          />
          <Def
            name={`${WIN_FIT.intercept} wins`}
            note="What a team producing zero NVPs, a roster of replacement players, is predicted to win."
          />
          <Def
            name={`${WIN_FIT.winsPerNvp} wins per NVP`}
            note="How many extra wins each NVP a team produces is worth."
          />
          <Def
            name={`r = ${WIN_FIT.r}`}
            note={`How closely predicted wins track actual wins across the ${WIN_FIT.teamSeasons} team-seasons. 1 would be a perfect match and 0 no relationship at all.`}
          />
        </div>
      </div>
      <p className={PROSE}>
        So one NVP is worth about two and a half wins, and a roster producing
        nothing lands on the 16 wins a roster of replacement players is worth.
        The fit is also the best reason to trust the number: something that
        tracks real results this closely is measuring something real, whatever
        its flaws.
      </p>
    </>
  );
}

export function ProductionSection({ pricing }: { pricing: Pricing | null }) {
  return (
    <DepthSection
      id="production"
      title="Where Value Produced comes from"
      simple={<Simple />}
      detailed={<Detailed pricing={pricing} />}
    />
  );
}
