import Link from "next/link";
import { Fragment } from "react";

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
 * Renders a dash for a null team, which is nothing to link to. A traded
 * player's season row wants SeasonTeams below instead.
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
      className="sheet-link"
      title={shown === abbr ? undefined : `${shown}, now ${abbr}`}
    >
      {shown}
    </Link>
  );
}

/**
 * The Team cell for a season row: one TeamLink, or for a player traded
 * mid-season every team he played for in order — WAS → ATL, each its own link.
 *
 * `teams` is the stint list from player_team_splits and is null for everyone
 * who stayed put, which falls back to the row's own team.
 */
export function SeasonTeams({
  abbr,
  label,
  teams,
}: {
  abbr: string | null;
  label?: string | null;
  teams?: { abbr: string; label: string | null }[] | null;
}) {
  if (!teams || teams.length < 2) return <TeamLink abbr={abbr} label={label} />;
  return (
    <span className="whitespace-nowrap">
      {teams.map((t, i) => (
        <Fragment key={t.abbr}>
          {i > 0 && (
            <>
              {/* Drawn rather than typed: the → glyph is a full monospace
                  cell wide and dwarfs the abbreviations either side of it. */}
              <svg
                aria-hidden
                viewBox="0 0 10 8"
                className="mx-1 inline-block h-[0.55em] w-[0.7em] align-middle text-black/45"
              >
                <path
                  d="M0.5 4h8M5.5 1l3 3-3 3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="sr-only">, then </span>
            </>
          )}
          <TeamLink abbr={t.abbr} label={t.label} />
        </Fragment>
      ))}
    </span>
  );
}
