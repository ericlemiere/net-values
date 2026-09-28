import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { describe, glossaryFor, tooltip } from "@/lib/glossary";
import { GlossaryButton } from "./GlossaryButton";
import { SplitGroup, SplitToggle } from "./SplitRows";
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
  /**
   * Show the glossary "?" above the table's top-right corner. Off when the
   * page already puts one in a toolbar of its own, beside its filters.
   */
  glossary?: boolean;
  /** Sits under the table's bottom-right corner, e.g. a row count. */
  footer?: ReactNode;
  /**
   * Rows folded under a row, opened by a +/− button in its `splitColumn` cell —
   * a traded player's season, one row per team. Rows with none get no button.
   */
  splits?: (row: Row) => Row[] | undefined;
  /** The column whose cell holds the +/− button. */
  splitColumn?: string;
  /** What the +/− button opens, for its label: "Show {splitsLabel}". */
  splitsLabel?: string;
  /**
   * Rows always shown under a row, styled like the folded ones but with no
   * button — a waived contract under the season it was still being paid in.
   */
  attached?: (row: Row) => Row[] | undefined;
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
  glossary = true,
  footer,
  splits,
  splitColumn = "team",
  splitsLabel = "stats by team",
  attached,
}: SimpleTableProps<Row>) {
  const entries = glossary ? glossaryFor(columns) : [];
  // A row set under another: same stripe as its parent, set off by muted text
  // and an empty lead cell, so the group reads as one block and the striping
  // below it doesn't shift.
  const subRow = (child: Row, i: number) => (
    <tr key={rowKey(child)} className={`${stripeClass(i)} text-black/60`}>
      {columns.map((col, c) => (
        <td key={col.key} className={`px-3 py-1 ${cellClass(col.align)}`}>
          {c === 0 ? null : col.render(child)}
        </td>
      ))}
    </tr>
  );
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
      {(title || subtitle || entries.length > 0) && (
        <div className="mb-2 flex items-end justify-between gap-3">
          <div className="min-w-0">
            {title && (
              <h2 className="text-lg font-semibold text-white">{title}</h2>
            )}
            {(title || subtitle) && (
              <div className="min-h-5 text-sm text-white/60">{subtitle}</div>
            )}
          </div>
          <GlossaryButton entries={entries} />
        </div>
      )}
      <div className={SHEET}>
        <table className="w-max min-w-full text-sm text-black">
          <thead className={SHEET_HEAD}>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  title={tooltip(describe(col.key, col.definition))}
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
              // one anchor inside another. The +/− is a button, so its
              // cell opts out too.
              const children = splits?.(row) ?? [];
              const linked = (col: ColumnDef<Row>) =>
                Boolean(href) &&
                !col.noRowLink &&
                !(children.length > 0 && col.key === splitColumn);
              const active = isActive?.(row) ?? false;
              const tr = (
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
                      ) : children.length > 0 && col.key === splitColumn ? (
                        <span className="inline-flex items-center align-middle">
                          {col.render(row)}
                          <SplitToggle label={splitsLabel} />
                        </span>
                      ) : (
                        col.render(row)
                      )}
                    </td>
                  ))}
                </tr>
              );
              const always = (attached?.(row) ?? []).map((a) => subRow(a, i));
              const group =
                children.length === 0 ? (
                  tr
                ) : (
                  <SplitGroup
                    key={rowKey(row)}
                    row={tr}
                    splits={children.map((child) => subRow(child, i))}
                  />
                );
              if (always.length === 0) return group;
              return (
                <Fragment key={rowKey(row)}>
                  {group}
                  {always}
                </Fragment>
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
      {footer && <div className="mt-3 flex justify-end">{footer}</div>}
    </div>
  );
}
