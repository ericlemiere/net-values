"use client";

import Form from "next/form";
import { useId, useRef, useState } from "react";
import { FilterDropdown } from "./FilterDropdown";
import type { CapSeason } from "@/lib/db/queries";

export type CapInputMode = "salary" | "pct";

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

// The same switch as the explainer's Simple / Detailed toggle on /net-value
// (DepthSection): a thin accent outline round both sides, the one that's on
// filled in. Sized to the season dropdown's button beside it rather than the
// explainer's: the same height, and its rounded-md corners.
const TOGGLE_GROUP =
  "flex w-fit items-center gap-0.5 rounded-md border border-accent bg-background p-0.5";
const TOGGLE_BTN =
  "cursor-pointer rounded px-2.5 py-1 text-xs font-medium transition-colors";
const TOGGLE_ON = "bg-accent text-accent-foreground";
const TOGGLE_OFF = "text-white/60 hover:text-white";

const MODES: { mode: CapInputMode; label: string }[] = [
  { mode: "salary", label: "Salary" },
  { mode: "pct", label: "% of cap" },
];

/**
 * The /cap-converter inputs. A GET form, so the conversion lives in the URL;
 * `<Form>` makes the submit a client-side navigation rather than a reload.
 *
 * The figure goes in as a salary in millions (?amount=) or a share of the cap
 * (?pct=). Either way its bounds come from the season picked: the least and
 * most anyone was paid that season. That's why season comes first, and why
 * changing it clears the figure, which may not fit the new range.
 *
 * FilterDropdown is a button and a listbox, not a form control, so the season
 * it holds rides along in a hidden input.
 */
export function CapConverterForm({
  capSeasons,
  season,
  mode: initialMode,
  value: initialValue,
}: {
  /** Newest first. */
  capSeasons: CapSeason[];
  season: string;
  mode: CapInputMode;
  value: number;
}) {
  const [picked, setPicked] = useState(season);
  const [mode, setMode] = useState(initialMode);
  const [value, setValue] = useState(String(initialValue));
  const inputRef = useRef<HTMLInputElement>(null);
  const errorId = useId();

  const range = capSeasons.find((s) => s.season === picked);
  const boundsFor = (m: CapInputMode) =>
    !range
      ? null
      : m === "salary"
        ? {
            min: round2(range.minSalary / 1e6),
            max: round2(range.maxSalary / 1e6),
          }
        : {
            min: round2((100 * range.minSalary) / range.leagueCap),
            max: round2((100 * range.maxSalary) / range.leagueCap),
          };
  const bounds = boundsFor(mode);

  // The input is text, to hold the digit format, so the range is checked by
  // hand. The message is the page's own rather than the browser's bubble: a
  // figure past the max says so as it's typed, since the max is the one limit
  // people will run into; a missing or too-small figure waits for a submit.
  const [tried, setTried] = useState(false);
  const n = Number(value);
  const what = mode === "salary" ? "a salary" : "a share of the cap";
  const over = bounds !== null && value !== "" && n > bounds.max;
  // Kept to one line: the message hangs in the gap under the form's panel,
  // which has room for one.
  const fmt = (x: number) => (mode === "salary" ? `$${x}M` : `${x}%`);
  const error = !bounds
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
    !bounds || value === "" || n === 0 || n < bounds.min || n > bounds.max;

  function switchMode(next: CapInputMode) {
    if (next === mode) return;
    setMode(next);
    // Carry the figure across rather than clearing it: the same money, restated.
    const n = Number(value);
    if (!range || value === "" || !Number.isFinite(n)) return;
    const converted =
      next === "pct"
        ? (100 * n * 1e6) / range.leagueCap
        : ((n / 100) * range.leagueCap) / 1e6;
    // Each mode's bounds are rounded on their own, so the max of one can
    // restate a hundredth past the max of the other. Held to the range.
    const { min, max } = boundsFor(next)!;
    const rounded = Math.round(converted * 100) / 100;
    setValue(String(Math.min(max, Math.max(min, rounded))));
  }

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
        if (PARTIAL.test(e.target.value)) setValue(e.target.value);
      }}
      // An error recolors the focus ring rather than adding a border of its
      // own, which stacked a red ring inside the yellow one.
      className={`w-20 rounded-md border border-white/20 bg-white/5 px-2.5 py-1 text-right font-mono tabular-nums text-white transition-colors hover:border-white/40 focus-visible:outline-2 focus-visible:outline-offset-2 ${
        error ? "focus-visible:outline-red-400" : "focus-visible:outline-accent"
      }`}
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
        inputRef.current?.focus();
      }}
      className="relative flex flex-col justify-center gap-3 rounded-lg bg-neutral-800 p-4 md:w-fit xl:w-auto"
    >
      {/* What is being converted, then the figure itself. */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        {/* FilterDropdown boxes itself everywhere else; inside this panel it
            sits bare like the controls around it. */}
        <FilterDropdown
          className="bg-transparent! p-0!"
          label="Season"
          value={picked}
          options={capSeasons.map((s) => ({
            value: s.season,
            label: s.season,
          }))}
          onChange={(next) => {
            setPicked(next);
            setValue("");
            setTried(false);
          }}
        />
        <input type="hidden" name="season" value={picked} />

        <div role="group" aria-label="Enter as" className={TOGGLE_GROUP}>
          {MODES.map((m) => (
            <button
              key={m.mode}
              type="button"
              aria-pressed={mode === m.mode}
              onClick={() => switchMode(m.mode)}
              className={`${TOGGLE_BTN} ${mode === m.mode ? TOGGLE_ON : TOGGLE_OFF}`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-stretch">
        <div className="flex w-full items-center gap-1 text-sm text-white md:w-auto md:flex-1">
          {/* Fixed slots either side of the input and a fixed-width Max, so
              switching between salary and share swaps the words without
              moving anything. */}
          <span className="w-2 shrink-0 font-mono text-white/70">
            {mode === "salary" ? "$" : ""}
          </span>
          {input}
          <span className="w-16 shrink-0 text-white/70">
            {mode === "salary" ? "million" : "% of cap"}
          </span>
          {bounds && (
            <button
              type="button"
              onClick={() => setValue(String(bounds.max))}
              title={`The most anyone was paid in ${picked}`}
              className="ml-auto w-28 shrink-0 cursor-pointer rounded-md border border-white bg-black px-2 py-1 text-center font-mono text-xs text-white/80 transition-colors hover:bg-white/10 hover:text-white md:ml-1"
            >
              Max {fmt(bounds.max)}
            </button>
          )}
        </div>

        <button
          type="submit"
          className="cursor-pointer rounded-md bg-accent px-5 py-2 text-sm font-medium text-black hover:bg-accent/80"
        >
          Convert
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
