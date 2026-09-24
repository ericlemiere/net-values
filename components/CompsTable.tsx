"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatScore } from "@/lib/format";
import { describe } from "@/lib/glossary";
import { PlayerLink } from "./PlayerLink";
import { awardKey, type Award } from "@/lib/awards";
import { TeamLink } from "./TeamLink";
import { SeasonLink } from "./SeasonLink";
import {
  SHEET,
  SHEET_HEAD,
  SHEET_ROW_HOVER,
  alignClass,
  stripeClass,
  type ColumnAlign,
} from "./DataTable";
import type { SalaryComp } from "@/lib/db/queries";

type SortKey = "name" | "season" | "team" | "pctOfLeagueCap" | "netValueScore";

interface Column {
  key: SortKey;
  label: string;
  align?: ColumnAlign;
  defaultDir: "asc" | "desc";
  /** null sorts last in both directions. */
  value: (row: SalaryComp) => string | number | null;
}

const ALL_COLUMNS: Column[] = [
  { key: "name", label: "Player", defaultDir: "asc", value: (r) => r.name },
  {
    key: "season",
    label: "Season",
    align: "center",
    defaultDir: "desc",
    value: (r) => r.season,
  },
  {
    key: "team",
    label: "Team",
    align: "center",
    defaultDir: "asc",
    value: (r) => r.team,
  },
  {
    key: "pctOfLeagueCap",
    label: "% of Cap",
    align: "right",
    defaultDir: "desc",
    value: (r) => r.pctOfLeagueCap,
  },
  {
    key: "netValueScore",
    label: "Net Value",
    align: "right",
    defaultDir: "desc",
    value: (r) => r.netValueScore,
  },
];

function compare(
  a: string | number | null,
  b: string | number | null,
  dir: "asc" | "desc",
) {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const order =
    typeof a === "number" && typeof b === "number"
      ? a - b
      : String(a).localeCompare(String(b));
  return dir === "asc" ? order : -order;
}

interface CompsTableProps {
  title: string;
  subtitle?: string;
  rows: SalaryComp[];
  /** Off for the single-season table, where every row repeats the same season. */
  showSeason?: boolean;
  emptyMessage: string;
  /** Badges for these rows, keyed by `awardKey(playerId, season)`. */
  awards?: Map<string, Award[]>;
  /**
   * A panel that sizes to its rows, up to a low ceiling, instead of reserving
   * the full height.
   *
   * For the two cuts that are normally a handful of names — one season of the
   * league, one franchise's whole history. A fixed panel under a one-row table
   * is two hundred pixels of white, and two of them side by side are most of
   * a screen. They still scroll on the rare anchor that fills them.
   */
  short?: boolean;
}

/**
 * A comps panel: full width of whatever cell it is given, fixed height,
 * scrolling internally on both axes, so a row of them lines up however many
 * comps each one found.
 *
 * Sorting is client-side on purpose. The rows are already the closest N to the
 * anchor percentage — re-sorting reorders that selection rather than re-running
 * the query, which with a limit would otherwise return, say, the 50
 * alphabetically-first comps instead of the 50 nearest ones. Unsorted (the
 * default) leaves them in closest-first order.
 */
export function CompsTable({
  title,
  subtitle,
  rows,
  showSeason = true,
  emptyMessage,
  awards,
  short = false,
}: CompsTableProps) {
  const [sort, setSort] = useState<SortKey | null>(null);
  const [dir, setDir] = useState<"asc" | "desc">("asc");
  const scrollRef = useRef<HTMLDivElement>(null);
  /**
   * Whether the rows actually overflow the panel. A panel holding five comps
   * still has room for all of them, and a gutter held open beside them reads
   * as a scrollbar that's broken, so the gutter is only reserved once there's
   * something to scroll. Measured rather than counted off row heights, which
   * are the font's business and not ours.
   */
  const [overflows, setOverflows] = useState(false);

  const columns = useMemo(
    () => ALL_COLUMNS.filter((c) => showSeason || c.key !== "season"),
    [showSeason],
  );

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort);
    if (!col) return rows;
    return [...rows].sort((a, b) => compare(col.value(a), col.value(b), dir));
  }, [rows, columns, sort, dir]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setOverflows(el.scrollHeight > el.clientHeight);
    measure();
    /*
     * Re-measured on resize, because the columns reflow with the viewport.
     * This can't oscillate: the gutter only takes width, and the table inside
     * is `w-max`, so nothing it does changes the height being measured.
     */
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [sorted]);

  function toggle(col: Column) {
    if (sort === col.key) {
      setDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSort(col.key);
      setDir(col.defaultDir);
    }
  }

  return (
    // Takes the full width it is given rather than shrinking to its content.
    // These panels sit in a grid two across, and content-width sizing made
    // four tables of four different widths with ragged gaps between them —
    // the columns differ by a hair (one table has no Season) and by whatever
    // award badges the rows happen to carry, which is not a reason for the
    // furniture to move. Any table too wide for its cell scrolls inside the
    // sheet, the same as every other table on the site.
    <div className="mb-8 w-full min-w-0">
      {/* Titles wrap rather than stretch the cell: "Point Guard Historical Cap
          Comps" is long, and on a phone it has to fold somewhere. */}
      <h2 className="text-lg font-semibold wrap-break-word text-white">
        {title}
      </h2>
      <div className="mb-2 min-h-5 text-sm text-white/60">{subtitle}</div>
      {/* Once the rows scroll, the gutter keeps the vertical scrollbar from
          squeezing the content into a horizontal scroll of its own. */}
      <div
        ref={scrollRef}
        className={`${short ? "max-h-56" : "h-80"} ${SHEET}`}
        style={{ scrollbarGutter: overflows ? "stable" : "auto" }}
      >
        <table className="w-max min-w-full text-sm text-black">
          {/* Sticky so the sort controls stay put while the rows scroll under them. */}
          <thead className={`sticky top-0 z-10 ${SHEET_HEAD}`}>
            <tr>
              {columns.map((col) => {
                const isActive = sort === col.key;
                return (
                  <th
                    key={col.key}
                    aria-sort={
                      isActive
                        ? dir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                    title={describe(col.key)}
                    className={`whitespace-nowrap p-0 font-medium ${alignClass(col.align)} ${
                      isActive ? "bg-accent" : ""
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggle(col)}
                      className={`flex w-full items-center gap-1 px-3 py-2 transition-colors ${
                        col.align === "right"
                          ? "justify-end"
                          : col.align === "center"
                            ? "justify-center"
                            : "justify-start"
                      } ${isActive ? "hover:bg-accent/80" : "hover:bg-black/5"}`}
                    >
                      {col.label}
                      {isActive && (
                        <span className="text-black/50">
                          {dir === "asc" ? "▲" : "▼"}
                        </span>
                      )}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr
                key={row.id}
                className={`${stripeClass(i)} ${SHEET_ROW_HOVER}`}
              >
                <td className="whitespace-nowrap px-3 py-1.5">
                  <PlayerLink
                    id={row.playerId}
                    name={row.name}
                    awards={awards?.get(awardKey(row.playerId, row.season))}
                  />
                </td>
                {showSeason && (
                  <td className="whitespace-nowrap px-3 py-1.5 text-center font-mono text-[0.8125rem] tabular-nums">
                    <SeasonLink season={row.season} />
                  </td>
                )}
                <td className="whitespace-nowrap px-3 py-1.5 text-center font-mono text-[0.8125rem]">
                  <TeamLink abbr={row.team} label={row.teamLabel} />
                </td>
                <td className="whitespace-nowrap px-3 py-1.5 text-right font-mono text-[0.8125rem] tabular-nums">
                  {row.pctOfLeagueCap === null
                    ? "—"
                    : `${row.pctOfLeagueCap.toFixed(2)}%`}
                </td>
                <td className="whitespace-nowrap px-3 py-1.5 text-right font-mono text-[0.8125rem] tabular-nums">
                  {formatScore(row.netValueScore)}
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-8 text-center text-black/40"
                >
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
