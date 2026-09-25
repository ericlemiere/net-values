"use client";

import { useEffect } from "react";
import { SiteSearch } from "@/components/SiteSearch";
import type { PlayerSearchResult } from "@/lib/db/queries";

/**
 * The site's one search surface.
 *
 * Every breakpoint reaches search the same way now — a magnifying-glass button
 * in the header opens this — so the field itself only has to be designed once,
 * at a size that suits a phone as readily as a desktop.
 *
 * It renders inside the header, like the mobile drawer, so it inherits the
 * header's stacking context instead of fighting the page for a z-index. How it
 * moves lives in globals.css under `.search-modal`; `closing` is what lets the
 * exit animation finish before SiteHeader unmounts it.
 */
export function SearchModal({
  closing,
  onClose,
  inputRef,
  onSelectPlayer,
}: {
  closing: boolean;
  onClose: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  /** Makes this the player picker /price-check opens — see SiteSearch. */
  onSelectPlayer?: (player: PlayerSearchResult) => void;
}) {
  const label = onSelectPlayer ? "Add a player" : "Search players or teams";
  // The page behind the scrim must not scroll under it, and Escape closes.
  useEffect(() => {
    if (closing) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [closing, onClose]);

  return (
    <div
      className={`search-modal${closing ? " is-closing" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      {/* Behind the panel, so a press anywhere the panel isn't dismisses. */}
      <div className="search-modal-scrim" onClick={onClose} aria-hidden="true" />

      <div className="search-modal-panel">
        <div className="mb-2 flex items-center justify-between gap-4">
          <span className="text-xs font-medium uppercase tracking-wide text-white/40">
            {onSelectPlayer ? "Add player" : "Search"}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label={onSelectPlayer ? "Close" : "Close search"}
            className="-mr-1 -mt-1 inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded text-white/50 transition-colors hover:text-accent"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="h-4.5 w-4.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 6l12 12" />
              <path d="M18 6L6 18" />
            </svg>
          </button>
        </div>

        <SiteSearch
          className="w-full"
          inputClassName="px-4 py-3 rounded-lg"
          inputRef={inputRef}
          onNavigate={onClose}
          onSelectPlayer={onSelectPlayer}
        />
      </div>
    </div>
  );
}
