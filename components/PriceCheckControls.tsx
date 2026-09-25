"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { useTableNav } from "./TableNav";
import { FilterDropdown } from "./FilterDropdown";
import { SiteSearch } from "./SiteSearch";
import { Spinner } from "./Spinner";
import {
  PRICE_STAT_KEYS,
  PRICE_STATS,
  priceCheckHref,
  type PriceCheckState,
  type PriceStat,
  type PriceView,
} from "@/lib/price-check";

/**
 * The /price-check controls. The page's whole state lives in its URL, so each
 * of these is a link in disguise: work out the next state, then navigate to it
 * through the shared transition, which is what dims the cards while the server
 * renders the new figures.
 */

type Slot = 1 | 2;

function usePriceNav() {
  const { navigate } = useTableNav();
  // The controls sit partway down the page, so a change must not scroll it
  // back to the top.
  return useCallback(
    (state: PriceCheckState) =>
      navigate(priceCheckHref(state), { scroll: false }),
    [navigate],
  );
}

/**
 * A player's card, which says so itself while the page re-renders. Every
 * control here reloads the whole page, so with two players both cards dim
 * together — whichever one the change came from.
 */
export function PriceCard({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const { pending } = useTableNav();
  return (
    <section
      aria-label={label}
      aria-busy={pending}
      className="relative min-w-0 rounded-lg border-2 border-accent bg-background-box p-4"
    >
      <div
        className={`flex min-w-0 flex-col gap-4 transition-opacity duration-150 ${
          pending ? "opacity-30" : ""
        }`}
      >
        {children}
      </div>
      {pending && (
        // Covers the card so a second change can't queue behind the first.
        <div className="absolute inset-0 grid place-items-center">
          <span className="flex items-center gap-3 rounded-lg border-2 border-accent bg-black/90 px-4 py-2 text-sm text-white">
            <Spinner size="1.5em" />
            Loading
          </span>
        </div>
      )}
    </section>
  );
}

/**
 * An empty player slot. "Add player" turns the slot itself into the player
 * search, so the picker opens where the new card will appear rather than over
 * the whole page.
 */
export function AddPlayerSlot({
  state,
  slot,
  prompt,
  className = "",
}: {
  state: PriceCheckState;
  slot: Slot;
  prompt: string;
  className?: string;
}) {
  const go = usePriceNav();
  const [mode, setMode] = useState<"idle" | "search" | "adding">("idle");
  const inputRef = useRef<HTMLInputElement>(null);

  function open() {
    // flushSync so the field exists to focus inside the tap — iOS only raises
    // the keyboard for a focus() that happens during the gesture.
    flushSync(() => setMode("search"));
    inputRef.current?.focus();
  }

  const pick = useCallback(
    (player: { id: number }) => {
      setMode("adding");
      // A new player starts on his own default season, not the last one's.
      go(
        slot === 1
          ? { ...state, p1: player.id, s1: null }
          : { ...state, p2: player.id, s2: null },
      );
    },
    [go, slot, state],
  );

  // Escape clears the results list first (SiteSearch handles that), and only
  // closes the search once there's no list left to clear.
  function onKeyDown(e: React.KeyboardEvent) {
    if (
      e.key === "Escape" &&
      inputRef.current?.getAttribute("aria-expanded") !== "true"
    ) {
      setMode("idle");
    }
  }

  return (
    <div
      className={`flex min-h-64 flex-col gap-3 rounded-lg border-2 border-dashed border-white/20 bg-background-box/90 p-6 ${
        mode === "search"
          ? "justify-start"
          : "items-center justify-center text-center"
      } ${className}`.trim()}
    >
      {mode === "idle" && (
        <>
          <p className="text-sm text-white/50">{prompt}</p>
          <button
            type="button"
            onClick={open}
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-accent bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-colors hover:bg-transparent hover:text-accent"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add player
          </button>
        </>
      )}
      {mode === "search" && (
        <div role="search" aria-label="Add a player" onKeyDown={onKeyDown}>
          <div className="mb-2 flex items-center justify-between gap-4">
            <span className="text-xs font-medium uppercase tracking-wide text-white/40">
              Add player
            </span>
            <button
              type="button"
              onClick={() => setMode("idle")}
              aria-label="Cancel"
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
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <SiteSearch
            className="w-full"
            inputClassName="px-4 py-3 rounded-lg"
            inputRef={inputRef}
            onSelectPlayer={pick}
          />
        </div>
      )}
      {mode === "adding" && (
        <span className="flex items-center gap-3 text-sm text-white/70">
          <Spinner size="1.5em" />
          Loading
        </span>
      )}
    </div>
  );
}

/** Drops a player. Removing the first moves the second into his place. */
export function RemovePlayerButton({
  state,
  slot,
  name,
}: {
  state: PriceCheckState;
  slot: Slot;
  name: string;
}) {
  const go = usePriceNav();
  return (
    <button
      type="button"
      onClick={() =>
        go(
          slot === 2
            ? { ...state, p2: null, s2: null, stat2: null }
            : {
                ...state,
                p1: state.p2,
                s1: state.s2,
                p2: null,
                s2: null,
                // His own stat, if he had one, becomes the page's.
                stat: state.stat2 ?? state.stat,
                stat2: null,
              },
        )
      }
      aria-label={`Remove ${name}`}
      title={`Remove ${name}`}
      className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded text-white/50 transition-colors hover:text-accent"
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-4.5 w-4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
  );
}

export function PriceSeasonFilter({
  state,
  slot,
  seasons,
  value,
}: {
  state: PriceCheckState;
  slot: Slot;
  /** Newest first. */
  seasons: string[];
  value: string;
}) {
  const go = usePriceNav();
  return (
    <FilterDropdown
      label="Season"
      value={value}
      options={seasons.map((s) => ({ value: s, label: s }))}
      onChange={(next) =>
        go(slot === 1 ? { ...state, s1: next } : { ...state, s2: next })
      }
      className="md:w-full"
    />
  );
}

const STAT_OPTIONS = PRICE_STAT_KEYS.map((key) => ({
  value: key,
  label: PRICE_STATS[key].label,
}));

/**
 * The stat picker. While the two players are linked, either card's picker
 * moves both; unlinked, each card keeps its own.
 */
export function PriceStatFilter({
  state,
  slot,
  value,
}: {
  state: PriceCheckState;
  slot: Slot;
  value: PriceStat;
}) {
  const go = usePriceNav();
  return (
    <FilterDropdown
      label="Stat"
      value={value}
      options={STAT_OPTIONS}
      onChange={(next) => {
        const stat = next as PriceStat;
        if (state.stat2 === null) go({ ...state, stat });
        else if (slot === 1) go({ ...state, stat });
        else go({ ...state, stat2: stat });
      }}
      className="md:w-full"
    />
  );
}

const TOGGLE_GROUP =
  "flex w-fit items-center gap-1 rounded-lg border-2 border-accent bg-background p-1";
const TOGGLE_BTN =
  "cursor-pointer rounded-md px-3 py-1 text-sm font-medium transition-colors";
const TOGGLE_ON = "bg-accent text-accent-foreground";
const TOGGLE_OFF = "text-white/60 hover:text-white";

/** "$ per stat" or "per $1M". */
export function PriceViewToggle({ state }: { state: PriceCheckState }) {
  const go = usePriceNav();
  const options: { view: PriceView; label: string }[] = [
    { view: "dollars", label: "$ per stat" },
    { view: "million", label: "Stat per $1M" },
  ];
  return (
    <div role="group" aria-label="Show as" className={TOGGLE_GROUP}>
      {options.map((o) => (
        <button
          key={o.view}
          type="button"
          aria-pressed={state.view === o.view}
          onClick={() => go({ ...state, view: o.view })}
          className={`${TOGGLE_BTN} ${state.view === o.view ? TOGGLE_ON : TOGGLE_OFF}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Whether both players show the same stat. Unlinking hands player 2 the stat
 * he is already showing, so nothing on screen changes until someone picks a
 * new one; relinking brings him back to player 1's.
 */
export function PriceLinkToggle({ state }: { state: PriceCheckState }) {
  const go = usePriceNav();
  const linked = state.stat2 === null;
  return (
    <div role="group" aria-label="Stat for both players" className={TOGGLE_GROUP}>
      <button
        type="button"
        aria-pressed={linked}
        onClick={() => go({ ...state, stat2: null })}
        className={`${TOGGLE_BTN} ${linked ? TOGGLE_ON : TOGGLE_OFF}`}
      >
        Same stat
      </button>
      <button
        type="button"
        aria-pressed={!linked}
        onClick={() => go({ ...state, stat2: state.stat2 ?? state.stat })}
        className={`${TOGGLE_BTN} ${linked ? TOGGLE_OFF : TOGGLE_ON}`}
      >
        Separate stats
      </button>
    </div>
  );
}
