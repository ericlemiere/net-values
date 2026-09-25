"use client";

import { useState, type ReactNode } from "react";
import { HEADING, SECTION } from "./Section";

type Depth = "simple" | "detailed";

const OPTIONS: { depth: Depth; label: string }[] = [
  { depth: "simple", label: "Overview" },
  { depth: "detailed", label: "Detailed" },
];

/**
 * A section that reads at two depths, with its own Simple/Detailed toggle
 * beside the heading. Each section keeps its own choice, so a reader can open
 * the arithmetic on the one part they want without the rest of the page
 * following.
 *
 * Both versions are rendered and the inactive one is `hidden`, so switching is
 * instant and search engines index both.
 */
export function DepthSection({
  title,
  id,
  simple,
  detailed,
}: {
  title: string;
  id?: string;
  simple: ReactNode;
  detailed: ReactNode;
}) {
  const [depth, setDepth] = useState<Depth>("simple");

  return (
    <section id={id} className={SECTION}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 className={HEADING}>{title}</h2>
        <div
          role="group"
          aria-label={`${title}: level of detail`}
          className="flex w-fit items-center gap-0.5 rounded-lg border border-accent bg-background p-0.5"
        >
          {OPTIONS.map((option) => (
            <button
              key={option.depth}
              type="button"
              onClick={() => setDepth(option.depth)}
              aria-pressed={depth === option.depth}
              className={`cursor-pointer rounded-md px-2.5 py-0.5 text-xs font-medium transition-colors ${
                depth === option.depth
                  ? "bg-accent text-accent-foreground"
                  : "text-white/60 hover:text-white"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div hidden={depth !== "simple"}>{simple}</div>
      <div hidden={depth !== "detailed"}>{detailed}</div>
    </section>
  );
}
