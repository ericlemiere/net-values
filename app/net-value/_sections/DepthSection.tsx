"use client";

import { useState, type ReactNode } from "react";
import { SegmentedControl } from "@/components/SegmentedControl";
import { HEADING, SECTION } from "./Section";

type Depth = "simple" | "detailed";

const OPTIONS: { value: Depth; label: string }[] = [
  { value: "simple", label: "Overview" },
  { value: "detailed", label: "Detailed" },
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
        <SegmentedControl
          label={`${title}: level of detail`}
          options={OPTIONS}
          value={depth}
          onChange={setDepth}
        />
      </div>
      <div hidden={depth !== "simple"}>{simple}</div>
      <div hidden={depth !== "detailed"}>{detailed}</div>
    </section>
  );
}
