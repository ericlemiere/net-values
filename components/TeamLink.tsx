import Link from "next/link";

/**
 * A team abbreviation that links to that team's page.
 *
 * Renders plain text for a null team — a player traded mid-season has one
 * combined row with no single team, and there's nothing to link to.
 */
export function TeamLink({ abbr }: { abbr: string | null }) {
  if (!abbr) return <>—</>;
  return (
    <Link href={`/teams/${abbr}`} className="hover:underline">
      {abbr}
    </Link>
  );
}
