import Link from "next/link";
import type { ReactNode } from "react";
import { SeasonFilter } from "./SeasonFilter";
import { TeamFilter, type TeamOption } from "./TeamFilter";

export type ColumnAlign = "left" | "right" | "center";

export interface ColumnDef<Row> {
  key: string;
  label: string;
  align?: ColumnAlign;
  defaultDir?: "asc" | "desc";
  render: (row: Row) => ReactNode;
}

export function alignClass(align?: ColumnAlign) {
  if (align === "right") return "text-right";
  if (align === "center") return "text-center";
  return "text-left";
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
  /** Rendered next to the season filter, e.g. a totals/averages toggle. */
  toolbar?: ReactNode;
}

function buildHref(
  basePath: string,
  params: Record<string, string | number>,
  extraParams?: Record<string, string>
) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...extraParams, ...params })) sp.set(k, String(v));
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
  toolbar,
}: DataTableProps<Row>) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div className="flex items-center gap-4 flex-wrap">
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
          {toolbar}
        </div>
        <div className="text-sm text-white/60">{totalCount.toLocaleString()} rows</div>
      </div>
      <div className="overflow-x-auto border border-white/10 rounded-lg bg-white">
        <table className="min-w-full text-sm text-black">
          <thead className="bg-white">
            <tr>
              <th className="px-3 py-2 text-right text-black/40 font-medium border-b border-black/10">
                #
              </th>
              {columns.map((col) => {
                const isActive = sort === col.key;
                const nextDir = isActive ? (dir === "asc" ? "desc" : "asc") : col.defaultDir ?? "desc";
                const href = buildHref(
                  basePath,
                  {
                    season: currentSeason,
                    team: currentTeam,
                    sort: col.key,
                    dir: nextDir,
                    page: 1,
                  },
                  extraParams
                );
                return (
                  <th
                    key={col.key}
                    className={`p-0 font-medium whitespace-nowrap border-b border-black/10 ${alignClass(
                      col.align
                    )}`}
                  >
                    <Link
                      href={href}
                      className={`flex items-center gap-1 px-3 py-2 hover:bg-accent transition-colors ${justifyClass(
                        col.align
                      )}`}
                    >
                      {col.label}
                      {isActive && <span className="text-black/50">{dir === "asc" ? "▲" : "▼"}</span>}
                    </Link>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={rowKey(row)}
                className={`${i % 2 === 0 ? "bg-white" : "bg-gray-100"} hover:bg-accent transition-colors`}
              >
                <td className="px-3 py-1.5 text-right text-black/40">
                  {(page - 1) * pageSize + i + 1}
                </td>
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-3 py-1.5 whitespace-nowrap ${alignClass(col.align)} ${
                      col.align === "right" || col.align === "center" ? "tabular-nums" : ""
                    }`}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="px-3 py-6 text-center text-black/40">
                  No rows found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-center gap-6 mt-4 text-sm">
        <Link
          href={buildHref(
            basePath,
            { season: currentSeason, team: currentTeam, sort, dir, page: Math.max(1, page - 1) },
            extraParams
          )}
          className={`px-3 py-1.5 rounded border border-white/20 ${
            page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-accent hover:text-black hover:border-accent"
          }`}
        >
          ← Previous
        </Link>
        <div className="text-white/60">
          Page {page} of {totalPages}
        </div>
        <Link
          href={buildHref(
            basePath,
            {
              season: currentSeason,
              team: currentTeam,
              sort,
              dir,
              page: Math.min(totalPages, page + 1),
            },
            extraParams
          )}
          className={`px-3 py-1.5 rounded border border-white/20 ${
            page >= totalPages ? "pointer-events-none opacity-40" : "hover:bg-accent hover:text-black hover:border-accent"
          }`}
        >
          Next →
        </Link>
      </div>
    </div>
  );
}
