import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { PlayerLink } from "@/components/PlayerLink";
import { TeamLink } from "@/components/TeamLink";
import { SeasonSnapshotFilter } from "@/components/SeasonSnapshotFilter";
import { SimpleTable } from "@/components/SimpleTable";
import { TableOverlay } from "@/components/TableNav";
import type { ColumnDef } from "@/components/DataTable";
import { formatCurrency, formatScore } from "@/lib/format";
import {
  AWARDS,
  AWARD_ORDER,
  anchorId,
  fullLabel,
  teamOrdinal,
} from "@/lib/awards";
import {
  getAwardSeasons,
  getSeasonAwards,
  getSeasonChampion,
  getSeasonNetValueLeaders,
  type AwardBallotRow,
  type SeasonNetValueRow,
} from "@/lib/db/queries";

export const metadata = {
  title: "Seasons - The Net Values",
  description:
    "A snapshot of every NBA season — the champion, every award, and the best and worst Net Values of the year.",
};

/** Net Value and its league rank, the two columns every table here ends with. */
function netValueCells(score: number | null, rank: number | null) {
  return (
    <>
      <td className="px-3 py-1.5 text-right font-mono text-[0.8125rem] tabular-nums">
        {score === null ? "—" : formatScore(score)}
      </td>
      <td className="px-3 py-1.5 text-right font-mono text-[0.8125rem] tabular-nums text-black/50">
        {rank === null ? "—" : `#${rank}`}
      </td>
    </>
  );
}

/** A voted award's finishing order. The vote tallies live in the database but
 *  aren't shown — what the page is for is who won and what he was worth. */
function Ballot({ rows }: { rows: AwardBallotRow[] }) {
  return (
    <div className="sheet-scrollbar w-full max-w-full overflow-x-auto overscroll-x-contain rounded-lg border-2 border-accent bg-surface">
      <table className="w-max min-w-full text-sm text-black">
        <thead className="bg-surface border-b-2 border-accent">
          <tr>
            <th className="px-3 py-2 text-right font-medium text-black/40">#</th>
            <th className="px-3 py-2 text-left font-medium">Player</th>
            <th className="px-3 py-2 text-left font-medium">Team</th>
            <th
              className="px-3 py-2 text-right font-medium"
              title="Production minus what his pay expected of him, in VORP-like units."
            >
              Net Value
            </th>
            <th
              className="px-3 py-2 text-right font-medium"
              title="Where that Net Value placed him in the league that season."
            >
              NV Rank
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={r.playerId}
              className={`${i % 2 === 0 ? "bg-surface" : "bg-surface-alt"} hover:bg-surface-hover transition-colors`}
            >
              <td className="px-3 py-1.5 text-right font-mono text-[0.8125rem] tabular-nums text-black/40">
                {r.rank ?? "—"}
              </td>
              <td className="whitespace-nowrap px-3 py-1.5">
                {/* The winner is named above the table already, so the weight
                    here is what tells a shared award from a clear one. */}
                <span className={r.won ? "font-semibold" : ""}>
                  <PlayerLink id={r.playerId} name={r.name} />
                </span>
              </td>
              <td className="whitespace-nowrap px-3 py-1.5 font-mono text-[0.8125rem]">
                {r.team ? <TeamLink abbr={r.team} label={r.teamLabel} /> : "—"}
              </td>
              {netValueCells(r.netValueScore, r.seasonRank)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** One selected player, as a chip. `award-chip` is what lights the links up. */
function PlayerChip({ row }: { row: AwardBallotRow }) {
  return (
    <span className="award-chip inline-flex items-center gap-2 rounded-md border border-white/15 bg-background-box px-3 py-1.5 text-sm">
      <PlayerLink id={row.playerId} name={row.name} />
      {row.team && (
        <span className="font-mono text-xs text-white/40">
          <TeamLink abbr={row.team} label={row.teamLabel} />
        </span>
      )}
    </span>
  );
}

/** A tiered award: three teams of five, or however many a tie produced. */
function Teams({ rows }: { rows: AwardBallotRow[] }) {
  const tiers = [...new Set(rows.map((r) => r.teamNumber))].sort(
    (a, b) => (a ?? 0) - (b ?? 0),
  );
  return (
    <div className="flex flex-col gap-3">
      {tiers.map((tier) => (
        <div key={tier ?? "none"}>
          <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-white/40">
            {teamOrdinal(tier) || "Selected"} Team
          </div>
          <div className="flex flex-wrap gap-2">
            {rows
              .filter((r) => r.teamNumber === tier)
              .map((r) => (
                <PlayerChip key={r.playerId} row={r} />
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** All-Star: no tiers and no ballot, just who was selected. */
function Selections({ rows }: { rows: AwardBallotRow[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {[...rows]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((r) => (
          <PlayerChip key={r.playerId} row={r} />
        ))}
    </div>
  );
}

function netValueColumns(): ColumnDef<SeasonNetValueRow>[] {
  return [
    {
      key: "rank",
      label: "#",
      align: "right",
      render: (r) => (r.seasonRank === null ? "—" : `#${r.seasonRank}`),
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
      key: "salary",
      label: "Salary",
      align: "right",
      render: (r) => (r.salary === null ? "—" : formatCurrency(r.salary)),
    },
    {
      key: "netValue",
      label: "Net Value",
      align: "right",
      render: (r) =>
        r.netValueScore === null ? "—" : formatScore(r.netValueScore),
    },
  ];
}

export default async function SeasonsPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const [sp, seasons] = await Promise.all([searchParams, getAwardSeasons()]);
  if (seasons.length === 0) notFound();

  const season =
    sp.season && seasons.includes(sp.season) ? sp.season : seasons[0];
  const [byAward, champion, netValue] = await Promise.all([
    getSeasonAwards(season),
    getSeasonChampion(season),
    getSeasonNetValueLeaders(season),
  ]);

  return (
    <div className="mx-auto w-full min-w-0 max-w-350 p-6 text-white">
      <PageHeader
        title="Seasons"
        meta={<SeasonSnapshotFilter seasons={seasons} currentSeason={season} />}
      />

      <TableOverlay>
        <div className="flex flex-col gap-8">
          {champion && (
            <section className="min-w-0">
              <h2 className="text-lg font-semibold">Champion</h2>
              <div className="mb-2 min-h-5 text-sm text-white/60">
                {season}
              </div>
              <Link
                href={`/teams/${champion.abbr}`}
                className="inline-flex items-center gap-3 rounded-lg border-2 border-accent bg-background-box px-4 py-3 transition-colors hover:bg-accent hover:text-black"
              >
                <span aria-hidden="true" className="text-xl">
                  🏆
                </span>
                <span className="text-lg font-semibold">
                  {champion.eraName ?? champion.name}
                </span>
                {champion.wins !== null && champion.losses !== null && (
                  <span className="font-mono text-sm tabular-nums opacity-60">
                    {champion.wins}-{champion.losses}
                  </span>
                )}
              </Link>
            </section>
          )}

          {AWARD_ORDER.map((code) => {
            const rows = byAward.get(code);
            if (!rows || rows.length === 0) return null;
            const winners = rows.filter((r) => r.won);
            const { tiered, path } = AWARDS[code];
            const isSelection = code === "all_star";

            return (
              <section key={code} id={anchorId(code)} className="min-w-0 scroll-mt-20">
                <h2 className="text-lg font-semibold">
                  {/* Only the awards with a page of their own link out of the
                      heading; the rest are already showing everything they
                      have to show. */}
                  {path ? (
                    <Link href={path} className="hover:text-accent hover:underline">
                      {fullLabel(code, null)}
                    </Link>
                  ) : (
                    fullLabel(code, null)
                  )}
                </h2>
                <div className="mb-2 min-h-5 text-sm text-white/60">
                  {isSelection
                    ? `${winners.length} selected`
                    : tiered
                      ? `${winners.length} selected across ${
                          new Set(winners.map((r) => r.teamNumber)).size
                        } teams`
                      : // A tie is the interesting case, so the winner line
                        // names everyone rather than assuming there was one.
                        winners.map((r) => r.name).join(" & ") || "No winner"}
                </div>
                {isSelection ? (
                  <Selections rows={rows} />
                ) : tiered ? (
                  <Teams rows={winners} />
                ) : (
                  <Ballot rows={rows} />
                )}
              </section>
            );
          })}

          {netValue.top.length > 0 && (
            <section id="net-value" className="min-w-0 scroll-mt-20">
              <h2 className="text-lg font-semibold">
                <Link href="/net-value" className="hover:text-accent hover:underline">
                  Net Value
                </Link>
              </h2>
              <div className="mb-2 min-h-5 text-sm text-white/60">
                The best and worst returns on a contract in {season}.
              </div>
              <div className="flex w-full min-w-0 flex-col items-start gap-8 lg:flex-row">
                <SimpleTable
                  title="Top 10"
                  columns={netValueColumns()}
                  rows={netValue.top}
                  rowKey={(r) => r.playerId}
                  fit
                  emptyMessage="No scored seasons."
                />
                <SimpleTable
                  title="Bottom 10"
                  columns={netValueColumns()}
                  rows={netValue.bottom}
                  rowKey={(r) => r.playerId}
                  fit
                  emptyMessage="No scored seasons."
                />
              </div>
            </section>
          )}
        </div>
      </TableOverlay>
    </div>
  );
}
