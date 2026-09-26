import { unstable_cache } from "next/cache";

/**
 * The one tag every cached query carries, so a single call to
 * /api/revalidate clears them all after the data changes.
 */
export const DATA_TAG = "nba-data";

/**
 * The data only changes when the morning job or a backfill runs, so a query's
 * result is good for a day. The job clears the tag when it finishes; this is
 * the backstop for when it doesn't.
 */
const ONE_DAY = 60 * 60 * 24;

/**
 * Wraps a query so its result is kept in Next's data cache — durable and
 * shared across serverless instances on Vercel — keyed by `name` plus the
 * call's arguments. Every page view was a round trip to Neon before this, and
 * Neon bills the bytes that come back.
 *
 * `unstable_cache` rather than `"use cache"`: the directive needs
 * `cacheComponents`, which would mean restructuring every page that reads
 * `searchParams`, and its default store is in-memory, which serverless
 * instances don't keep between requests.
 *
 * Results pass through JSON on the way into the cache, so a query that
 * returns a Map or a Date has to cache something plainer and rebuild it.
 *
 * Skipped under `next dev`, so a backfill shows up on the next reload instead
 * of after a day.
 */
export function cached<Args extends unknown[], Result>(
  name: string,
  fn: (...args: Args) => Promise<Result>,
): (...args: Args) => Promise<Result> {
  if (process.env.NODE_ENV === "development") return fn;
  return unstable_cache(fn, [name], { tags: [DATA_TAG], revalidate: ONE_DAY });
}
