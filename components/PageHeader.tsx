import type { ReactNode } from "react";

/**
 * Shared heading row for the stats / advanced stats / salaries pages.
 *
 * Title (plus any inline control) sits left, `meta` sits right. The row carries
 * a min-height so the table below starts at the same y-offset on all three
 * pages — otherwise navigating between them shifts the table vertically, since
 * /stats has an Averages/Totals toggle and /salaries a league-cap banner while
 * /advanced-stats has neither. The height is reserved even when both slots are
 * empty, which also keeps the salaries table from jumping when the cap banner
 * disappears on "All seasons".
 *
 * 46px matches the cap banner (px-4 py-2 around text-lg plus its border), the
 * tallest thing that goes in this row. It's a min-height, so a wrapped heading
 * on a narrow viewport still grows instead of clipping.
 */
export function PageHeader({
  title,
  toolbar,
  meta,
}: {
  title: string;
  /** Inline, right of the title — e.g. the stat type toggle. */
  toolbar?: ReactNode;
  /** Far right of the row — e.g. the league cap banner. */
  meta?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-0 md:min-h-[46px]">
      <div className="flex items-center gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {toolbar}
      </div>
      {meta}
    </div>
  );
}
