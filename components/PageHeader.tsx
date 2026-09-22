import type { ReactNode } from "react";

/**
 * Shared heading row for the stats / advanced stats / salaries pages.
 *
 * Title hard left, `meta` hard right. The row carries a min-height so the
 * table below starts at the same y-offset on all three pages — otherwise
 * navigating between them shifts the table vertically, since /stats has an
 * Averages/Totals toggle and /salaries a league-cap banner while
 * /advanced-stats has neither. The height is reserved even when `meta` is
 * empty, which also keeps the salaries table from jumping when the cap banner
 * disappears on "All seasons".
 *
 * 46px matches the cap banner (px-4 py-2 around text-lg plus its border), the
 * tallest thing that goes in this row. It's a min-height, so a wrapped heading
 * on a narrow viewport still grows instead of clipping.
 */
export function PageHeader({
  title,
  meta,
}: {
  title: string;
  /** Right of the row — e.g. the league cap banner or the stat type toggle. */
  meta?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-4 md:min-h-11.5 md:flex-row md:items-center md:gap-8">
      <h1 className="min-w-0 text-2xl font-semibold tracking-tight">{title}</h1>
      {meta ? <div className="min-w-0 max-w-full">{meta}</div> : null}
    </div>
  );
}
