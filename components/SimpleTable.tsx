import Link from "next/link";
import type { ReactNode } from "react";
import { describe } from "@/lib/glossary";
import { TABLE_BREAKOUT, TABLE_BREAKOUT_FIT } from "@/lib/layout";
import {
  SHEET,
  SHEET_HEAD,
  SHEET_ROW_HOVER,
  alignClass,
  cellClass,
  stripeClass,
  type ColumnDef,
} from "./DataTable";

interface SimpleTableProps<Row> {
  /** Omitted when the page heading already names the table. */
  title?: string;
  /** Small muted line under the title, e.g. what the table is anchored to. */
  subtitle?: ReactNode;
  columns: ColumnDef<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string | number;
  /**
   * Shrink the table to its content width instead of stretching it to the
   * container. Used when the table sits beside another one rather than owning
   * the full page width.
   */
  fit?: boolean;
  /**
   * Let the table run past the page column on a large screen, out to the width
   * the screen actually has. For a table that owns the page's width and has
   * more columns than the column can hold — never one in a grid cell or beside
   * a block of prose, which would shoot out of its lane.
   */
  breakout?: boolean;
  /** Turns every row into a link to this href. */
  rowHref?: (row: Row) => string;
  /** Marks the row the rest of the page is currently anchored to. */
  isActive?: (row: Row) => boolean;
  emptyMessage?: string;
}

export function SimpleTable<Row>({
  title,
  subtitle,
  columns,
  rows,
  rowKey,
  fit,
  breakout,
  rowHref,
  isActive,
  emptyMessage = "No data.",
}: SimpleTableProps<Row>) {
  return (
    // Every branch here carries a `max-w`, and none of them is belt and braces.
    // A wrapper sized to its own content measures against its max-content, not
    // the space it has: the player page's salary log came out 1584px wide
    // inside a 1352px column, so the sheet never went into overflow and the
    // whole page scrolled sideways instead — with the last columns unreachable,
    // since the page's own scrollbar was past them. The cap hands the overflow
    // back to the sheet, which is the only element here that knows how to
    // scroll. `breakout` only moves where the cap sits: at the screen's edge
    // rather than the column's.
    <div
      className={`mb-8 w-full min-w-0 ${
        breakout
          ? fit
            ? TABLE_BREAKOUT_FIT
            : TABLE_BREAKOUT
          : fit
            ? "lg:w-fit lg:max-w-full"
            : ""
      }`}
    >
      {title && <h2 className="text-lg font-semibold text-white">{title}</h2>}
      {(title || subtitle) && (
        <div className="mb-2 min-h-5 text-sm text-white/60">
          {subtitle}
        </div>
      )}
      <div className={SHEET}>
        <table className="w-max min-w-full text-sm text-black">
          <thead className={SHEET_HEAD}>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  title={describe(col.key, col.description)}
                  className={`whitespace-nowrap px-2 py-2 font-medium ${alignClass(col.align)}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const href = rowHref?.(row);
              // A column that renders its own link opts out, so we never nest
              // one anchor inside another.
              const linked = (col: ColumnDef<Row>) =>
                Boolean(href) && !col.noRowLink;
              const active = isActive?.(row) ?? false;
              return (
                <tr
                  key={rowKey(row)}
                  aria-current={active ? "true" : undefined}
                  className={
                    active
                      ? "bg-accent font-medium"
                      : `${stripeClass(i)} ${SHEET_ROW_HOVER}`
                  }
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      // A linked row puts the padding on the anchor instead of
                      // the cell, so the whole cell is clickable.
                      className={`${linked(col) ? "p-0" : "px-3 py-1.5"} ${cellClass(col.align)}`}
                    >
                      {linked(col) ? (
                        <Link href={href!} className="block px-3 py-1.5">
                          {col.render(row)}
                        </Link>
                      ) : (
                        col.render(row)
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
            {rows.length === 0 && (
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
