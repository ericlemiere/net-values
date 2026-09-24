import type { ReactNode } from "react";

/**
 * A chapter marker between groups of tables on one page.
 *
 * A player's page is a dozen tables deep, and every one of them already wears
 * a `text-lg` white title. Another heading in that same voice would just be a
 * thirteenth table title. So this is deliberately a different kind of mark:
 * small, letterspaced, in the accent, with a hairline running out to the edge
 * of the page. It reads as a rule you cross rather than a thing you read, and
 * it can't be mistaken for the title of the table under it.
 *
 * Using the accent for structure rather than state is consistent with the
 * sheets themselves, which are outlined in it — what the accent is reserved
 * from is *filling* something, which is how a selected row and a sorted column
 * are marked.
 */
export function SectionHeading({
  children,
  /** A line under the rule, where the whole section needs one sentence. */
  subtitle,
}: {
  children: ReactNode;
  subtitle?: ReactNode;
}) {
  return (
    <div className="w-full min-w-0">
      <div className="flex items-center gap-4">
        <h2 className="shrink-0 text-lg font-semibold tracking-[0.2em] text-accent uppercase">
          {children}
        </h2>
        <div className="h-px min-w-0 flex-1 bg-accent/25" />
      </div>
      {subtitle && (
        <div className="mt-2 text-sm text-white/60">{subtitle}</div>
      )}
    </div>
  );
}
