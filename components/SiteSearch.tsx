"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PlayerSearchResult, TeamSearchResult } from "@/lib/db/queries";

const DEBOUNCE_MS = 180;

/** "1996-1997" + "2015-2016" -> "1996–2016"; a single season stays "1996-97". */
function careerSpan(first: string | null, last: string | null) {
  if (!first || !last) return null;
  if (first === last) return `${first.slice(0, 4)}-${first.slice(7)}`;
  return `${first.slice(0, 4)}–${last.slice(5)}`;
}

/**
 * One row of the dropdown.
 *
 * Teams and players are shown as separate groups but navigated as one flat
 * list, because the arrow keys don't care which group a row belongs to. This
 * is what keeps the two ideas from fighting: `items` is the flat sequence the
 * keyboard walks, and the group headers are drawn from it.
 */
type SearchItem =
  | { kind: "team"; team: TeamSearchResult }
  | { kind: "player"; player: PlayerSearchResult };

export function SiteSearch({
  className = "ml-auto w-56 sm:w-72",
  inputClassName = "px-3 py-1.5",
}: {
  className?: string;
  /** Sizing for the box itself, so the drawer can run a taller field than the
   *  header bar has room for. */
  inputClassName?: string;
}) {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [teams, setTeams] = useState<TeamSearchResult[]>([]);
  const [players, setPlayers] = useState<PlayerSearchResult[]>([]);
  // The query the results belong to. Lets the list tell "still fetching" apart
  // from "genuinely nothing matches", which otherwise both look empty and
  // flash a wrong "Nothing found."
  const [resultsFor, setResultsFor] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const items: SearchItem[] = [
    ...teams.map((team) => ({ kind: "team" as const, team })),
    ...players.map((player) => ({ kind: "player" as const, player })),
  ];

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
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data: {
          teams: TeamSearchResult[];
          players: PlayerSearchResult[];
        } = await res.json();
        setTeams(data.teams);
        setPlayers(data.players);
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

  function go(item: SearchItem) {
    setOpen(false);
    setQuery("");
    setTeams([]);
    setPlayers([]);
    router.push(
      item.kind === "team"
        ? `/teams/${item.team.abbr}`
        : `/players/${item.player.id}`,
    );
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
    if (!showList || items.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((i) => (i + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((i) => (i - 1 + items.length) % items.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(items[highlighted]);
    }
  }

  return (
    <div ref={containerRef} className={`relative ${className}`.trim()}>
      <input
        type="search"
        value={query}
        onChange={onChange}
        onFocus={() => items.length > 0 && setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search players or teams…"
        aria-label="Search players or teams"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        className={`w-full rounded-md border border-white/70 bg-background/70 text-sm text-white placeholder-white/70 outline-none transition-colors focus:bg-background/80 ${inputClassName}`}
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute right-0 z-50 mt-1 max-h-80 w-full overflow-y-auto rounded-md border-2 border-accent bg-black shadow-xl shadow-black/60"
        >
          {items.map((item, i) => {
            const active = i === highlighted;
            // A header above the first row of each group, and only when the
            // other group has rows too — one list of players needs no label
            // telling it what it obviously is.
            const header =
              items.length > teams.length && teams.length > 0
                ? i === 0
                  ? "Teams"
                  : i === teams.length
                    ? "Players"
                    : null
                : null;
            return (
              <li
                key={
                  item.kind === "team"
                    ? `team-${item.team.abbr}`
                    : `player-${item.player.id}`
                }
                role="option"
                aria-selected={active}
              >
                {header && (
                  <div className="px-3 pt-2 pb-1 text-[0.625rem] font-medium uppercase tracking-wide text-white/35">
                    {header}
                  </div>
                )}
                <button
                  type="button"
                  // Mousedown fires before the input's blur, so the click always
                  // lands on a list that is still mounted.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => go(item)}
                  onMouseEnter={() => setHighlighted(i)}
                  className={`flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-sm transition-colors ${
                    active ? "bg-accent text-black" : "text-white hover:bg-white/5"
                  }`}
                >
                  {item.kind === "team" ? (
                    <>
                      <span className="min-w-0 truncate">
                        {item.team.name}
                        {/* Why a search for "sonics" returned the Thunder. */}
                        {item.team.matchedAs && (
                          <span
                            className={
                              active ? "text-black/60" : "text-white/40"
                            }
                          >
                            {" · "}
                            {item.team.matchedAs}
                          </span>
                        )}
                      </span>
                      <span
                        className={`shrink-0 font-mono text-xs tabular-nums ${
                          active ? "text-black/60" : "text-white/40"
                        }`}
                      >
                        {item.team.abbr}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="truncate">{item.player.name}</span>
                      {careerSpan(
                        item.player.firstSeason,
                        item.player.lastSeason,
                      ) && (
                        <span
                          className={`shrink-0 font-mono text-xs tabular-nums ${
                            active ? "text-black/60" : "text-white/40"
                          }`}
                        >
                          {careerSpan(
                            item.player.firstSeason,
                            item.player.lastSeason,
                          )}
                        </span>
                      )}
                    </>
                  )}
                </button>
              </li>
            );
          })}
          {items.length === 0 && (
            <li className="px-3 py-2 text-sm text-white/40">
              {pending ? "Searching…" : "Nothing found."}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
