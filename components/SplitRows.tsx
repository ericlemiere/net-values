"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

const SplitContext = createContext<{
  open: boolean;
  toggle: () => void;
} | null>(null);

/**
 * A table row with rows folded away under it — a traded player's season, with
 * one row per team beneath the season total.
 *
 * Only the open/closed state lives here. The cells arrive already rendered,
 * so SimpleTable keeps its column definitions on the server, and the button
 * that opens the group sits wherever SimpleTable puts a <SplitToggle> inside
 * `row`, which finds its way back here through context.
 */
export function SplitGroup({
  row,
  splits,
}: {
  /** The season row, a <tr>. */
  row: ReactNode;
  /** One <tr> per team, shown while the group is open. */
  splits: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <SplitContext.Provider value={{ open, toggle: () => setOpen((o) => !o) }}>
      {row}
      {open && splits}
    </SplitContext.Provider>
  );
}

/**
 * The +/− button that opens a SplitGroup. A button of its own rather than a
 * clickable row, so a row that is already a link (the salary log's) keeps
 * meaning "select this season" everywhere else on it.
 *
 * Plus and minus rather than a chevron: the team cell it sits in already has
 * an arrow between the teams of a traded season, and two arrow shapes side by
 * side read as one.
 */
export function SplitToggle({ label }: { label: string }) {
  const ctx = useContext(SplitContext);
  if (!ctx) return null;
  const { open, toggle } = ctx;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={open}
      aria-label={`${open ? "Hide" : "Show"} ${label}`}
      title={`${open ? "Hide" : "Show"} ${label}`}
      // Dressed like an award badge, so it reads as something to press
      // rather than a stray glyph, and inverted the same way on hover. Open,
      // it stays inverted, which is the state it controls.
      className={`ml-1.5 inline-flex h-[18px] w-[18px] shrink-0 cursor-pointer items-center justify-center rounded border transition-colors ${
        open
          ? "border-black bg-black text-white"
          : "border-black/40 bg-black/[0.07] text-black/80 hover:border-black hover:bg-black hover:text-white"
      }`}
    >
      <svg viewBox="0 0 16 16" aria-hidden className="size-2.5">
        <path
          d="M3 8h10"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
        />
        {/* The vertical stroke turns flat onto the horizontal one as the row
            opens, so the + folds into a − rather than swapping for it. */}
        <path
          d="M8 3v10"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          className={`origin-center transition-transform duration-200 ease-out motion-reduce:transition-none [transform-box:fill-box] ${
            open ? "rotate-90" : ""
          }`}
        />
      </svg>
    </button>
  );
}
