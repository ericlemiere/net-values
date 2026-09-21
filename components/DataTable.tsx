import type { ReactNode } from "react";
import { NavLink, TableOverlay } from "./TableNav";
import { describe } from "@/lib/glossary";
import { SeasonFilter } from "./SeasonFilter";
import { TeamFilter, type TeamOption } from "./TeamFilter";

export type ColumnAlign = "left" | "right" | "center";

export interface ColumnDef<Row> {
  key: string;
  label: string;
  /**
   * Overrides the shared glossary entry for this column. Needed where one key
   * means different things in different views — `mp` is a per-game average on
   * one table and a season total on another.
   */
  description?: string;
  /**
   * Keeps this cell out of the row-wide link. Set it on any column whose own
   * render puts a link in the cell: an anchor inside an anchor is invalid
   * HTML, and the browser silently unnests it.
   */
  noRowLink?: boolean;
  align?: ColumnAlign;
  defaultDir?: "asc" | "desc";
  render: (row: Row) => ReactNode;
}

export function alignClass(align?: ColumnAlign) {
  if (align === "right") return "text-right";
  if (align === "center") return "text-center";
  return "text-left";
}

/**
 * Shared chrome for every table on the site. Defined here rather than repeated
 * in DataTable/SimpleTable/CompsTable so the three can't drift apart.
 *
 * The accent is load-bearing, not decorative: it marks what you're anchored to
 * (the sheet itself, the column it's sorted by, the row you picked). That's why
 * hover is SHEET_ROW_HOVER's pale tint instead of the full accent — if hover
 * and "selected" were both #fff200 you couldn't tell them apart.
 */
export const SHEET =
  "w-full max-w-full overflow-x-auto overscroll-x-contain touch-pan-x rounded-lg border-2 border-accent bg-surface";

/** Header cells sit on the sheet and are separated from it by an accent rule. */
export const SHEET_HEAD = "bg-surface border-b-2 border-accent";

/**
 * The scrolling variant, for the long league-wide tables.
 *
 * A sticky `thead` anchors to its nearest scroll container, and SHEET is
 * already one: `overflow-x-auto` makes a box scrollable on both axes. With an
 * automatic height that container never scrolls vertically, so a sticky header
 * inside it would never engage as the page moved. Capping the height makes the
 * sheet itself the thing that scrolls, which is what the header then sticks to.
 *
 * The cap leaves room for the fixed site header, the page heading, the filter
 * row and the pager, so all of those stay put while the rows move.
 */
export const SHEET_SCROLL = `${SHEET} max-h-[calc(100dvh-16rem)]`;

/** Keeps the column headers in view while the rows scroll under them. */
export const SHEET_HEAD_STICKY = `${SHEET_HEAD} sticky top-0 z-10`;

export const SHEET_ROW_HOVER = "hover:bg-surface-hover transition-colors";

/**
 * The row-count label beside a table's filters. It carries its own background
 * because it floats over the page, and the logo watermark behind it would
 * otherwise cut straight through the digits.
 */
export const COUNT_CHIP =
  "rounded-md border border-white/15 bg-black/70 px-2.5 py-1 text-sm tabular-nums text-white/70";

/** Zebra striping for an unselected row. */
export function stripeClass(i: number) {
  return i % 2 === 0 ? "bg-surface" : "bg-surface-alt";
}

/** Numeric cells: mono digits so columns line up the way a box score should. */
export function cellClass(align?: ColumnAlign) {
  const numeric = align === "right" || align === "center";
  return `whitespace-nowrap ${alignClass(align)} ${
    numeric ? "font-mono tabular-nums text-[0.8125rem]" : ""
  }`;
}

// Header labels sit in a flex row (label + sort caret), so they need a
// justify-* to match the cell's text-* alignment.
function justifyClass(align?: ColumnAlign) {
  if (align === "right") return "justify-end";
  if (align === "center") return "justify-center";
  return "justify-start";
}

interface DataTableProps<Row> {
  basePath: string;
  columns: ColumnDef<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string | number;
  seasons: string[];
  currentSeason: string;
  teams: TeamOption[];
  currentTeam: string;
  sort: string;
  dir: "asc" | "desc";
  page: number;
  totalCount: number;
  pageSize: number;
  /** Extra query params (e.g. stat type toggle) preserved across every link this table builds. */
  extraParams?: Record<string, string>;
}

function buildHref(
  basePath: string,
  params: Record<string, string | number>,
  extraParams?: Record<string, string>,
) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...extraParams, ...params }))
    sp.set(k, String(v));
  return `${basePath}?${sp.toString()}`;
}

export function DataTable<Row>({
  basePath,
  columns,
  rows,
  rowKey,
  seasons,
  currentSeason,
  teams,
  currentTeam,
  sort,
  dir,
  page,
  totalCount,
  pageSize,
  extraParams,
}: DataTableProps<Row>) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="min-w-0 max-w-screen">
      <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col md:flex-row min-w-0 md:items-center gap-4 w-full">
          <SeasonFilter
            basePath={basePath}
            seasons={seasons}
            currentSeason={currentSeason}
            currentTeam={currentTeam}
            sort={sort}
            dir={dir}
            extraParams={extraParams}
          />
          <TeamFilter
            basePath={basePath}
            teams={teams}
            currentTeam={currentTeam}
            season={currentSeason}
            sort={sort}
            dir={dir}
            extraParams={extraParams}
          />
        </div>
        <div className={`shrink-0 ${COUNT_CHIP}`}>
          {totalCount.toLocaleString()} rows
        </div>
      </div>
      <TableOverlay>
        <div className={SHEET_SCROLL}>
          <table className="w-max min-w-full text-sm text-black">
            <thead className={SHEET_HEAD_STICKY}>
              <tr>
                <th
                  className="px-3 py-2 text-right font-medium text-black/40"
                  title="Rank within the current sort and page."
                >
                  #
                </th>
                {columns.map((col) => {
                  const isActive = sort === col.key;
                  const nextDir = isActive
                    ? dir === "asc"
                      ? "desc"
                      : "asc"
                    : (col.defaultDir ?? "desc");
                  const href = buildHref(
                    basePath,
                    {
                      season: currentSeason,
                      team: currentTeam,
                      sort: col.key,
                      dir: nextDir,
                      page: 1,
                    },
                    extraParams,
                  );
                  return (
                    <th
                      key={col.key}
                      title={describe(col.key, col.description)}
                      aria-sort={
                        isActive
                          ? dir === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                      className={`p-0 font-medium whitespace-nowrap ${alignClass(col.align)} ${
                        isActive ? "bg-accent" : ""
                      }`}
                    >
                      <NavLink
                        href={href}
                        className={`flex items-center gap-1 px-3 py-2 transition-colors ${justifyClass(
                          col.align,
                        )} ${isActive ? "hover:bg-accent/80" : "hover:bg-black/5"}`}
                      >
                        {col.label}
                        {isActive && (
                          <span className="text-black/50">
                            {dir === "asc" ? "▲" : "▼"}
                          </span>
                        )}
                      </NavLink>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={rowKey(row)}
                  className={`${stripeClass(i)} ${SHEET_ROW_HOVER}`}
                >
                  <td className="px-3 py-1.5 text-right font-mono text-[0.8125rem] tabular-nums text-black/40">
                    {(page - 1) * pageSize + i + 1}
                  </td>
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-3 py-1.5 ${cellClass(col.align)}`}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={columns.length + 1}
                    className="px-3 py-8 text-center text-black/40"
                  >
                    No rows match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </TableOverlay>
      <div className="mt-4 flex items-center justify-center gap-6 text-sm">
        <NavLink
          href={buildHref(
            basePath,
            {
              season: currentSeason,
              team: currentTeam,
              sort,
              dir,
              page: Math.max(1, page - 1),
            },
            extraParams,
          )}
          className={`rounded border border-white/20 px-3 py-1.5 transition-colors ${
            page <= 1
              ? "pointer-events-none opacity-30"
              : "hover:border-accent hover:bg-accent hover:text-black"
          }`}
        >
          ← Previous
        </NavLink>
        <div className="tabular-nums text-white/60">
          Page {page} of {totalPages}
        </div>
        <NavLink
          href={buildHref(
            basePath,
            {
              season: currentSeason,
              team: currentTeam,
              sort,
              dir,
              page: Math.min(totalPages, page + 1),
            },
            extraParams,
          )}
          className={`rounded border border-white/20 px-3 py-1.5 transition-colors ${
            page >= totalPages
              ? "pointer-events-none opacity-30"
              : "hover:border-accent hover:bg-accent hover:text-black"
          }`}
        >
          Next →
        </NavLink>
      </div>
    </div>
  );
}
