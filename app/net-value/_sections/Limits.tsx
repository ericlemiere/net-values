import { Section, PROSE } from "./Section";

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
