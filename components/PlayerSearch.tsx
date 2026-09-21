"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PlayerSearchResult } from "@/lib/db/queries";

const DEBOUNCE_MS = 180;

/** "1996-1997" + "2015-2016" -> "1996–2016"; a single season stays "1996-97". */
function careerSpan(first: string | null, last: string | null) {
  if (!first || !last) return null;
  if (first === last) return `${first.slice(0, 4)}-${first.slice(7)}`;
  return `${first.slice(0, 4)}–${last.slice(5)}`;
}

export function PlayerSearch() {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlayerSearchResult[]>([]);
  // The query `results` belong to. Lets the list tell "still fetching" apart
  // from "genuinely nothing matches", which otherwise both look like an empty
  // array and flash a wrong "No players found."
  const [resultsFor, setResultsFor] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query.trim();
    // Too short to search. The previous hits stay in state but `showList`
    // keeps them hidden, so backspacing and retyping doesn't flash an empty
    // list between requests.
    if (q.length < 2) return;
    // Debounce, and abort the in-flight request on the next keystroke so a slow
    // early response can't overwrite the results for what's now in the box.
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/players/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data: { players: PlayerSearchResult[] } = await res.json();
        setResults(data.players);
        setResultsFor(q);
        setHighlighted(0);
        setOpen(true);
      } catch {
        // Aborted or offline — leave the previous results in place.
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // A click anywhere else dismisses the dropdown. Pointerdown rather than click
  // so the list closes even if the press lands on a link that navigates away.
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const showList = open && query.trim().length >= 2;
  const pending = query.trim() !== resultsFor;

  function go(player: PlayerSearchResult) {
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push(`/players/${player.id}`);
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    if (e.target.value.trim().length >= 2) setOpen(true);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!showList || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[highlighted]);
    }
  }

  return (
    <div ref={containerRef} className="relative ml-auto w-56 sm:w-72">
      <input
        type="search"
        value={query}
        onChange={onChange}
        onFocus={() => results.length > 0 && setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search players…"
        aria-label="Search players"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        className="w-full rounded-md border border-stone-600 bg-white/10 px-3 py-1.5 text-sm text-white placeholder-white/40 outline-none transition-colors focus:bg-white/10"
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute right-0 z-50 mt-1 max-h-80 w-full overflow-y-auto rounded-md border-2 border-accent bg-black shadow-xl shadow-black/60"
        >
          {results.map((player, i) => {
            const span = careerSpan(player.firstSeason, player.lastSeason);
            return (
              <li key={player.id} role="option" aria-selected={i === highlighted}>
                <button
                  type="button"
                  // Mousedown fires before the input's blur, so the click always
                  // lands on a list that is still mounted.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => go(player)}
                  onMouseEnter={() => setHighlighted(i)}
                  className={`flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-sm transition-colors ${
                    i === highlighted ? "bg-accent text-black" : "text-white hover:bg-white/5"
                  }`}
                >
                  <span className="truncate">{player.name}</span>
                  {span && (
                    <span
                      className={`shrink-0 font-mono text-xs tabular-nums ${
                        i === highlighted ? "text-black/60" : "text-white/40"
                      }`}
                    >
                      {span}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
          {results.length === 0 && (
            <li className="px-3 py-2 text-sm text-white/40">
              {pending ? "Searching\u2026" : "No players found."}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
