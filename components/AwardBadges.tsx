import Link from "next/link";
import {
  AWARDS,
  awardHref,
  badgeLabel,
  fullLabel,
  sortAwards,
  type Award,
} from "@/lib/awards";

/**
 * The accent is reserved on this site for state you chose, so a badge can't
 * wear it — a yellow chip beside a name would read as a selected row. These
 * borrow the sheet's own ink instead and separate the tiers by weight.
 */
/*
 * A badge's colors at rest and under the cursor.
 *
 * The hover is an inversion rather than the accent fill the rest of the site
 * uses for this, because a badge can only ever be hovered while its own row is
 * hovered too — and a hovered row is already tinted --surface-hover, which is
 * pale yellow. An accent chip on it was all but invisible. Flipping each
 * badge's own two colors instead reads clearly on white paper and on the
 * tinted row alike, and stays legible for the filled MVP chip, which has no
 * lighter state to move to.
 *
 * Driven by the link wrapping each chip, so the one under the cursor lights up
 * alone: chips in the same row lead to different places, and lighting them
 * together would say otherwise.
 */
function badgeClass(award: Award["award"]) {
  const hover = "transition-colors group-hover/badge:border-black";

  const base =
    AWARDS[award].rank <= 5
      ? "border-black/40 bg-black/[0.07] text-black/80"
      : "border-black/25 bg-transparent text-black/60";
  return `${hover} ${base} group-hover/badge:bg-black group-hover/badge:text-white`;
}

function Badge({ award, teamNumber, extra }: Award & { extra?: number }) {
  return (
    <span
      title={fullLabel(award, teamNumber)}
      className={`inline-flex shrink-0 items-center rounded border px-1 py-px font-sans text-[12px] leading-none font-medium whitespace-nowrap ${badgeClass(
        award,
      )}`}
    >
      {badgeLabel(award, teamNumber)}
      {/* On a narrow screen only the scarcest badge fits, so the ones left
          behind are counted rather than dropped silently. */}
      {extra ? <span className="ml-0.5 opacity-70">+{extra}</span> : null}
    </span>
  );
}

/**
 * A season's awards, beside a player's name in a table.
 *
 * Wide enough and every badge shows. Narrow and only the scarcest one does,
 * carrying a `+n` for the rest — the row still says "this was a decorated
 * season" without spending width the table doesn't have on a phone, which is
 * the whole reason the name column stays readable there.
 *
 * Both sets are rendered and one is hidden by CSS rather than picking between
 * them in JS, because these render inside server-rendered table rows and a
 * breakpoint isn't known there.
 */
export function AwardBadges({ awards }: { awards: Award[] }) {
  if (awards.length === 0) return null;
  const sorted = sortAwards(awards);
  const [top, ...rest] = sorted;

  /*
   * Each chip links on its own, because they no longer share a destination:
   * MVP goes to the list of every MVP, All-NBA to that season's snapshot. The
   * collapsed chip carries the count of what it stands in for and follows its
   * own award, which is the scarcest one and the one being read.
   */
  const link = (a: Award, extra?: number) => (
    <Link
      key={`${a.award}-${a.teamNumber ?? ""}`}
      href={awardHref(a.award, a.season)}
      aria-label={`${fullLabel(a.award, a.teamNumber)}, ${a.season}`}
      className="group/badge inline-flex"
    >
      <Badge {...a} extra={extra} />
    </Link>
  );

  return (
    <>
      <span className="ml-1.5 hidden items-center gap-1 align-middle md:inline-flex">
        {sorted.map((a) => link(a))}
      </span>
      <span className="ml-1.5 inline-flex items-center align-middle md:hidden">
        {link(top, rest.length)}
      </span>
    </>
  );
}

/**
 * The career version, for a player's own page: one badge per honor with a
 * count, rather than one per season, so a fifteen-time All-Star reads as
 * "★ ×15" instead of fifteen identical chips.
 */
export function CareerAwardBadges({ awards }: { awards: Award[] }) {
  if (awards.length === 0) return null;

  // The caller hands these back newest season first, and sorting by rank is
  // stable, so the award kept for each group is its most recent — which is
  // where the link should land when one badge stands for several seasons.
  const grouped = new Map<string, { award: Award; seasons: string[] }>();
  for (const a of sortAwards(awards)) {
    const key = `${a.award}-${a.teamNumber ?? ""}`;
    const hit = grouped.get(key);
    if (hit) hit.seasons.push(a.season);
    else grouped.set(key, { award: a, seasons: [a.season] });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {[...grouped.values()].map(({ award, seasons }) => (
        <Link
          key={`${award.award}-${award.teamNumber ?? ""}`}
          href={awardHref(award.award, award.season)}
          title={`${fullLabel(award.award, award.teamNumber)}: ${seasons
            .slice()
            .reverse()
            .join(", ")}`}
          className="inline-flex items-center gap-1 rounded-md border border-accent/60 bg-background-box px-2 py-1 text-xs font-medium text-white transition-colors hover:border-accent hover:bg-accent hover:text-black"
        >
          {badgeLabel(award.award, award.teamNumber)}
          {seasons.length > 1 && (
            <span className="opacity-60">×{seasons.length}</span>
          )}
        </Link>
      ))}
    </div>
  );
}
