import Link from "next/link";
import type { ReactNode } from "react";
import { alignClass, type ColumnDef } from "./DataTable";

interface SimpleTableProps<Row> {
  title: string;
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
  rowHref,
  isActive,
  emptyMessage = "No data.",
}: SimpleTableProps<Row>) {
  return (
    <div className={`mb-8 ${fit ? "w-fit max-w-full" : ""}`}>
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <div className="mb-2 min-h-[20px] text-sm text-white/60">{subtitle}</div>
      <div className="overflow-x-auto border border-white/10 rounded-lg bg-white">
        <table className={`${fit ? "w-auto" : "min-w-full"} text-sm text-black`}>
          <thead className="bg-white">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-3 py-2 font-medium whitespace-nowrap border-b border-black/10 ${alignClass(
                    col.align
                  )}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const href = rowHref?.(row);
              const active = isActive?.(row) ?? false;
              return (
                <tr
                  key={rowKey(row)}
                  className={`${
                    active
                      ? "bg-accent font-medium"
                      : i % 2 === 0
                        ? "bg-white"
                        : "bg-gray-100"
                  } hover:bg-accent transition-colors`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      // A linked row puts the padding on the anchor instead of
                      // the cell, so the whole cell is clickable.
                      className={`${href ? "p-0" : "px-3 py-1.5"} whitespace-nowrap ${alignClass(
                        col.align
                      )} ${
                        col.align === "right" || col.align === "center" ? "tabular-nums" : ""
                      }`}
                    >
                      {href ? (
                        <Link href={href} className="block px-3 py-1.5">
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
                <td colSpan={columns.length} className="px-3 py-6 text-center text-black/40">
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
