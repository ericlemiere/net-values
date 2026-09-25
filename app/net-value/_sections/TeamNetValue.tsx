import { TeamNetValueText } from "@/components/TeamNetValueText";
import { Section } from "./Section";

/** How a team's Net Value is put together from its players'. */
export function TeamNetValue() {
  return (
    <Section title="Team Net Value">
      <TeamNetValueText />
    </Section>
  );
}
