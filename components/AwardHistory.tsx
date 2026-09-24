import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { PlayerLink } from "@/components/PlayerLink";
import { TeamLink } from "@/components/TeamLink";
import { SeasonLink } from "@/components/SeasonLink";
import { SimpleTable } from "@/components/SimpleTable";
import type { ColumnDef } from "@/components/DataTable";
import { formatScore } from "@/lib/format";
import { AWARDS, AWARD_PAGES, type AwardCode } from "@/lib/awards";
import { getAwardWinners, type AwardWinnerRow } from "@/lib/db/queries";
import { PAGE_COLUMN } from "@/lib/layout";

/**
 * Every winner of one award, on its own page.
 *
 * Shared by /mvp, /dpoy, /roy, /6moy and /mip, which differ only by which code
 * they pass — the five awards that have one winner a year and therefore a
 * history worth reading as a list. The team awards don't get one: five hundred
 * All-NBA selections say much less than one season's does, so those badges
 * point at the season instead.
 */
export async function AwardHistory({ award }: { award: AwardCode }) {
  const rows = await getAwardWinners(award);
  const { full } = AWARDS[award];

  const columns: ColumnDef<AwardWinnerRow>[] = [
    {
      key: "season",
      label: "Season",
      render: (r) => <SeasonLink season={r.season} />,
    },
    {
      key: "name",
      label: "Player",
      render: (r) => <PlayerLink id={r.playerId} name={r.name} />,
    },
    {
      key: "team",
      label: "Team",
      render: (r) => <TeamLink abbr={r.team} label={r.teamLabel} />,
    },
    {
      key: "netValue",
      label: "Net Value",
      align: "right",
      description:
        "Production minus what his pay expected of him. About 2.5 team wins per NVP.",
      render: (r) =>
        r.netValueScore === null ? "—" : formatScore(r.netValueScore),
    },
    {
      key: "nvRank",
      label: "NV Rank",
      align: "right",
      description: "Where that Net Value placed him in the league that season.",
      render: (r) => (r.seasonRank === null ? "—" : `#${r.seasonRank}`),
    },
  ];

  // How many players hold it, which is the thing a list like this makes you
  // wonder — 36 seasons of MVP have been shared by far fewer than 36 men.
  const holders = new Set(rows.map((r) => r.playerId)).size;

  return (
    <div className={PAGE_COLUMN}>
      <PageHeader title={full} meta={<AwardPageNav current={award} />} />
      <SimpleTable
        subtitle={`${rows.length} award${rows.length === 1 ? "" : "s"} across ${holders} player${
          holders === 1 ? "" : "s"
        }`}
        columns={columns}
        rows={rows}
        rowKey={(r) => `${r.season}-${r.playerId}`}
        emptyMessage="No winners on record."
      />
    </div>
  );
}

/**
 * Links between the award pages and back to the season snapshot.
 *
 * These pages are reached by clicking a badge, so without this the only way to
 * get from the MVP list to the DPOY list is to go and find another badge.
 */
function AwardPageNav({ current }: { current: AwardCode }) {
  return (
    <nav className="flex flex-wrap items-center gap-2 text-sm">
      {AWARD_PAGES.map((code) => {
        const active = code === current;
        return (
          <Link
            key={code}
            href={AWARDS[code].path!}
            aria-current={active ? "page" : undefined}
            className={`rounded-md border px-2.5 py-1 transition-colors ${
              active
                ? "border-accent bg-accent font-medium text-black"
                : "border-white/20 bg-background-box/70 text-white/70 hover:border-accent hover:text-accent"
            }`}
          >
            {AWARDS[code].label}
          </Link>
        );
      })}
      <Link
        href="/seasons"
        className="rounded-md border border-white/20 bg-background-box/70 px-2.5 py-1 text-white/70 transition-colors hover:border-accent hover:text-accent"
      >
        Seasons
      </Link>
    </nav>
  );
}
