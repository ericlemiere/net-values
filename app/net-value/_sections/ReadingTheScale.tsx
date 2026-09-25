import { Term } from "@/components/Formula";
import { Section, PROSE } from "./Section";

/** What a given Net Value means. */
export function ReadingTheScale() {
  return (
    <Section title="Reading the scale">
      <p className={PROSE}>
        Net Value is counted in NVPs, not dollars, so it doesn&rsquo;t inflate
        with the cap. Across the whole database it runs from about −5 to +9
        NVPs, and every season averages zero.
      </p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Term name="+5 NVPs and up">
          An all-time bargain, and rare: 73 seasons out of 17,000, at an average
          of 19% of the cap.
        </Term>
        <Term name="+1 to +5 NVPs">
          A clear win for the team. Good starters on sensible money.
        </Term>
        <Term name="−1 to +1 NVPs">
          Paid about right. Five of every six player-seasons land here.
        </Term>
        <Term name="Below −1 NVPs">
          The contract is underwater: injury, decline, or an overpay.
        </Term>
      </dl>
    </Section>
  );
}
