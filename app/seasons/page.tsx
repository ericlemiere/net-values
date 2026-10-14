import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { PlayerLink } from "@/components/PlayerLink";
import { TeamLink } from "@/components/TeamLink";
import { SeasonSnapshotFilter } from "@/components/SeasonSnapshotFilter";
import { SimpleTable } from "@/components/SimpleTable";
import { GlossaryButton } from "@/components/GlossaryButton";
import { GLOSSARY, tooltip, type GlossaryEntry } from "@/lib/glossary";
import { TableOverlay } from "@/components/TableNav";
import type { ColumnDef } from "@/components/DataTable";
import { formatCurrency, formatScore, netValueClass } from "@/lib/format";
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
import { PAGE_COLUMN } from "@/lib/layout";
import { pageMetadata } from "@/lib/site";

/**
 * Each season is its own page as far as a search engine is concerned, so it
 * gets its own title and canonical. The bare /seasons shows the latest one but
 * stays canonical to itself, since which season that is moves every year.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const [sp, seasons] = await Promise.all([searchParams, getAwardSeasons()]);
  const season = sp.season && seasons.includes(sp.season) ? sp.season : null;
  if (!season)
    return pageMetadata({
      title: "NBA Seasons",
      description:
        "A snapshot of every NBA season: the champion, every award, and the best and worst Net Values of the year.",
      path: "/seasons",
    });
  return pageMetadata({
    title: `${season} NBA Season`,
    description: `The ${season} NBA season at a glance: the champion, MVP and every other award, the voting, and the players who most outperformed and underperformed their contracts.`,
    path: `/seasons?season=${encodeURIComponent(season)}`,
  });
}

/**
 * The page reads top to bottom as the season itself: who won it, who was worth
 * the most, who was honored, and only then how close each vote was.
 */

/** One winner a year, so they fit in the summary panel at the top. */
const VOTED: AwardCode[] = AWARD_ORDER.filter(
  (c) => !AWARDS[c].tiered && c !== "all_star",
);

/** Voting reads best with ROY before DPOY. */
const BALLOT_ORDER: AwardCode[] = [
  "mvp",
  "roy",
  "dpoy",
  ...VOTED.filter((c) => c !== "mvp" && c !== "roy" && c !== "dpoy"),
];

/** The selected teams. Ordered by standing rather than by the scarcity `rank`
 *  used for badges — All-Rookie belongs beside the other teams. All-Star isn't
 *  here: it's a roster rather than a team, and closes the page on its own. */
const SQUADS: AwardCode[] = ["all_nba", "all_defense", "all_rookie"];

/**
 * A band heading.
 *
 * The accent rule above it is what separates the page's parts. A hairline
 * would have done the job, but yellow is the site's one structural color and
 * these are the only divisions on a long page — it earns its place here in a
 * way another gray line would not.
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
        rule ? "border-t border-accent/50 pt-8" : ""
      }`}
    >
      <div className="mb-5">
        {/* Louder than the table titles under it, so a long page reads as a
            handful of parts: big, heavy, set in capitals, and keyed to the
            rule above by a short accent bar. */}
        <h2 className="flex items-center gap-3 text-2xl font-bold uppercase tracking-tight md:text-3xl">
          {title}
        </h2>
        {caption && <div className="mt-1 text-sm text-white/55">{caption}</div>}
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
                className="text-xs font-medium uppercase tracking-wide text-accent/80 underline underline-offset-2 transition-colors hover:text-accent"
              >
                {AWARDS[code].full}
              </Link>
              {/* A shared award is two names, not one, so the winner line is a
                  list however short it usually is. */}
              {rows.map((r) => (
                <div
                  key={r.playerId}
                  className="flex flex-col md:flex-row md:items-center gap-2 award-chip mt-0.5 min-w-0"
                >
                  <span className="text-base font-medium">
                    <PlayerLink id={r.playerId} name={r.name} />
                  </span>
                  <span className="font-mono text-xs text-white/40">
                    <TeamLink abbr={r.team} label={r.teamLabel} />
                    {r.netValueScore !== null && (
                      <span className="ml-2 text-white/60">
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
        {score === null ? (
          "—"
        ) : (
          <span className={netValueClass(score)}>{formatScore(score)}</span>
        )}
      </td>
      <td className="px-3 py-1.5 text-right font-mono text-[0.8125rem] tabular-nums text-black/50">
        {rank === null ? "—" : `#${rank}`}
      </td>
    </>
  );
}

/** The ballot's two explained headings, shared by their tooltips and the
 *  glossary so the two can't drift apart. */
const BALLOT_NET_VALUE: GlossaryEntry = {
  key: "netValueScore",
  label: "Net Value",
  ...GLOSSARY.netValueScore,
};
const BALLOT_NV_RANK: GlossaryEntry = {
  key: "netValueRank",
  label: "NV Rank",
  ...GLOSSARY.netValueRank,
};

/**
 * The table every award on the page is shown in: a voted award's finishing
 * order, one tier of a selected team, or the All-Star roster. The vote tallies
 * live in the database but aren't shown — what the page is for is who was
 * honored and what he was worth.
 *
 * `ranked` adds the finishing-place column, which only a ballot has.
 */
function AwardTable({
  rows,
  ranked = false,
  title,
}: {
  rows: AwardBallotRow[];
  ranked?: boolean;
  title?: React.ReactNode;
}) {
  return (
    // Five columns don't need the whole page. Capped so the table reads as a
    // block of related numbers rather than a row of figures marooned at either
    // edge of a wide monitor.
    <div className="w-full max-w-2xl">
      <div className="mb-2 flex items-end justify-between gap-3">
        {title ? (
          <h3 className="font-semibold tracking-tight">{title}</h3>
        ) : (
          <span />
        )}
        <GlossaryButton entries={[BALLOT_NET_VALUE, BALLOT_NV_RANK]} />
      </div>
      {/* A ballot runs to twenty-odd names in a close year, so it stops at
          eleven rows and scrolls under its header rather than pushing the
          rest of the page down. 24.5rem is the header, eleven rows, and the
          frame. */}
      <div
        className={`sheet-scrollbar w-full overflow-x-auto overscroll-x-contain rounded-lg border-2 border-accent bg-surface ${
          ranked ? "max-h-98 overflow-y-auto overscroll-y-contain" : ""
        }`}
      >
        <table className="w-max min-w-full text-sm text-black">
          {/* The rule is a shadow, not a border: in a collapsed table the
              border belongs to the table and would scroll away from a sticky
              header. */}
          <thead className="sticky top-0 z-10 bg-surface shadow-[inset_0_-2px_0_var(--color-accent)]">
            <tr>
              {ranked && (
                <th className="px-3 py-2 text-right font-medium text-black/40">
                  #
                </th>
              )}
              <th className="px-3 py-2 text-left font-medium">Player</th>
              <th className="px-3 py-2 text-left font-medium">Team</th>
              <th
                className="px-3 py-2 text-right font-medium"
                title={tooltip(BALLOT_NET_VALUE)}
              >
                {BALLOT_NET_VALUE.label}
              </th>
              <th
                className="px-3 py-2 text-right font-medium"
                title={tooltip(BALLOT_NV_RANK)}
              >
                {BALLOT_NV_RANK.label}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.playerId}
                className={`${i % 2 === 0 ? "bg-surface" : "bg-surface-alt"} hover:bg-surface-hover transition-colors`}
              >
                {ranked && (
                  <td className="px-3 py-1.5 text-right font-mono text-[0.8125rem] tabular-nums text-black/40">
                    {r.rank ?? "—"}
                  </td>
                )}
                <td className="whitespace-nowrap px-3 py-1.5">
                  {/* On a ballot the winner is named above the table already,
                    so the weight is what tells a shared award from a clear
                    one. Everyone on a selected team won, so none is bold. */}
                  <span className={ranked && r.won ? "font-semibold" : ""}>
                    <PlayerLink id={r.playerId} name={r.name} />
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-1.5 font-mono text-[0.8125rem]">
                  {r.team ? (
                    <TeamLink abbr={r.team} label={r.teamLabel} />
                  ) : (
                    "—"
                  )}
                </td>
                {netValueCells(r.netValueScore, r.seasonRank)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** A tiered award: two or three teams of five, or however many a tie
 *  produced, side by side so the drop from team to team reads across the row. */
function Teams({ rows, columns }: { rows: AwardBallotRow[]; columns: 2 | 3 }) {
  const tiers = [...new Set(rows.map((r) => r.teamNumber))].sort(
    (a, b) => (a ?? 0) - (b ?? 0),
  );
  return (
    <div
      className={`grid min-w-0 gap-8 ${columns === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}
    >
      {tiers.map((tier) => (
        <AwardTable
          key={tier ?? "none"}
          title={`${teamOrdinal(tier) || "Selected"} Team`}
          rows={rows.filter((r) => r.teamNumber === tier)}
        />
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
        r.netValueScore === null ? (
          "—"
        ) : (
          <span className={netValueClass(r.netValueScore)}>
            {formatScore(r.netValueScore)}
          </span>
        ),
    },
  ];
}

/** A squad's block: a table per numbered team. */
function SquadBand({
  code,
  rows,
}: {
  code: AwardCode;
  rows: AwardBallotRow[];
}) {
  return (
    <Band id={anchorId(code)} title={fullLabel(code, null)}>
      {/* Only All-NBA has a third team; the others take the page in halves,
          like the rest of its tables. */}
      <Teams
        rows={rows.filter((r) => r.won)}
        columns={code === "all_nba" ? 3 : 2}
      />
    </Band>
  );
}

/**
 * All-Star, as two tables. Through 2017, and again in 2024, the game was East
 * against West and so was the selection, so the tables are the two
 * conferences. Every other year — captains' drafts, the four-team tournament —
 * there's no side worth showing, so it's the roster alphabetically, split in
 * half. A season where any one player's side is unknown is treated the same
 * way rather than shown with a hole in it.
 */
function AllStarBand({ rows }: { rows: AwardBallotRow[] }) {
  const sorted = rows
    .filter((r) => r.won)
    .sort((a, b) => a.name.localeCompare(b.name));
  const byConference = sorted.every((r) => r.conference);
  const half = Math.ceil(sorted.length / 2);
  const tables: { title?: string; rows: AwardBallotRow[] }[] = byConference
    ? [
        { title: "East", rows: sorted.filter((r) => r.conference === "East") },
        { title: "West", rows: sorted.filter((r) => r.conference === "West") },
      ]
    : [{ rows: sorted.slice(0, half) }, { rows: sorted.slice(half) }];

  return (
    <Band
      id={anchorId("all_star")}
      title={fullLabel("all_star", null)}
      caption={
        byConference
          ? undefined
          : sorted.some((r) => r.conference)
            ? "Listed alphabetically, since not every player's conference is known for this season."
            : "Listed alphabetically, since this season's game wasn't East vs. West."
      }
    >
      <div className="grid min-w-0 gap-8 lg:grid-cols-2">
        {tables.map((t, i) => (
          <AwardTable key={t.title ?? i} title={t.title} rows={t.rows} />
        ))}
      </div>
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

  const ballots = BALLOT_ORDER.filter((code) => byAward.get(code)?.length);

  return (
    <div className={PAGE_COLUMN}>
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
                  title={`Top 10 Net Values for ${season}`}
                  columns={netValueColumns()}
                  rows={netValue.top}
                  rowKey={(r) => r.playerId}
                  emptyMessage="No scored seasons."
                />
                <SimpleTable
                  title={`Bottom 10 Net Values for ${season}`}
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
            <Band id="voting" title="Award Votes">
              <div className="grid min-w-0 gap-8 lg:grid-cols-2">
                {ballots.map((code) => (
                  <section
                    key={code}
                    id={anchorId(code)}
                    className="min-w-0 scroll-mt-20"
                  >
                    <AwardTable
                      rows={byAward.get(code)!}
                      ranked
                      title={
                        <Link
                          href={AWARDS[code].path!}
                          className="transition-colors hover:text-accent underline underline-offset-3 underline-decoration-0.25 hover:underline-offset-4"
                        >
                          {fullLabel(code, null)}
                        </Link>
                      }
                    />
                  </section>
                ))}
              </div>
            </Band>
          )}

          {byAward.get("all_star")?.length ? (
            <AllStarBand rows={byAward.get("all_star")!} />
          ) : null}
        </div>
      </TableOverlay>
    </div>
  );
}
