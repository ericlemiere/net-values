import { Section, PROSE } from "./Section";
import { WIN_FIT } from "./numbers";

/** What Net Value can't tell you. */
export function Limits() {
  return (
    <Section title="Limitations">
      <ul className={`${PROSE} list-disc space-y-2 pl-5`}>
        <li>
          Value Produced is a share of what the player&rsquo;s own team did, so
          someone excellent on a team that underachieves around him will read
          low. That is the model working as designed, not a fault in it.
        </li>
        <li>
          There is a margin of error. At the team level, where it can be
          checked, a roster&rsquo;s total production misses its actual win
          total by about {WIN_FIT.typicalMiss} wins in a typical season, and by
          more than 6 in about {WIN_FIT.bigMissShare}. Almost none of that is
          the model: production matches a team&rsquo;s point margin almost
          exactly, and point margin itself misses wins by the same amount,
          because close games don&rsquo;t fall evenly. That luck doesn&rsquo;t
          carry from one season to the next, so no player is credited with it.
          The team check can&rsquo;t test how the total is divided between
          players, so a single player&rsquo;s figure carries a wider error that
          can&rsquo;t be pinned down. Treat players separated by a few tenths of
          an NVP as level.
        </li>
        <li>
          Only the regular season counts. Playoff performance plays no part in
          Value Produced, so a player who rises in the postseason, or fades in
          it, gets no credit or blame for it here.
        </li>
        <li>
          Defense is the weak half. A team&rsquo;s defensive total is known, but
          who inside the team earned it is not, and no free data settles it. The
          split leans on minutes, on the thin defensive columns a box score
          carries, and on tracking data that only exists from 2013-14.
        </li>
        <li>
          It measures value against pay, not talent. A very good player on the
          largest contract in the league will land near zero, because
          &ldquo;very good&rdquo; is what that contract is supposed to buy.
        </li>
        <li>
          Salary data starts in 1990-91, so no earlier season has a Net Value,
          however good it was.
        </li>
        <li>
          Nothing here knows about team fit, role, or why a player was signed. A
          contract can be defensible and still score badly.
        </li>
      </ul>
    </Section>
  );
}
