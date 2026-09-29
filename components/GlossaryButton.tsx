"use client";

import { useState } from "react";
import type { GlossaryEntry } from "@/lib/glossary";
import { InfoButton } from "./InfoButton";
import { Modal } from "./Modal";

/**
 * The "?" above a table's top-right corner, opening its column definitions.
 *
 * Column headings also explain themselves in a hover tooltip, but a finger
 * never triggers one, so the same definitions sit one press away beside every
 * table. Build `entries` with `glossaryFor`.
 */
export function GlossaryButton({
  entries,
  className = "",
}: {
  entries: GlossaryEntry[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (entries.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="What do these columns mean?"
        title="What do these columns mean?"
        // The pseudo-element widens what a finger can hit to a usable size.
        // Solid black so the logo watermark behind it doesn't cut through.
        className={`relative inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full border border-accent/50 bg-black text-xs font-semibold leading-none text-white/80 transition-colors after:absolute after:-inset-2 hover:border-accent hover:text-accent ${className}`}
      >
        ?
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Glossary">
        {/* Heading, what it stands for, and a "?" wherever there's more to
            say. The labels share a column so the names line up. */}
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 text-sm">
          {entries.map((e) => (
            <div
              key={e.key}
              className="col-span-2 grid grid-cols-subgrid items-baseline border-t border-white/10 py-2.5 first:border-t-0"
            >
              <dt className="font-mono font-semibold whitespace-nowrap text-white">
                {e.label}
              </dt>
              <dd className="flex items-start gap-1.5 text-white/70">
                <span>{e.name}</span>
                {e.detail && (
                  // One line tall, with the circle centered in it: level with
                  // the text's first line however many lines the name takes.
                  // `align-middle` centers on the lowercase letters instead,
                  // which sits the circle visibly low.
                  <span className="flex h-lh shrink-0 items-center">
                    <InfoButton title={e.name}>
                      <p className="mt-3 text-sm leading-relaxed text-white/70">
                        {e.detail}
                      </p>
                    </InfoButton>
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </Modal>
    </>
  );
}
