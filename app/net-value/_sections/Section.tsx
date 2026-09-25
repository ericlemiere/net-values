import type { ReactNode } from "react";

export const HEADING = "text-xl font-semibold tracking-tight";

/** Body copy under a section heading. */
export const PROSE = "mt-3 max-w-prose text-sm text-white/70";

export const SECTION = "mt-12 scroll-mt-24";

/** A titled block of the explainer. */
export function Section({
  title,
  id,
  className = "",
  children,
}: {
  title: ReactNode;
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={`${SECTION} ${className}`}>
      <h2 className={HEADING}>{title}</h2>
      {children}
    </section>
  );
}
