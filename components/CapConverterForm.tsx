"use client";

import Form from "next/form";
import { useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { FilterDropdown } from "./FilterDropdown";
import { SegmentedControl } from "./SegmentedControl";
import { SiteSearch } from "./SiteSearch";
import { Spinner } from "./Spinner";
import type { CapSeason } from "@/lib/db/queries";

export type CapInputMode = "salary" | "pct" | "player";

/** A player's pay in one of the seasons the converter covers. */
export interface CapPlayerSeason {
  season: string;
  salary: number;
}

export interface CapPlayer {
  id: number;
  name: string;
}

/** Up to three digits before the point and two after: 123.45. */
const PARTIAL = /^\d{0,3}(\.\d{0,2})?$/;

/**
 * To the hundredth, the precision the input takes. Nearest rather than outward,
 * so the max reads as the figure someone was paid ($48.07M for $48,070,014)
 * instead of a cent past it.
 */
function round2(n: number) {
  return Math.round(n * 100) / 100;
}

const MODES: { value: CapInputMode; label: string }[] = [
  { value: "salary", label: "Salary" },
  { value: "pct", label: "% of cap" },
  { value: "player", label: "Player" },
];

/**
 * The /cap-converter inputs. A GET form, so the conversion lives in the URL;
 * `<Form>` makes the submit a client-side navigation rather than a reload.
 *
 * The figure goes in as a salary in millions (?amount=), a share of the cap
 * (?pct=), or a player's own pay that season (?player=). The figure comes
 * before the season, and changing the season keeps it: a salary or share that
 * no one was paid in the new season says so rather than being cleared. A
 * player narrows the seasons to the ones he was paid in.
 *
 * FilterDropdown is a button and a listbox, not a form control, so the season
 * it holds rides along in a hidden input.
 */
export function CapConverterForm({
  capSeasons,
  season,
  mode: initialMode,
  value: initialValue,
  player: initialPlayer,
}: {
  /** Newest first. */
  capSeasons: CapSeason[];
  season: string;
  mode: CapInputMode;
  value: number;
  /** The player being converted, with his seasons, when the URL names one. */
  player: (CapPlayer & { seasons: CapPlayerSeason[] }) | null;
}) {
  const [picked, setPicked] = useState(season);
  const [mode, setMode] = useState(initialMode);
  const [value, setValue] = useState(String(initialValue));
  const [player, setPlayer] = useState<CapPlayer | null>(
    initialPlayer && { id: initialPlayer.id, name: initialPlayer.name },
  );
  // Null while they're being fetched, or before anyone is picked.
  const [playerSeasons, setPlayerSeasons] = useState<CapPlayerSeason[] | null>(
    initialPlayer?.seasons ?? null,
  );
  const [loadFailed, setLoadFailed] = useState(false);
  // Only the latest pick's answer is kept, if a slower earlier one lands after.
  const requestRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const errorId = useId();

  const range = capSeasons.find((s) => s.season === picked);
  const boundsFor = (m: CapInputMode, seasonRange = range) =>
    !seasonRange || m === "player"
      ? null
      : m === "salary"
        ? {
            min: round2(seasonRange.minSalary / 1e6),
            max: round2(seasonRange.maxSalary / 1e6),
          }
        : {
            min: round2((100 * seasonRange.minSalary) / seasonRange.leagueCap),
            max: round2((100 * seasonRange.maxSalary) / seasonRange.leagueCap),
          };
  const bounds = boundsFor(mode);
  // Max picked rather than a figure typed: the most anyone was paid, in
  // whichever season is chosen, so the figure follows a change of season
  // instead of going stale. Typing a figure lets go of it.
  const [maxed, setMaxed] = useState(
    bounds !== null && Number(initialValue) === bounds.max,
  );
  const paid = playerSeasons?.find((s) => s.season === picked);

  // The input is text, to hold the digit format, so the range is checked by
  // hand. The message is the page's own rather than the browser's bubble.
  // Anything the page already knows is wrong says so straight away: a figure
  // past the season's max, as it's typed or when the season changes under it,
  // and a player with no salary to convert. A missing or too-small figure, or
  // no player at all, waits for a submit.
  const [tried, setTried] = useState(false);
  const n = Number(value);
  const what = mode === "salary" ? "a salary" : "a share of the cap";
  const over = bounds !== null && value !== "" && n > bounds.max;
  // Kept to one line: the message hangs in the gap under the form's panel,
  // which has room for one.
  const fmt = (x: number) => (mode === "salary" ? `$${x}M` : `${x}%`);
  const error =
    mode === "player"
      ? !player
        ? tried
          ? "Pick a player to look up."
          : ""
        : loadFailed
          ? `Couldn't load ${player.name}'s salaries. Pick him again.`
          : playerSeasons?.length === 0
            ? `No salary on record for ${player.name}.`
            : ""
      : !bounds
        ? ""
        : over
          ? `No one was paid that much in ${picked}. Max is ${fmt(bounds.max)}.`
          : !tried
            ? ""
            : value === "" || n === 0
              ? `Enter ${what} to convert.`
              : n < bounds.min
                ? `No one was paid that little in ${picked}. Min is ${fmt(bounds.min)}.`
                : "";
  const blocked =
    mode === "player"
      ? !player || !paid
      : !bounds || value === "" || n === 0 || n < bounds.min || n > bounds.max;

  async function pickPlayer(next: CapPlayer) {
    const request = ++requestRef.current;
    setPlayer(next);
    setPlayerSeasons(null);
    setLoadFailed(false);
    setTried(false);
    try {
      const res = await fetch(`/api/player-cap-seasons?id=${next.id}`);
      if (!res.ok) throw new Error(String(res.status));
      const { seasons } = (await res.json()) as { seasons: CapPlayerSeason[] };
      if (request !== requestRef.current) return;
      setPlayerSeasons(seasons);
      // Keep the season if he was paid in it; otherwise his latest.
      if (seasons.length > 0 && !seasons.some((s) => s.season === picked)) {
        setPicked(seasons[0].season);
      }
    } catch {
      if (request === requestRef.current) setLoadFailed(true);
    }
  }

  function clearPlayer() {
    requestRef.current++;
    // Back to the search. flushSync so the field exists to focus inside the
    // tap, which is the only focus() iOS raises the keyboard for.
    flushSync(() => {
      setPlayer(null);
      setPlayerSeasons(null);
      setLoadFailed(false);
    });
    searchRef.current?.focus();
  }

  function switchMode(next: CapInputMode) {
    if (next === mode) return;
    setMode(next);
    setTried(false);
    if (next === "player" || !range) return;
    // Carry the figure across rather than clearing it: the same money,
    // restated. Leaving a player, that's his pay in the season picked.
    let converted: number;
    if (mode === "player") {
      if (!paid) return;
      setMaxed(false);
      converted =
        next === "salary"
          ? paid.salary / 1e6
          : (100 * paid.salary) / range.leagueCap;
    } else {
      const n = Number(value);
      if (value === "" || !Number.isFinite(n)) return;
      converted =
        next === "pct"
          ? (100 * n * 1e6) / range.leagueCap
          : ((n / 100) * range.leagueCap) / 1e6;
    }
    // Each mode's bounds are rounded on their own, so the max of one can
    // restate a hundredth past the max of the other. Held to the range.
    const { min, max } = boundsFor(next)!;
    setValue(String(Math.min(max, Math.max(min, round2(converted)))));
  }

  // A player's seasons once they're in; until then, and in the other modes,
  // every season the converter covers.
  const seasonOptions =
    mode === "player" && playerSeasons && playerSeasons.length > 0
      ? playerSeasons.map((s) => s.season)
      : capSeasons.map((s) => s.season);

  const input = (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      name={mode === "salary" ? "amount" : "pct"}
      autoComplete="off"
      aria-invalid={error !== ""}
      aria-describedby={error ? errorId : undefined}
      aria-label={
        mode === "salary" ? "Salary in millions" : "Percent of the cap"
      }
      value={value}
      onChange={(e) => {
        if (!PARTIAL.test(e.target.value)) return;
        setValue(e.target.value);
        setMaxed(false);
      }}
      // An error recolors the focus ring rather than adding a border of its
      // own, which stacked a red ring inside the yellow one. The left padding
      // clears the dollar sign laid over it.
      className={`w-full rounded-md border border-white/20 bg-white/5 py-1 pl-6 pr-2.5 text-right font-mono tabular-nums text-white transition-colors hover:border-white/40 focus-visible:outline-2 focus-visible:outline-offset-2 ${
        error ? "focus-visible:outline-red-400" : "focus-visible:outline-accent"
      }`}
    />
  );

  const playerInput = player ? (
    <div className="flex w-full min-w-0 items-center gap-2 rounded-md border border-white/20 bg-white/5 py-1 pl-2.5 pr-1">
      <span className="min-w-0 flex-1 truncate">{player.name}</span>
      {playerSeasons === null && !loadFailed && (
        <Spinner size="1em" />
      )}
      <input type="hidden" name="player" value={player.id} />
      <button
        type="button"
        onClick={clearPlayer}
        aria-label={`Change player from ${player.name}`}
        title="Change player"
        className="inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded text-white/50 transition-colors hover:text-accent"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  ) : (
    // The /price-check picker: players only, and a pick hands the player back
    // here rather than opening his page.
    <SiteSearch
      className="w-full"
      inputClassName="px-2.5 py-1"
      inputRef={searchRef}
      onSelectPlayer={(p) => pickPlayer({ id: p.id, name: p.name })}
    />
  );

  return (
    <Form
      action=""
      scroll={false}
      noValidate
      onSubmit={(e) => {
        if (!blocked) return;
        // Stops the navigation <Form> would make; the message says why.
        e.preventDefault();
        setTried(true);
        (mode === "player" ? searchRef : inputRef).current?.focus();
      }}
      className="relative flex flex-col justify-center gap-3 rounded-lg bg-neutral-800 p-4 md:w-fit min-[71rem]:w-auto"
    >
      {/* The same control as the explainer's Overview / Detailed switch on
          /net-value, at the season dropdown's height and across the card like
          every line under it. */}
      <SegmentedControl
        label="Enter as"
        options={MODES}
        value={mode}
        onChange={switchMode}
        size="md"
        fill
      />

      {/* One line each: how it's entered, the figure, then the season it was
          paid in and the submit. The figure's line has one width for all
          three modes, so switching between them swaps what's inside without
          resizing the panel. */}
      <div className="flex w-full items-center gap-2 text-sm text-white md:min-w-72">
        {mode === "player" ? (
          playerInput
        ) : (
          <>
            {/* The input, the words after it, and Max at fixed widths, so
                switching between salary and share swaps the words without
                moving anything. The dollar sign sits inside the field, which
                keeps the field flush with the toggle above it. */}
            <div className="relative w-24 shrink-0">
              {mode === "salary" && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center font-mono text-white/50"
                >
                  $
                </span>
              )}
              {input}
            </div>
            <span className="w-16 shrink-0 text-white/70">
              {mode === "salary" ? "million" : "% of cap"}
            </span>
            {bounds && (
              <button
                type="button"
                aria-pressed={maxed}
                onClick={() => {
                  setValue(String(bounds.max));
                  setMaxed(true);
                }}
                title={`The most anyone was paid in ${picked}`}
                // Accent while it holds, so it's plain the figure will follow the season.
                className={`ml-auto w-28 shrink-0 cursor-pointer rounded-md border bg-black px-2 py-1 text-center font-mono text-xs transition-colors hover:bg-white/10 ${
                  maxed
                    ? "border-accent text-accent"
                    : "border-white text-white/80 hover:text-white"
                }`}
              >
                Max {fmt(bounds.max)}
              </button>
            )}
          </>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        {/* FilterDropdown boxes itself everywhere else; inside this panel it
            sits bare like the controls around it. */}
        <FilterDropdown
          className="w-auto! shrink-0 bg-transparent! p-0!"
          label="Season"
          value={picked}
          options={seasonOptions.map((s) => ({ value: s, label: s }))}
          onChange={(next) => {
            setPicked(next);
            // A picked Max moves to the new season's; a typed figure stays,
            // and says so if no one was paid it that season.
            const nextBounds = maxed
              ? boundsFor(mode, capSeasons.find((s) => s.season === next))
              : null;
            if (nextBounds) setValue(String(nextBounds.max));
          }}
        />
        <input type="hidden" name="season" value={picked} />

        <button
          type="submit"
          className="min-w-0 flex-1 cursor-pointer rounded-md bg-accent px-4 py-2 text-sm font-medium text-black hover:bg-accent/80 md:min-w-26 md:flex-none md:px-5"
        >
          {mode === "player" ? "Look up" : "Convert"}
        </button>
      </div>
      {/* Out of the flow, in the gap under the form's panel, so it can come and
          go as the figure is typed without pushing anything down. */}
      {error && (
        <p
          id={errorId}
          role="alert"
          className="absolute left-0 top-full mt-1 text-xs text-red-400 md:whitespace-nowrap md:text-sm"
        >
          {error}
        </p>
      )}
    </Form>
  );
}
