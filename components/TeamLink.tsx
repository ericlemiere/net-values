import Link from "next/link";

/**
 * A team abbreviation that links to that team's page.
 *
 * The label and the destination are deliberately separate. A franchise is one
 * continuous thing and gets one page, keyed by the abbreviation it uses now —
 * but a season it played under another name should read as that name. So a
 * 1995-96 row shows SEA and still goes to /teams/OKC, and the title attribute
 * says why, since a link that reads SEA and lands on the Thunder is otherwise
 * a surprise.
 *
 * Renders plain text for a null team — a player traded mid-season has one
 * combined row with no single team, and there's nothing to link to.
 */
export function TeamLink({
  abbr,
  /** What the franchise was called that season. Falls back to `abbr`. */
  label,
}: {
  abbr: string | null;
  label?: string | null;
}) {
  if (!abbr) return <>—</>;
  const shown = label ?? abbr;
  return (
    <Link
      href={`/teams/${abbr}`}
      className="hover:underline"
      title={shown === abbr ? undefined : `${shown} — now ${abbr}`}
    >
      {shown}
    </Link>
  );
}
