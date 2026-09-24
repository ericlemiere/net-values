/**
 * The column every page renders into.
 *
 * It is deliberately NOT centered. The pages here are wildly different widths —
 * a thirteen-column stats sheet next to a column of explainer prose — so
 * centering each one to its own width puts the left edge somewhere new on every
 * navigation. Headings slide sideways as you move between pages, and the
 * `loading.tsx` spinner comes up nowhere near where the content it stands in
 * for will land, because the skeleton and the page it precedes are different
 * widths too.
 *
 * Anchoring every page to the same left gutter fixes that edge in place, so
 * only the content below it changes. It is the same gutter the header's brand
 * and nav already sit on (`px-6`), which lines the page title up under them.
 * `max-w` still caps how far right a page may run, so a wide sheet stays wide
 * and prose stays readable — the width now grows to the right instead of
 * outward from the middle.
 *
 * None of this is visible below the `max-w`: the column is narrower than the
 * viewport there, so it simply fills it and the centering never had anything to
 * absorb. Phones and tablets look exactly as they did.
 *
 * `w-full min-w-0` is load-bearing on every page: the column is a flex item, so
 * without it the widest table's own width becomes the column's minimum and the
 * whole page scrolls sideways instead of the table scrolling inside its frame.
 */
export const PAGE_COLUMN = "w-full min-w-0 max-w-350 p-6 text-white";

/**
 * The same column, held to a readable measure for long-form copy.
 *
 * The tighter horizontal padding below `sm` is the explainer's own: it runs
 * much closer to the edge of a phone than a table page does, and the table
 * pages keep their `p-6` there.
 */
export const PAGE_COLUMN_PROSE =
  "w-full min-w-0 max-w-4xl px-4 py-6 text-white sm:p-6";

/**
 * How far right a sheet may run: to the screen's edge, less the gutter the page
 * column keeps on the left, so the two sides match.
 *
 * `cqi` and not `vw` — see the `.site-main` container in `globals.css` for why
 * the viewport is the wrong ruler here.
 */
const BREAKOUT_MAX = "lg:max-w-[calc(100cqi-3rem)]";

/**
 * Lets a sheet that is wider than the page column run on to the right.
 *
 * The column is sized for reading, not for a thirty-column box score, and the
 * widest tables here need around 2100px — so on a large display they were
 * hiding a third of themselves behind a horizontal scroll while several hundred
 * pixels of page sat empty beside them.
 *
 * Both halves are load-bearing:
 * - `w-max` takes the table's own width, which is the only thing that can
 *   exceed the column. `w-fit` cannot: `fit-content` clamps to the space
 *   available, which is the column, which is the problem.
 * - `min-w-full` keeps the column's width as the floor, so the tables that
 *   already fit — /salaries is 1105px of content in a 1352px column — stay
 *   stretched to it instead of shrinking to their contents.
 *
 * Past `BREAKOUT_MAX` the sheet scrolls, as it always did; there is simply far
 * less left to scroll.
 *
 * Desktop only. Below `lg` the sheet is narrower than any table and panning it
 * sideways is the ordinary way a table behaves on a phone.
 *
 * This belongs on a table that owns the page's width, and on nothing else — a
 * table in a grid cell or in a column of prose would shoot straight out of its
 * lane.
 */
export const TABLE_BREAKOUT = `lg:w-max lg:min-w-full ${BREAKOUT_MAX}`;

/**
 * The same, for a sheet that sizes to its own contents rather than filling the
 * column. It drops the floor: the point of a fitted table is that it stops
 * where its columns do, and `min-w-full` would drag it back out to the column.
 */
export const TABLE_BREAKOUT_FIT = `lg:w-max ${BREAKOUT_MAX}`;
