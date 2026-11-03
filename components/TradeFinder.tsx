"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { FilterDropdown } from "@/components/FilterDropdown";
import { PlayerHeadshot } from "@/components/PlayerHeadshot";
import { SegmentedControl } from "@/components/SegmentedControl";
import {
  formatCompactCurrency,
  formatCurrency,
  formatScore,
  netValueClass,
} from "@/lib/format";
import {
  TIER_LABEL,
  findTrades,
  tierOf,
  type CapRules,
  type NvpBasis,
  type Trade,
  type TradePlayer,
  type TradeSort,
} from "@/lib/trade";

export interface TradeFinderState {
  player: number | null;
  partner: string | null;
  /** Players the shopped player's team sends, him included. */
  sendCount: number;
  /** Players the other team sends back. */
  getCount: number;
  basis: NvpBasis;
  sort: TradeSort;
}

const PAGE = 25;

/**
 * Links on this page. The site's `sheet-link` underline is dark, made for the
 * light tables; on these dark cards it vanishes, so this one is light.
 */
const LINK =
  "underline decoration-white/30 decoration-1 underline-offset-[3px] transition-colors hover:text-accent hover:decoration-accent";

/** The query string the state round-trips through, defaults left out. */
export function tradeFinderQuery(s: TradeFinderState): string {
  const q = new URLSearchParams();
  if (s.player !== null) q.set("player", String(s.player));
  if (s.partner) q.set("partner", s.partner);
  if (s.sendCount !== 1) q.set("send", String(s.sendCount));
  if (s.getCount !== 1) q.set("get", String(s.getCount));
  if (s.basis !== "prev") q.set("nvp", s.basis);
  if (s.sort !== "salary") q.set("sort", s.sort);
  const qs = q.toString();
  return qs ? `?${qs}` : "";
}

function seasonShort(season: string) {
  return `${season.slice(0, 4)}-${season.slice(7, 9)}`;
}

export function TradeFinder({
  pool,
  payrolls,
  rules,
  teamNames,
  initial,
}: {
  pool: TradePlayer[];
  payrolls: Record<string, number>;
  rules: CapRules;
  teamNames: Record<string, string>;
  initial: TradeFinderState;
}) {
  const [state, setState] = useState(initial);
  const [shown, setShown] = useState(PAGE);
  const set = (patch: Partial<TradeFinderState>) => {
    setState((s) => ({ ...s, ...patch }));
    setShown(PAGE);
  };

  // The URL follows the controls, so a search can be shared or reloaded.
  // replaceState rather than router navigation: everything is already here,
  // and a server round trip per click would only slow it down.
  useEffect(() => {
    const url = `${window.location.pathname}${tradeFinderQuery(state)}`;
    window.history.replaceState(null, "", url);
  }, [state]);

  const anchor = pool.find((p) => p.key === state.player) ?? null;
  const season = rules.season;
  const prevSeason = `${Number(season.slice(0, 4)) - 1}-${season.slice(0, 4)}`;

  const result = useMemo(
    () =>
      anchor && state.partner
        ? findTrades(pool, payrolls, rules, {
            anchor: anchor.key,
            partner: state.partner,
            sendCount: state.sendCount,
            getCount: state.getCount,
            basis: state.basis,
            sort: state.sort,
            limit: 500,
          })
        : null,
    [anchor, pool, payrolls, rules, state],
  );

  const teams = useMemo(
    () =>
      Object.keys(payrolls)
        .filter((t) => t !== anchor?.team)
        .sort(),
    [payrolls, anchor],
  );

  const nvpOf = (p: TradePlayer) => (state.basis === "now" ? p.nvp : p.nvpPrev);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-lg bg-neutral-800 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
          <PlayerPicker
            pool={pool}
            selected={anchor}
            // The partner carries over to the next player, unless he plays
            // for it: a team can't trade with itself.
            onSelect={(p) =>
              set({
                player: p?.key ?? null,
                partner: p && p.team === state.partner ? null : state.partner,
              })
            }
          />
          <FilterDropdown
            label="Trade with"
            value={state.partner ?? ""}
            options={[
              // A prompt until a team is picked, then gone: there's no
              // searching every team at once, which only buried the useful
              // trades under thousands of near-copies.
              ...(state.partner ? [] : [{ value: "", label: "Pick a team" }]),
              ...teams.map((t) => ({ value: t, label: teamNames[t] ?? t })),
            ]}
            onChange={(v) => set({ partner: v || null })}
          />
        </div>
        <div className="flex flex-col gap-3 text-sm md:flex-row md:flex-wrap md:items-center md:gap-x-6">
          <Control label="Net Value from">
            <SegmentedControl
              label="Which season's Net Value to weigh"
              size="md"
              value={state.basis}
              options={[
                { value: "prev", label: seasonShort(prevSeason) },
                { value: "now", label: `${seasonShort(season)} so far` },
              ]}
              onChange={(v) => set({ basis: v })}
            />
          </Control>
          <Control label="Sort by" stack>
            <SegmentedControl
              label="Order trades by"
              size="md"
              fill
              value={state.sort}
              options={[
                { value: "salary", label: "Salary Match" },
                { value: "fair", label: "Net Value Match" },
              ]}
              onChange={(v) => set({ sort: v })}
            />
          </Control>
        </div>
      </div>

      {!anchor || !state.partner ? (
        <p className="text-base text-white/70">
          {!anchor
            ? "Pick a player and a team to trade with to see every trade both teams' payrolls allow."
            : `Pick a team to trade ${anchor.name} to.`}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Always in the same place, with or without trades, so the toggles
              under it don't jump as the count comes and goes. Two lines are
              held on a phone, where a long team name wraps the count. */}
          {result && (
            <p className="min-h-12 text-base text-white/70 md:min-h-0">
              {result.total === 0
                ? `No legal trades with ${teamNames[state.partner] ?? state.partner}.`
                : `${result.total.toLocaleString("en-US")} legal ${
                    result.total === 1 ? "trade" : "trades"
                  } with ${teamNames[state.partner] ?? state.partner}${
                    result.total > result.trades.length
                      ? `, the top ${result.trades.length} shown`
                      : ""
                  }.`}
            </p>
          )}
          {/* Each side's size is set above that side's column of cards, so
              the control sits over what it changes. */}
          <div className="grid grid-cols-1 divide-y divide-white/10 rounded-lg bg-neutral-800 md:grid-cols-2 md:divide-x md:divide-y-0">
            <SideHeader
              team={anchor.team}
              count={state.sendCount}
              onChange={(n) => set({ sendCount: n })}
            />
            <SideHeader
              team={state.partner}
              count={state.getCount}
              onChange={(n) => set({ getCount: n })}
            />
          </div>
          {result && result.total > 0 && (
            <>
              {result.trades.slice(0, shown).map((t) => (
                <TradeCard
                  key={tradeKey(t)}
                  trade={t}
                  home={anchor.team}
                  payrolls={payrolls}
                  rules={rules}
                  nvpOf={nvpOf}
                />
              ))}
              {shown < result.trades.length && (
                <button
                  type="button"
                  onClick={() => setShown((n) => n + PAGE)}
                  className="self-start rounded-md border border-white/20 bg-white/5 px-3 py-1.5 text-sm transition-colors hover:border-white/40"
                >
                  Show more
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function tradeKey(t: Trade) {
  return `${t.partner}:${t.sent.map((p) => p.key).join(",")}:${t.received
    .map((p) => p.key)
    .join(",")}`;
}

/**
 * The head of one column of trade cards: "BOS sends [1 2 3] players", set
 * right above the cards it changes. Both sides share one bar, split down the
 * same line as the cards below it.
 */
function SideHeader({
  team,
  count,
  onChange,
  note,
}: {
  team: string;
  count: number;
  onChange: (n: number) => void;
  /** Under the line, e.g. who the shopped player's side always includes. */
  note?: string;
}) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2 text-lg [&_button]:whitespace-nowrap">
        <span className="font-semibold">{team} sends</span>
        <SegmentedControl
          label={`How many players ${team} sends`}
          size="md"
          value={String(count) as "1" | "2" | "3"}
          options={[
            { value: "1", label: "1" },
            { value: "2", label: "2" },
            { value: "3", label: "3" },
          ]}
          onChange={(v) => onChange(Number(v))}
        />
        <span className="font-semibold">
          {count === 1 ? "player" : "players"}
        </span>
      </div>
      {note && <span className="text-sm text-white/60">{note}</span>}
    </div>
  );
}

function Control({
  label,
  stack = false,
  children,
}: {
  label: string;
  /** Put the control under its label on a phone, for one too wide to share a line. */
  stack?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex gap-3 md:flex-row md:items-center md:justify-start md:gap-3 ${
        stack ? "flex-col gap-1.5" : "items-center justify-between"
      }`}
    >
      <span className="whitespace-nowrap text-white/70">{label}</span>
      {/* Labels never wrap: a stretched control on a phone, and on a wide
          screen one sized to them rather than squeezed by the row. */}
      <div
        className={`[&_button]:whitespace-nowrap ${stack ? "w-full md:w-auto" : ""}`}
      >
        {children}
      </div>
    </div>
  );
}

/** A type-ahead over the trade pool: only players who can be dealt. */
function PlayerPicker({
  pool,
  selected,
  onSelect,
}: {
  pool: TradePlayer[];
  selected: TradePlayer | null;
  onSelect: (p: TradePlayer | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return [];
    return pool
      .filter((p) => fold(p.name).includes(q) || p.team.toLowerCase() === q)
      .slice(0, 8);
  }, [pool, query]);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const pick = (p: TradePlayer) => {
    onSelect(p);
    setQuery("");
    setOpen(false);
  };

  if (selected) {
    return (
      <div className="flex w-full items-center justify-between gap-2 rounded-md bg-background-box p-2 text-sm md:w-auto">
        <span className="text-white/70">Player</span>
        <div className="flex min-w-0 items-center gap-2 rounded-md border border-white/20 bg-white/5 py-1 pl-2.5 pr-1 md:min-w-56">
          <span className="min-w-0 flex-1 truncate">{selected.name}</span>
          <button
            type="button"
            onClick={() => {
              onSelect(null);
              requestAnimationFrame(() => inputRef.current?.focus());
            }}
            aria-label={`Change player from ${selected.name}`}
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
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className="relative flex w-full items-center justify-between gap-2 rounded-md bg-background-box p-2 text-sm md:w-auto"
    >
      <label htmlFor={`${listId}-input`} className="text-white/70">
        Player
      </label>
      <input
        id={`${listId}-input`}
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open && matches.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder="Search this season's rosters"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, matches.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter" && matches[active]) {
            e.preventDefault();
            pick(matches[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className="min-w-0 flex-1 rounded-md border border-white/20 bg-white/5 px-2.5 py-1 text-white placeholder:text-white/40 transition-colors hover:border-white/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:w-64 md:flex-none"
      />
      {open && matches.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-md border border-white/15 bg-neutral-900 py-1 shadow-lg"
        >
          {matches.map((p, i) => (
            <li
              key={p.key}
              role="option"
              aria-selected={i === active}
              onPointerDown={(e) => {
                e.preventDefault();
                pick(p);
              }}
              onPointerEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-1.5 ${
                i === active ? "bg-white/10" : ""
              }`}
            >
              <span className="truncate">{p.name}</span>
              <span className="shrink-0 font-mono text-xs tabular-nums text-white/60">
                {p.team} · {formatCompactCurrency(p.capHit)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Case and accent insensitive, so "jokic" finds Jokić. */
function fold(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function TradeCard({
  trade,
  home,
  payrolls,
  rules,
  nvpOf,
}: {
  trade: Trade;
  home: string;
  payrolls: Record<string, number>;
  rules: CapRules;
  nvpOf: (p: TradePlayer) => number | null;
}) {
  const homeAfter =
    (payrolls[home] ?? 0) - trade.sentSalary + trade.receivedSalary;
  const awayAfter =
    (payrolls[trade.partner] ?? 0) - trade.receivedSalary + trade.sentSalary;
  return (
    <div className="rounded-lg border border-white/10 bg-background-box">
      <div className="grid grid-cols-1 divide-y divide-white/10 md:grid-cols-2 md:divide-x md:divide-y-0">
        <TradeSide
          team={home}
          players={trade.sent}
          salary={trade.sentSalary}
          salaryChange={trade.receivedSalary - trade.sentSalary}
          nvpChange={trade.nvpGain}
          payrollAfter={homeAfter}
          rules={rules}
          nvpOf={nvpOf}
        />
        <TradeSide
          team={trade.partner}
          players={trade.received}
          salary={trade.receivedSalary}
          salaryChange={trade.sentSalary - trade.receivedSalary}
          nvpChange={-trade.nvpGain}
          payrollAfter={awayAfter}
          rules={rules}
          nvpOf={nvpOf}
        />
      </div>
    </div>
  );
}

/** A signed dollar change: +$1,000, −$1,000, $0. */
function formatChange(value: number) {
  if (value === 0) return "$0";
  return `${value > 0 ? "+" : "\u2212"}${formatCurrency(Math.abs(value))}`;
}

function TradeSide({
  team,
  players,
  salary,
  salaryChange,
  nvpChange,
  payrollAfter,
  rules,
  nvpOf,
}: {
  team: string;
  players: TradePlayer[];
  salary: number;
  /** What the team takes back minus what it sends: its side of the deal. */
  salaryChange: number;
  nvpChange: number;
  payrollAfter: number;
  rules: CapRules;
  nvpOf: (p: TradePlayer) => number | null;
}) {
  const values = players.map(nvpOf);
  const known = values.filter((v): v is number => v !== null);
  const nvpTotal = known.length > 0 ? known.reduce((a, b) => a + b, 0) : null;
  // Light rules between the columns; the figures' columns stay tight so the
  // name keeps what room there is on a phone.
  const num =
    "border-l border-white/10 px-2 text-right font-mono tabular-nums md:px-3";

  return (
    <div className="flex flex-col gap-2 p-4">
      <span className="text-lg font-semibold">{team} sends</span>
      {/* Fixed figure columns, so they line up from one card to the next
          instead of each table sizing them to its own numbers. */}
      <table className="w-full table-fixed border-collapse text-sm md:text-base">
        <thead>
          <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-white/50 md:text-sm md:normal-case md:tracking-normal">
            <th scope="col" className="pb-1.5 pr-2 text-left font-normal">
              Player
            </th>
            <th
              scope="col"
              className={`${num} w-28 pb-1.5 font-sans font-normal md:w-36`}
            >
              Salary
            </th>
            <th
              scope="col"
              className={`${num} w-16 pb-1.5 pr-0 font-sans font-normal md:w-24 md:pr-0`}
            >
              Net Value
            </th>
          </tr>
        </thead>
        <tbody>
          {players.map((p, i) => (
            <tr key={p.key}>
              <td className="py-2 pr-2">
                <div className="flex items-center gap-2.5 md:gap-3">
                  <span className="md:hidden">
                    <PlayerHeadshot
                      nbaPersonId={p.nbaPersonId}
                      name={p.name}
                      height={44}
                    />
                  </span>
                  <span className="hidden md:block">
                    <PlayerHeadshot
                      nbaPersonId={p.nbaPersonId}
                      name={p.name}
                      height={60}
                    />
                  </span>
                  {/* Wraps rather than truncates: a long name on a phone
                      takes two lines instead of losing its end. */}
                  <span className="min-w-0">
                    {p.playerId ? (
                      <Link href={`/players/${p.playerId}`} className={LINK}>
                        {p.name}
                      </Link>
                    ) : (
                      p.name
                    )}
                    {p.pos && <span className="text-white/50"> {p.pos}</span>}
                  </span>
                </div>
              </td>
              <td className={`${num} py-2 text-white/80`}>
                {formatCurrency(p.capHit)}
              </td>
              <td
                className={`${num} py-2 pr-0 md:pr-0 ${netValueClass(values[i])}`}
              >
                {formatScore(values[i])}
              </td>
            </tr>
          ))}
        </tbody>
        {/* A lone player's row is already the total. */}
        {players.length > 1 && (
          <tfoot>
            <tr className="border-t border-white/10 font-semibold">
              <th scope="row" className="pt-2 pr-2 text-left">
                Total
              </th>
              <td className={`${num} pt-2`}>{formatCurrency(salary)}</td>
              <td
                className={`${num} pt-2 pr-0 md:pr-0 ${netValueClass(nvpTotal)}`}
              >
                {formatScore(nvpTotal)}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
      {/* What the deal does to this team, both ways: what it gets back
          against what it gives up. */}
      <div className="mt-auto flex flex-col gap-1.5 rounded-md bg-white/5 px-3 py-2.5 text-sm md:text-base">
        <span className="text-xs font-semibold uppercase tracking-wide text-white/50">
          For {team}
        </span>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-white/60">Net Value change</dt>
          <dd
            className={`text-right font-mono tabular-nums ${netValueClass(nvpChange)}`}
          >
            {formatScore(nvpChange)}
          </dd>
          <dt className="text-white/60">Salary change</dt>
          <dd className="text-right font-mono tabular-nums">
            {formatChange(salaryChange)}
          </dd>
          <dt className="text-white/60">Payroll after</dt>
          <dd className="text-right">
            <span className="font-mono tabular-nums">
              {formatCurrency(payrollAfter)}
            </span>
            <span className="block text-sm text-white/50">
              {TIER_LABEL[tierOf(payrollAfter, rules)]}
            </span>
          </dd>
        </dl>
      </div>
    </div>
  );
}
