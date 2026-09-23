import Link from "next/link";

/**
 * A season that links to its snapshot page.
 *
 * Seasons appear as a column on half the tables on the site and were dead text
 * everywhere, even though there is now a page saying what happened in one.
 */
export function SeasonLink({ season }: { season: string | null }) {
  if (!season) return <>—</>;
  return (
    <Link
      href={`/seasons?season=${encodeURIComponent(season)}`}
      className="sheet-link"
      title={`What happened in ${season}`}
    >
      {season}
    </Link>
  );
}
