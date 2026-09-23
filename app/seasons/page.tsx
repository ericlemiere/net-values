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
  type AwardCode,
} from "@/lib/awards";
import {
  getAwardSeasons,
  getSeasonAwards,
  getSeasonChampion,
  getSeasonNetValueLeaders,
  type AwardBallotRow,
  type SeasonChampion,
  type SeasonNetValueRow,
} from "@/lib/db/queries";

export const metadata = {
  title: "Seasons - The Net Values",
  description:
    "A snapshot of every NBA season — the champion, every award, and the best and worst Net Values of the year.",
};

/**
 * The page reads top to bottom as the season itself: who won it, who was worth
 * the most, who was honoured, and only then how close each vote was.
 */

/** One winner a year, so they fit in the summary panel at the top. */
const VOTED: AwardCode[] = AWARD_ORDER.filter(
  (c) => !AWARDS[c].tiered && c !== "all_star",
);

/** The squads. Ordered by standing rather than by the scarcity `rank` used for
 *  badges — All-Rookie belongs beside the other teams, and All-Star last. */
const SQUADS: AwardCode[] = [
  "all_nba",
  "all_defense",
  "all_rookie",
  "all_star",
];

/**
 * A band heading.
 *
 * The accent rule above it is what separates the page's parts. A hairline
 * would have done the job, but yellow is the site's one structural colour and
 * these are the only divisions on a long page — it earns its place here in a
 * way another grey line would not.
 *
 * The band straight under the recap panel passes `rule={false}`: that panel is
 * already bounded by an accent border of its own, and a second yellow line a
 * few pixels below it read as a double rule rather than a division.
 */
function Band({
  title,
  caption,
  href,
  id,
  rule = true,
  children,
}: {
  title: string;
  caption?: string;
  href?: string | null;
  id?: string;
  rule?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={`min-w-0 scroll-mt-20 ${
        rule ? "border-t-2 border-accent pt-5" : ""
      }`}
    >
      <div className="mb-4">
        <h2 className="text-lg font-semibold tracking-tight">
          {href ? (
            <Link href={href} className="transition-colors hover:text-accent">
              {title}
              <span aria-hidden="true" className="ml-1 text-white/30">
                →
              </span>
            </Link>
          ) : (
            title
          )}
        </h2>
        {caption && (
          <div className="mt-0.5 text-sm text-white/55">{caption}</div>
        )}
      </div>
      {children}
    </section>
  );
}

/**
 * The season in one panel: who won it and who won everything else.
 *
 * All of this is a single line of fact per award, so a panel of rows says it
 * faster than five headed sections would, and puts the answers above the fold
 * where the ballots underneath are the supporting detail rather than the lead.
 */
function SummaryPanel({
  season,
  champion,
  byAward,
}: {
  season: string;
  champion: SeasonChampion | null;
  byAward: Map<AwardCode, AwardBallotRow[]>;
}) {
  const winners = VOTED.map((code) => ({
    code,
    rows: (byAward.get(code) ?? []).filter((r) => r.won),
  })).filter((w) => w.rows.length > 0);

  return (
    <div className="rounded-xl border-2 border-accent bg-background-box p-5 md:p-6">
      {champion && (
        <Link
          href={`/teams/${champion.abbr}`}
          className="group flex flex-wrap items-baseline gap-x-3 gap-y-1"
        >
          <span aria-hidden="true" className="text-2xl">
            🏆
          </span>
          <span className="text-2xl font-semibold tracking-tight transition-colors group-hover:text-accent">
            {champion.eraName ?? champion.name}
          </span>
          <span className="text-sm text-white/50">
            {season} champions
            {champion.wins !== null && champion.losses !== null && (
              <span className="ml-2 font-mono tabular-nums">
                {champion.wins}-{champion.losses}
              </span>
            )}
          </span>
        </Link>
      )}

      {winners.length > 0 && (
        <div
          className={`grid gap-x-8 gap-y-4 sm:grid-cols-2 xl:grid-cols-3 ${
            champion ? "mt-5 border-t border-accent/25 pt-5" : ""
          }`}
        >
          {winners.map(({ code, rows }) => (
            <div key={code} className="min-w-0 mt-4 md:mt-1">
              <Link
                href={AWARDS[code].path ?? `#${anchorId(code)}`}
                className="text-xs font-medium uppercase tracking-wide text-accent/80 transition-colors hover:text-accent"
              >
                {AWARDS[code].full}
              </Link>
              {/* A shared award is two names, not one, so the winner line is a
                  list however short it usually is. */}
              {rows.map((r) => (
                <div key={r.playerId} className="flex flex-col md:flex-row md:items-center gap-2 award-chip mt-0.5 min-w-0">
                  <span className="text-base font-medium">
                    <PlayerLink id={r.playerId} name={r.name} />
                  </span>
                  <span className="font-mono text-xs text-white/40">
                    <TeamLink abbr={r.team} label={r.teamLabel} />
                    {r.netValueScore !== null && (
                      <span className="ml-2 border px-2 py-1 bg-white/10 text-white/60">
                        {formatScore(r.netValueScore)} NV
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
    // Five columns don't need the whole page. Capped so the table reads as a
    // block of related numbers rather than a row of figures marooned at either
    // edge of a wide monitor.
    <div className="sheet-scrollbar w-full max-w-2xl overflow-x-auto overscroll-x-contain rounded-lg border-2 border-accent bg-surface">
      <table className="w-max min-w-full text-sm text-black">
        <thead className="bg-surface border-b-2 border-accent">
          <tr>
            <th className="px-3 py-2 text-right font-medium text-black/40">
              #
            </th>
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

/** A squad's block: the numbered teams, or a flat list for All-Star. */
function SquadBand({
  code,
  rows,
}: {
  code: AwardCode;
  rows: AwardBallotRow[];
}) {
  const winners = rows.filter((r) => r.won);
  const tiers = new Set(winners.map((r) => r.teamNumber)).size;
  return (
    <Band
      id={anchorId(code)}
      title={fullLabel(code, null)}
      caption={
        code === "all_star"
          ? `${winners.length} selected`
          : `${winners.length} selected across ${tiers} teams`
      }
    >
      {code === "all_star" ? (
        <Selections rows={rows} />
      ) : (
        <Teams rows={winners} />
      )}
    </Band>
  );
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

  const ballots = VOTED.filter((code) => byAward.get(code)?.length);

  return (
    <div className="mx-auto w-full min-w-0 max-w-350 p-6 text-white">
      <PageHeader
        title="Seasons"
        meta={<SeasonSnapshotFilter seasons={seasons} currentSeason={season} />}
      />

      <TableOverlay>
        <div className="flex flex-col gap-10">
          <SummaryPanel season={season} champion={champion} byAward={byAward} />

          {netValue.top.length > 0 && (
            <Band
              id="net-value"
              rule={false}
              href="/net-value"
              title="Net Value"
              caption={`The best and worst returns on a contract in ${season}.`}
            >
              <div className="grid min-w-0 gap-8 lg:grid-cols-2">
                <SimpleTable
                  title="Top 10"
                  columns={netValueColumns()}
                  rows={netValue.top}
                  rowKey={(r) => r.playerId}
                  emptyMessage="No scored seasons."
                />
                <SimpleTable
                  title="Bottom 10"
                  columns={netValueColumns()}
                  rows={netValue.bottom}
                  rowKey={(r) => r.playerId}
                  emptyMessage="No scored seasons."
                />
              </div>
            </Band>
          )}

          {SQUADS.filter((code) => byAward.get(code)?.length).map((code) => (
            <SquadBand key={code} code={code} rows={byAward.get(code)!} />
          ))}

          {ballots.length > 0 && (
            <Band
              id="voting"
              title="Voting"
              caption="Everyone who drew a vote, in finishing order."
            >
              <div className="grid min-w-0 gap-8 lg:grid-cols-2">
                {ballots.map((code) => (
                  <section
                    key={code}
                    id={anchorId(code)}
                    className="min-w-0 scroll-mt-20"
                  >
                    <h3 className="mb-0.5 font-semibold tracking-tight">
                      <Link
                        href={AWARDS[code].path!}
                        className="transition-colors hover:text-accent"
                      >
                        {fullLabel(code, null)}
                        <span aria-hidden="true" className="ml-1 text-white/30">
                          →
                        </span>
                      </Link>
                    </h3>
                    <div className="mb-2 text-sm text-white/55">
                      {byAward
                        .get(code)!
                        .filter((r) => r.won)
                        .map((r) => r.name)
                        .join(" & ") || "No winner"}
                    </div>
                    <Ballot rows={byAward.get(code)!} />
                  </section>
                ))}
              </div>
            </Band>
          )}
        </div>
      </TableOverlay>
    </div>
  );
}
