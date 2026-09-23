import Link from "next/link";
import { AwardBadges } from "@/components/AwardBadges";
import type { Award } from "@/lib/awards";

/**
 * A player's name in a table, with whatever he won that season beside it.
 *
 * The badges sit next to the name link rather than inside it: they are links
 * of their own, to the awards page, and an anchor nested in an anchor is
 * invalid HTML that the browser quietly pulls apart.
 */
export function PlayerLink({
  id,
  name,
  awards,
}: {
  id: number;
  name: string;
  awards?: Award[];
}) {
  return (
    <span className="inline-flex items-center whitespace-nowrap">
      <Link href={`/players/${id}`} className="sheet-link">
        {name}
      </Link>
      {awards && awards.length > 0 && <AwardBadges awards={awards} />}
    </span>
  );
}
