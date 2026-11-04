"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { FilterDropdown } from "@/components/FilterDropdown";
import { Modal } from "@/components/Modal";
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
  type Tier,
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

/*
 * FIELD: from md the player field and the team button share one fixed width.
 * The longest team name, "Minnesota Timberwolves", is 159px in the 14px UI
 * font, and the button's padding, gap, arrow, and border add about 50px, so
 * 209px at least. A longer player name truncates inside it.
 * - md to 900px: w-60 (240px), the width of the toggles under them.
 * - From 900px: w-54 (216px), so both fit on one row beside the photo at
 *   900px, where 240 each wrapped them onto two.
 *
 * From md to 900px every control sits on its own line, so they're lined up as
 * a form: an 8px inset (the field boxes' padding, matched on the toggles), a
 * w-28 label column, an 8px gap, and the field or toggle at w-60, 376px in
 * all. The ranges are kept apart (md:max-[900px] against min-[900px]) rather
 * than overriding one another, since Tailwind doesn't order a compound
 * variant against a plain one the way the widths would suggest.
 */

/** A fresh search: what the bare /trade-finder route opens with. */
export const TRADE_FINDER_DEFAULTS: TradeFinderState = {
  player: null,
  partner: null,
  sendCount: 1,
  getCount: 1,
  basis: "prev",
  sort: "salary",
};

/** Every Net Value on this page sits on a dark card. */
const DARK = { onDark: true };

/**
 * Links on this page. The site's `sheet-link` underline is dark, made for the
 * light tables; on these dark cards it vanishes, so this one is light.
 */
const LINK =
  "underline decoration-white/30 decoration-1 underline-offset-[3px] transition-colors hover:text-accent hover:decoration-accent";

/** The query string the state round-trips through, defaults left out. */
export function tradeFinderQuery(s: TradeFinderState): string {
  const d = TRADE_FINDER_DEFAULTS;
  const q = new URLSearchParams();
  if (s.player !== null) q.set("player", String(s.player));
  if (s.partner) q.set("partner", s.partner);
  if (s.sendCount !== d.sendCount) q.set("send", String(s.sendCount));
  if (s.getCount !== d.getCount) q.set("get", String(s.getCount));
  if (s.basis !== d.basis) q.set("nvp", s.basis);
  if (s.sort !== d.sort) q.set("sort", s.sort);
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

  // Reset shows once anything differs from a fresh search: the query string
  // is empty exactly when every control is at its default.
  const isDefault = tradeFinderQuery(state) === "";

  const nvpOf = (p: TradePlayer) => (state.basis === "now" ? p.nvp : p.nvpPrev);

  return (
    <>
      {/* The page's heading row, drawn here rather than by the page so Reset
          can sit beside the title: it needs the search state, which lives in
          this component. Same spacing and height as PageHeader, so the form
          lands where the loading screen left it. Unlike PageHeader the row
          never stacks: Reset is small enough to stay beside the title on a
          phone. */}
      <div className="mb-4 flex items-center gap-4 md:min-h-11.5">
        <h1 className="min-w-0 text-2xl font-semibold tracking-tight">
          Trade Finder
        </h1>
        {!isDefault && (
          <button
            type="button"
            onClick={() => set(TRADE_FINDER_DEFAULTS)}
            className="cursor-pointer rounded-md border border-white/20 bg-white/5 px-3 py-1 text-sm text-white/80 transition-colors hover:border-accent hover:text-accent"
          >
            Reset
          </button>
        )}
      </div>
      <div className="flex flex-col gap-6">
        <div
          className={`relative flex flex-col gap-3 rounded-lg bg-neutral-800 p-4 ${
            anchor
              ? "min-[500px]:max-md:pr-[calc(40%+1rem)] md:max-[900px]:pr-[calc(26%+1rem)] min-[900px]:pr-48"
              : ""
          }`}
        >
          {/* The picked player, the form's full height against its right
            edge. Clipped to the card's corners itself, not by the card: the
            card can't hide overflow, or it cuts off the dropdowns. Pinned
            out of the flow so the photo takes the form's height rather than
            setting it; the padding above keeps the controls clear of it. From
            900px the form is two short rows and the photo keeps its own shape. Narrower, the controls stack and the form
            grows tall, so the photo takes a fixed share of the width instead,
            40% below md so it reads as a portrait rather than a sliver, and
            crops in to his face. Percent padding and a percent width both
            measure the form's width, so the two stay matched. Under 500px
            the column left beside it is too thin for the controls, so the
            photo is left out and the form keeps its plain phone layout. */}
          {anchor && (
            <div className="pointer-events-none absolute inset-y-0 right-0 hidden overflow-hidden rounded-r-lg min-[500px]:block min-[500px]:max-md:w-[40%] md:max-[900px]:w-[26%] min-[900px]:w-auto min-[900px]:aspect-260/190">
              {anchor.nbaPersonId !== null && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={anchor.key}
                  src={`https://cdn.nba.com/headshots/nba/latest/1040x760/${anchor.nbaPersonId}.png`}
                  alt={`${anchor.name} headshot`}
                  className="h-full w-full object-cover object-top"
                />
              )}
            </div>
          )}
          <div className="flex flex-col gap-3 md:max-[900px]:items-start min-[900px]:flex-row min-[900px]:flex-wrap min-[900px]:items-center">
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
              // Beside the photo a small screen's column is too narrow for label
              // and control on one line, so the label goes on top. From md the
              // button is FIELD wide, and up to 900px its label takes the
              // shared label column; see FIELD.
              className={`md:max-[900px]:[&>button]:w-60 min-[900px]:[&>button]:w-54 md:max-[900px]:justify-start md:max-[900px]:[&>span]:w-28 md:max-[900px]:[&>span]:shrink-0 ${
                anchor
                  ? "min-[500px]:max-md:flex-col min-[500px]:max-md:items-stretch min-[500px]:max-md:gap-1.5"
                  : ""
              }`}
            />
          </div>
          <div className="flex flex-col gap-3 text-sm md:max-[900px]:items-start min-[900px]:flex-row min-[900px]:flex-wrap min-[900px]:items-center min-[900px]:gap-x-6">
            <Control label="Net Value from" stack besidePhoto={anchor !== null}>
              <SegmentedControl
                label="Which season's Net Value to weigh"
                size="md"
                fill
                value={state.basis}
                options={[
                  { value: "prev", label: seasonShort(prevSeason) },
                  { value: "now", label: `${seasonShort(season)} so far` },
                ]}
                onChange={(v) => set({ basis: v })}
              />
            </Control>
            <Control label="Sort by" stack besidePhoto={anchor !== null}>
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
          <div className="flex flex-col gap-4">
            {/* Each side's size is set a row per team, in the same order as
              the players on the cards below. The count of legal
              trades closes the same card, so it reads as the answer to the
              choices above it rather than changing ahead of them. */}
            <div className="rounded-lg bg-neutral-800">
              <div className="grid grid-cols-1 divide-y divide-white/10">
                <SideHeader
                  team={anchor.team}
                  count={state.sendCount}
                  onChange={(n) => set({ sendCount: n })}
                  payroll={payrolls[anchor.team] ?? 0}
                  tier={tierOf(payrolls[anchor.team] ?? 0, rules)}
                />
                <SideHeader
                  team={state.partner}
                  count={state.getCount}
                  onChange={(n) => set({ getCount: n })}
                  payroll={payrolls[state.partner] ?? 0}
                  tier={tierOf(payrolls[state.partner] ?? 0, rules)}
                />
              </div>
              <div className="flex flex-col items-start gap-1.5 border-t sm:flex-row sm:justify-between sm:gap-3 border-white/10 px-4 py-3">
                {result && (
                  <p aria-live="polite" className="text-base text-white/70">
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
                <CapKey rules={rules} />
              </div>
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
    </>
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
  payroll,
  tier,
}: {
  team: string;
  count: number;
  onChange: (n: number) => void;
  /** The team's payroll today, before any trade. */
  payroll: number;
  /** Where that payroll sits against the cap. */
  tier: Tier;
}) {
  return (
    // One team a row, as the trade cards stack them. From md today's cap
    // status shares the line, set at a fixed distance so both teams' line up.
    <div className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:gap-6">
      <div className="flex flex-wrap items-center gap-2 text-lg max-[370px]:text-base max-[340px]:gap-1.5 max-[340px]:text-sm max-[340px]:[&_[role=group]_button]:px-1.5 md:w-72 md:shrink-0 [&_button]:whitespace-nowrap">
        {/* A fixed width, so the 1/2/3 control starts at the same place for
            every team: "MEM sends", the widest, is 100px in this face, 89px at
            the 16px used under 370px, where 18px wrapped "players" onto a
            second line. */}
        <span className="w-26 shrink-0 font-semibold max-[370px]:w-23 max-[340px]:w-20">
          {team} sends
        </span>
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
      {/* Today's payroll and status here, once per team; each card below
          shows where that deal leaves them. Both at fixed widths, the
          longest each can be ("$999,999,999" is 192px, "Over 2nd apron"
          226px), so the status drops under the payroll at the same width
          for both teams whatever their figures. */}
      <span className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-white/60">
        <span className="w-50 whitespace-nowrap">
          Current payroll:{" "}
          <span className="font-mono tabular-nums text-white/80">
            {formatCurrency(payroll)}
          </span>
        </span>
        <span className="w-58 whitespace-nowrap">
          Current cap status:{" "}
          <span className={TIER_TEXT[tier]}>{TIER_LABEL[tier]}</span>
        </span>
      </span>
    </div>
  );
}

function Control({
  label,
  stack = false,
  besidePhoto = false,
  children,
}: {
  label: string;
  /** Put the control under its label on a phone, for one too wide to share a line. */
  stack?: boolean;
  /**
   * In the narrow column beside the player's photo, 500px up to md: the
   * label always goes on top. A stacked control stays stretched there, the
   * width of the player and team fields above it.
   */
  besidePhoto?: boolean;
  children: React.ReactNode;
}) {
  const beside = !besidePhoto
    ? ""
    : stack
      ? ""
      : "min-[500px]:max-md:flex-col min-[500px]:max-md:items-stretch min-[500px]:max-md:justify-start min-[500px]:max-md:gap-1.5";
  return (
    <div
      className={`flex gap-3 md:flex-row md:items-center md:justify-start min-[900px]:gap-3 md:max-[900px]:gap-2 md:max-[900px]:px-2 ${
        stack ? "flex-col gap-1.5" : "items-center justify-between"
      } ${beside}`}
    >
      <span className="shrink-0 md:max-[900px]:w-28 whitespace-nowrap text-white/70">
        {label}
      </span>
      {/* Labels never wrap: a stretched control on a phone, and on a wide
          screen one sized to them rather than squeezed by the row. */}
      <div
        className={`[&_button]:whitespace-nowrap ${stack ? "w-full md:max-[900px]:w-60 min-[900px]:w-auto" : ""}`}
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
      <div className="flex w-full items-center justify-between gap-2 rounded-md bg-background-box p-2 text-sm min-[500px]:max-md:flex-col min-[500px]:max-md:items-stretch min-[500px]:max-md:gap-1.5 md:w-auto md:max-[900px]:justify-start">
        <span className="shrink-0 md:max-[900px]:w-28 text-white/70">
          Player
        </span>
        <div className="flex min-w-0 items-center gap-2 rounded-md border border-white/20 bg-white/5 py-1 pl-2.5 pr-1 md:max-[900px]:w-60 min-[900px]:w-54">
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
      className="relative flex w-full items-center justify-between gap-2 rounded-md bg-background-box p-2 text-sm md:w-auto md:max-[900px]:justify-start"
    >
      <label
        htmlFor={`${listId}-input`}
        className="shrink-0 md:max-[900px]:w-28 text-white/70"
      >
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
        className="min-w-0 flex-1 rounded-md border border-white/20 bg-white/5 px-2.5 py-1 text-white placeholder:text-white/40 transition-colors hover:border-white/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:max-[900px]:w-60 min-[900px]:w-54 md:flex-none"
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
  // Each team's figures: what its side sends, then what the deal changes for
  // it. A team's change is what it takes back minus what it sends.
  const sides = [
    {
      team: home,
      salarySent: trade.sentSalary,
      nvpSent: nvpSum(trade.sent, nvpOf),
      salaryChange: trade.receivedSalary - trade.sentSalary,
      nvpChange: trade.nvpGain,
      payrollAfter: homeAfter,
      tier: tierOf(homeAfter, rules),
    },
    {
      team: trade.partner,
      salarySent: trade.receivedSalary,
      nvpSent: nvpSum(trade.received, nvpOf),
      salaryChange: trade.sentSalary - trade.receivedSalary,
      nvpChange: -trade.nvpGain,
      payrollAfter: awayAfter,
      tier: tierOf(awayAfter, rules),
    },
  ];
  // The rows of the deal, a cell per team, for both layouts below.
  const rows: {
    label: string;
    /** Words rather than figures: set in the text face, not monospace. */
    text?: boolean;
    cells: { text: string; tone: string }[];
  }[] = [
    {
      label: "Salary sent",
      cells: sides.map((s) => ({
        text: formatCurrency(s.salarySent),
        tone: "",
      })),
    },
    {
      label: "Salary change",
      cells: sides.map((s) => ({
        text: formatChange(s.salaryChange),
        tone: "",
      })),
    },
    {
      label: "Payroll after trade",
      cells: sides.map((s) => ({
        text: formatCurrency(s.payrollAfter),
        tone: "",
      })),
    },
    {
      // Today's status is in the side headers above, so this one says
      // it's after the trade.
      label: "Cap status after trade",
      text: true,
      cells: sides.map((s) => ({
        text: TIER_LABEL[s.tier],
        tone: TIER_TEXT[s.tier],
      })),
    },
    {
      // How far the payroll after the trade sits under the next line up,
      // the one past the status above. Past the second apron there's none.
      label: "Room to next tier",
      cells: sides.map((s) => {
        const room = roomToNextTier(s.payrollAfter, rules);
        return {
          text: room === null ? "\u2014" : formatCurrency(room),
          tone: "",
        };
      }),
    },
    {
      label: "Net Value sent",
      cells: sides.map((s) => ({
        text: formatScore(s.nvpSent),
        tone: netValueClass(s.nvpSent, DARK),
      })),
    },
    {
      label: "Net Value change",
      cells: sides.map((s) => ({
        text: formatScore(s.nvpChange),
        tone: netValueClass(s.nvpChange, DARK),
      })),
    },
  ];
  return (
    // One team's players always over the other's. From lg the comparison sits
    // to their right; narrower, there isn't room beside it, so it goes under,
    // and the card keeps to 680px so a wide tablet doesn't stretch it.
    <div className="max-w-170 rounded-lg border border-white/10 bg-background-box lg:grid lg:max-w-none lg:grid-cols-[minmax(0,1fr)_auto]">
      <div className="grid grid-cols-1 divide-y divide-white/10">
        <TradeSide team={home} players={trade.sent} nvpOf={nvpOf} />
        <TradeSide
          team={trade.partner}
          players={trade.received}
          nvpOf={nvpOf}
        />
      </div>
      {/* The deal for both teams together, a column each, so the two can be
          read across instead of hunted for in two boxes. */}
      <div className="px-4 pb-4 lg:border-l lg:border-white/10 lg:p-4">
        {/* Under 500px: too narrow for label and two figures on one line,
            so each team gets a column, split down the middle, with every
            figure under its own label. The labels repeat, but each figure
            sits level with the other team's, so they still read across. */}
        <div className="grid grid-cols-2 divide-x divide-white/10 rounded-md bg-white/5 py-2.5 text-sm min-[500px]:hidden">
          {sides.map((s, i) => (
            <div
              key={s.team}
              className="flex min-w-0 flex-col gap-2 px-3 max-[380px]:px-2 max-[380px]:[&_dd]:text-[13px]"
            >
              <h4 className="text-xs font-semibold uppercase tracking-wide text-white/50">
                {s.team}
              </h4>
              <dl className="flex flex-col gap-2">
                {rows.map((r) => (
                  <div key={r.label}>
                    <dt className="text-xs text-white/60">{r.label}</dt>
                    <dd
                      className={`whitespace-nowrap ${r.text ? "" : "font-mono tabular-nums"} ${r.cells[i].tone}`}
                    >
                      {r.cells[i].text}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
        {/* From 500px, where the salary column also starts: a table. Under the players
            it spans the card, which is held to 680px, so the labels stay near
            their figures. From lg, beside the players, every column has a
            fixed width so it lines up from one card to the next. */}
        <div className="hidden w-full rounded-md bg-white/5 pr-3 min-[500px]:block lg:w-fit">
          <table className="w-full table-fixed border-collapse text-sm xl:text-base lg:w-auto">
            <thead>
              <tr className="text-xs font-semibold uppercase tracking-wide text-white/50">
                <th scope="col" className="px-3 lg:w-52 pt-2.5 pb-1 text-left">
                  <span className="sr-only">Figure</span>
                </th>
                {sides.map((s) => (
                  <th
                    key={s.team}
                    scope="col"
                    className="w-28 pt-2.5 pb-1 pl-2 text-right sm:w-32 sm:pl-3 xl:w-36"
                  >
                    {s.team}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="[&:last-child>*]:pb-2.5">
                  <th
                    scope="row"
                    className="px-3 py-0.5 text-left font-normal text-white/60"
                  >
                    {r.label}
                  </th>
                  {r.cells.map((c, i) => (
                    <td
                      key={sides[i].team}
                      className={`whitespace-nowrap py-0.5 pl-2 text-right sm:pl-3 ${r.text ? "" : "font-mono tabular-nums"} ${c.tone}`}
                    >
                      {c.text}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TradeVerdict trade={trade} home={home} />
      </div>
    </div>
  );
}

/**
 * How far a payroll sits under the next cap line above it: the cap, the
 * tax, or an apron. Null past the second apron, with no line left.
 */
function roomToNextTier(payroll: number, r: CapRules): number | null {
  const next = [r.cap, r.tax, r.firstApron, r.secondApron].find(
    (line) => payroll <= line,
  );
  return next === undefined ? null : next - payroll;
}

/**
 * The card's takeaway in a line: who comes out ahead on Net Value, by how
 * much, and what it does to that team's salary. "LAC wins by 4.22 NVP and
 * takes on $775."
 */
function TradeVerdict({ trade, home }: { trade: Trade; home: string }) {
  const gain = trade.nvpGain;
  // Under half a hundredth, which shows as 0.00, is a wash.
  if (Math.abs(gain) < 0.005) {
    return (
      <p className="mt-3 text-sm text-white/70">
        Even on Net Value: neither team comes out ahead.
      </p>
    );
  }
  const homeWins = gain > 0;
  const winner = homeWins ? home : trade.partner;
  // What the winner takes back minus what it sends.
  const salary = homeWins
    ? trade.receivedSalary - trade.sentSalary
    : trade.sentSalary - trade.receivedSalary;
  const money =
    salary > 0
      ? `takes on ${formatCurrency(salary)}`
      : salary < 0
        ? `saves ${formatCurrency(-salary)}`
        : "keeps its payroll even";
  return (
    <p className="mt-3 text-sm text-white/70">
      <span className="font-semibold text-white">{winner}</span> wins this trade by{" "}
      <span className="font-mono tabular-nums text-green-400">
        {Math.abs(gain).toFixed(2)} NVP
      </span>{" "}
      and {money} in salary.
    </p>
  );
}

/** A side's summed Net Value, or null when none of its players has one. */
function nvpSum(
  players: TradePlayer[],
  nvpOf: (p: TradePlayer) => number | null,
): number | null {
  const known = players.map(nvpOf).filter((v): v is number => v !== null);
  return known.length > 0 ? known.reduce((a, b) => a + b, 0) : null;
}

/** A signed dollar change: +$1,000, −$1,000, $0. */
function formatChange(value: number) {
  if (value === 0) return "$0";
  return `${value > 0 ? "+" : "\u2212"}${formatCurrency(Math.abs(value))}`;
}

function TradeSide({
  team,
  players,
  nvpOf,
}: {
  team: string;
  players: TradePlayer[];
  nvpOf: (p: TradePlayer) => number | null;
}) {
  const values = players.map(nvpOf);
  // The figures' columns stay tight so the name keeps what room there is;
  // alignment does the work column rules used to. A Salary column at full
  // dollars needs the side about 420px wide, which it is from 500px. On a
  // phone, about 310px, the salary goes under the player's name instead,
  // whole. Both sides' totals are in the comparison.
  const num = "pl-2 text-right font-mono tabular-nums xl:pl-4";

  return (
    <div className="flex flex-col gap-3 p-4">
      {/* Fixed figure columns, so they line up from one card to the next
          instead of each table sizing them to its own numbers. The team's
          name heads the player column, so the card needs no title of its own. */}
      <table className="w-full table-fixed border-collapse text-sm xl:text-base">
        <thead>
          <tr className="text-xs text-white/50 xl:text-sm">
            <th
              scope="col"
              className="pb-1 pr-2 text-left text-base font-semibold text-white xl:text-lg"
            >
              {team} sends
            </th>
            <th
              scope="col"
              className={`${num} hidden w-28 pb-1 font-sans font-normal min-[500px]:table-cell xl:w-32`}
            >
              Salary
            </th>
            <th
              scope="col"
              className={`${num} w-14 pb-1 font-sans font-normal xl:w-24`}
            >
              <span className="xl:hidden">NVP</span>
              <span className="hidden xl:inline">Net Value</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {players.map((p, i) => (
            <tr key={p.key}>
              <td className="py-1.5 pr-2">
                <div className="flex items-center gap-2.5 xl:gap-3">
                  <span className="xl:hidden">
                    <PlayerHeadshot
                      nbaPersonId={p.nbaPersonId}
                      name={p.name}
                      height={40}
                    />
                  </span>
                  <span className="hidden xl:block">
                    <PlayerHeadshot
                      nbaPersonId={p.nbaPersonId}
                      name={p.name}
                      height={52}
                    />
                  </span>
                  {/* Wraps rather than truncates: a long name on a phone
                      takes two lines instead of losing its end. */}
                  <span className="flex min-w-0 flex-col leading-snug">
                    <span>
                      {p.playerId ? (
                        <Link href={`/players/${p.playerId}`} className={LINK}>
                          {p.name}
                        </Link>
                      ) : (
                        p.name
                      )}
                    </span>
                    <span className="font-mono text-xs tabular-nums text-white/80 min-[500px]:hidden">
                      {formatCurrency(p.capHit)}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-white/50 xl:text-sm">
                      {[p.pos, contractYears(p)].filter(Boolean).join(" · ")}
                      <OptionPill option={p.finalOption} />
                    </span>
                  </span>
                </div>
              </td>
              <td
                className={`${num} hidden py-1.5 text-white/80 min-[500px]:table-cell`}
              >
                {formatCurrency(p.capHit)}
              </td>
              <td className={`${num} py-1.5 ${netValueClass(values[i], DARK)}`}>
                {formatScore(values[i])}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * A "Cap key" button and the modal it opens: each cap status in order, least
 * restricted first, with the payroll it starts at and what a team finishing
 * there can do in a trade, as the finder judges it.
 */
function CapKey({ rules }: { rules: CapRules }) {
  const [open, setOpen] = useState(false);
  const m = (n: number) => formatCompactCurrency(n);
  const steps: { tier: Tier; range: string; note: string }[] = [
    {
      tier: "room",
      range: `${m(rules.cap)} or less`,
      note: "Can take back any salary that keeps it under the cap.",
    },
    {
      tier: "cap",
      range: `Over ${m(rules.cap)}`,
      note: `Can take back more salary than it sends, within limits: up to 200% plus ${m(rules.cushion)} on small salaries, plus ${m(rules.smallBand)} in the middle, and 125% plus ${m(rules.cushion)} above ${m(rules.largeBand)}.`,
    },
    {
      tier: "tax",
      range: `Over ${m(rules.tax)}`,
      note: "Pays luxury tax on what's above the line. Trades work as they do over the cap.",
    },
    {
      tier: "first",
      range: `Over ${m(rules.firstApron)}`,
      note: "Can't take back more salary than it sends.",
    },
    {
      tier: "second",
      range: `Over ${m(rules.secondApron)}`,
      note: "Can't take back more than it sends, and can't combine players' salaries to take back one bigger contract.",
    },
  ];
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 cursor-pointer whitespace-nowrap text-sm text-white/70 underline decoration-white/30 underline-offset-[3px] transition-colors hover:text-accent hover:decoration-accent"
      >
        Cap key
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Cap status">
        <p className="mt-2 text-sm text-white/70">
          Where a team&apos;s {seasonShort(rules.season)} payroll sits, from
          least to most restricted. Each trade card shows where the deal leaves
          each team.
        </p>
        <ol className="mt-4 flex flex-col gap-3">
          {steps.map(({ tier, range, note }) => (
            <li key={tier} className="flex flex-col gap-0.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className={`font-semibold ${TIER_TEXT[tier]}`}>
                  {TIER_LABEL[tier]}
                </span>
                <span className="font-mono text-sm tabular-nums text-white/60">
                  {range}
                </span>
              </div>
              <span className="text-sm text-white/60">{note}</span>
            </li>
          ))}
        </ol>
      </Modal>
    </>
  );
}

/** The cap tier's text color, louder the more it restricts the team. */
const TIER_TEXT: Record<Tier, string> = {
  room: "text-white/70",
  cap: "text-white/70",
  tax: "text-amber-300",
  first: "text-orange-300",
  second: "text-red-300",
};

/** "3 yrs left" or "1 yr left"; null when bref has no contract years for him. */
function contractYears(p: TradePlayer): string | null {
  if (p.yearsLeft === null) return null;
  const n = p.yearsLeft;
  return `${n} ${n === 1 ? "yr" : "yrs"} left`;
}

/** PO or TO when the contract's last year is a player or team option. */
function OptionPill({ option }: { option: string | null }) {
  if (option !== "player" && option !== "team") return null;
  return (
    <span
      title={`Final year is a ${option} option`}
      className="rounded-full border border-white/20 px-1.5 text-[0.65rem] leading-4 font-medium tracking-wide text-white/60 xl:text-xs xl:leading-4"
    >
      {option === "player" ? "PO" : "TO"}
    </span>
  );
}
