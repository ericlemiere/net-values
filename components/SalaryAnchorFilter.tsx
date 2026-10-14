"use client";

import { useTableNav } from "./TableNav";
import { FilterDropdown } from "./FilterDropdown";

/**
 * The phone's way to pick which salary the comps are anchored to. On a laptop
 * the salary log's rows do it, but on a phone the Season and Team cells fill
 * the screen and link elsewhere, so the rows are switched off there and this
 * takes their place. It sets the same ?salary= the rows did, so the table's
 * highlight follows it.
 */
export function SalaryAnchorFilter({
  playerId,
  salaries,
  currentId,
  liveSeason,
}: {
  playerId: number;
  salaries: { id: number; season: string }[];
  currentId: number;
  /** The season being played now, marked as such in the list. */
  liveSeason?: string;
}) {
  const { navigate } = useTableNav();
  return (
    <FilterDropdown
      label="Season"
      value={String(currentId)}
      // Newest first, like the site's other season filters.
      options={[...salaries].reverse().map((s) => ({
        value: String(s.id),
        label: s.season,
        note: s.season === liveSeason ? "(current)" : undefined,
      }))}
      // Not to the top: the comps it changes are right below it.
      onChange={(id) =>
        navigate(`/players/${playerId}?salary=${id}`, { scroll: false })
      }
    />
  );
}
