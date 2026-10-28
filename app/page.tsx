import type { Metadata } from "next";
import Link from "next/link";
import { HomeIntro } from "@/components/HomeIntro";
import { PlayerHeadshot } from "@/components/PlayerHeadshot";
import { SiteSearch } from "@/components/SiteSearch";
import {
  getDataUpdatedAt,
  getHomeNetValueLeaders,
  type HomeNetValueRow,
  type HomeNetValueSeason,
} from "@/lib/db/queries";
import {
  formatCompactCurrency,
  formatScore,
  formatUpdated,
  netValueClass,
} from "@/lib/format";
import { SITE_NAME, pageMetadata } from "@/lib/site";

// The intro animates on the client, so that part lives in its own component
// and this stays a server file that can carry the metadata and fetch the lists.
const base = pageMetadata({
  title: SITE_NAME,
  description:
    "The NBA's best values and worst contracts this season and last, ranked by Net Value: what each player produced on the court against what his salary paid for.",
  path: "/",
});

export const metadata: Metadata = {
  ...base,
  // The home page is the brand itself; "The Net Values - The Net Values"
  // would read as a mistake.
  title: {
    absolute: `${SITE_NAME}: NBA Player Value vs. Salary`,
  },
};

const boxClass = "rounded-md border border-white/15 bg-background-box/90";

/** "Rises in" step for each block; see `.home-in` in globals.css. */
function step(i: number) {
  return { "--i": i } as React.CSSProperties;
}

function LeaderList({
  title,
  rows,
  href,
}: {
  title: string;
  rows: HomeNetValueRow[];
  href: string;
}) {
  return (
    <section className="min-w-0">
      <h3 className="mb-2 text-lg font-semibold">{title}</h3>
      <ol className={`${boxClass} divide-y divide-white/10 overflow-hidden`}>
        {rows.map((r) => (
          <li key={r.playerId}>
            <Link
              href={`/players/${r.playerId}`}
              className="flex items-center gap-3 pr-3 transition-colors hover:bg-white/5 sm:px-3 sm:py-2"
            >
              <span className="hidden w-7 shrink-0 text-right font-mono text-sm tabular-nums text-white/50 sm:block">
                #{r.seasonRank}
              </span>
              {/* On a phone the headshot fills the row's left end, top to
                  bottom and flush to the edge, with the rank over its corner,
                  where it reads as the player's and costs no width. */}
              <span className="relative shrink-0 sm:hidden">
                <PlayerHeadshot
                  nbaPersonId={r.nbaPersonId}
                  name={r.name}
                  height={76}
                  frame={false}
                />
                <span className="absolute bottom-0 left-0 rounded-tr-md bg-black/80 px-1.5 py-0.5 font-mono text-base font-semibold leading-tight tabular-nums text-white">
                  #{r.seasonRank}
                </span>
              </span>
              <span className="hidden sm:block">
                <PlayerHeadshot
                  nbaPersonId={r.nbaPersonId}
                  name={r.name}
                  height={40}
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold leading-tight sm:truncate">
                  {r.name}
                </span>
                <span className="mt-0.5 block truncate text-xs text-white/50">
                  {r.teamLabel ?? r.team ?? "—"} &middot;{" "}
                  {formatCompactCurrency(r.salary)}
                </span>
              </span>
              <span
                className={`shrink-0 font-mono text-lg tabular-nums sm:text-base ${netValueClass(r.netValueScore)}`}
              >
                {formatScore(r.netValueScore)}
              </span>
            </Link>
          </li>
        ))}
      </ol>
      <Link
        href={href}
        className="mt-2 inline-block text-sm text-white/60 transition-colors hover:text-accent"
      >
        Full list &rarr;
      </Link>
    </section>
  );
}

/** "Full list" goes to the season's salaries, sorted by Net Value. */
function salariesBy(season: string, dir: "asc" | "desc") {
  return `/salaries?season=${encodeURIComponent(season)}&sort=netValueScore&dir=${dir}`;
}

function SeasonLeaders({
  title,
  data,
  note,
  style,
}: {
  title: string;
  data: HomeNetValueSeason;
  /** Trails the season label, e.g. when the numbers were last updated. */
  note?: string;
  style: React.CSSProperties;
}) {
  return (
    <section className="home-in mb-10" style={style}>
      {/* The site's chapter marker (see SectionHeading), with the note beside
          the title on a wide screen and dropped under it on a phone. */}
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1">
        <h2 className="min-w-0 text-xl font-semibold tracking-[0.15em] text-accent uppercase sm:shrink-0 sm:text-2xl sm:tracking-[0.2em] md:text-3xl">
          {title}
        </h2>
        {note && (
          <p className="order-last w-full text-sm text-white/50 sm:order-none sm:w-auto">
            {note}
          </p>
        )}
        <div className="h-px min-w-0 flex-1 bg-accent/25" />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <LeaderList
          title={`Best Values of ${data.season}`}
          rows={data.top}
          href={salariesBy(data.season, "desc")}
        />
        <LeaderList
          title={`Worst Values of ${data.season}`}
          rows={data.bottom}
          href={salariesBy(data.season, "asc")}
        />
      </div>
    </section>
  );
}

export default async function Home() {
  const [[latest, prior], updatedAt] = await Promise.all([
    getHomeNetValueLeaders(),
    getDataUpdatedAt(),
  ]);
  // Named by where they sit relative to today rather than by year, so the
  // labels move along on their own: once a new season's first games are
  // scored it becomes the current one, and in the offseason before that the
  // latest season is already the last one.
  const [latestTitle, priorTitle] = latest?.inProgress
    ? ["Current Season So Far", "Last Season"]
    : ["Last Season", "Two Seasons Ago"];

  return (
    <HomeIntro>
      <h1
        className="home-in mb-3 text-4xl md:text-6xl font-semibold tracking-tight"
        style={step(1)}
      >
        The Net Values
      </h1>

      {/* Raised above the blocks after it: the rise-in leaves a transform on
          each one, which makes each its own stacking context, so without this
          they'd paint over the search results dropping down from here. */}
      <div className="home-in relative z-10 mb-8 max-w-xl" style={step(2)}>
        <p className="text-xl md:text-2xl font-semibold leading-snug tracking-tight">
          Every NBA contract since 1990-91, weighed against what the player
          produced.
        </p>
        <SiteSearch
          className="mt-5 w-full"
          inputClassName="px-4 py-3 md:text-base"
        />
      </div>

      <p
        className="home-in mb-8 max-w-2xl text-white/70 md:text-lg"
        style={step(3)}
      >
        <span className="font-semibold text-white">Net Value</span> is
        production minus pay. Zero is the going rate, above it is a bargain, and
        below it is an overpay.{" "}
        <Link
          href="/net-value"
          className="whitespace-nowrap text-white underline decoration-accent underline-offset-4 transition-colors hover:text-accent"
        >
          How it works &rarr;
        </Link>
      </p>

      {latest && (
        <SeasonLeaders
          title={latestTitle}
          data={latest}
          note={updatedAt ? `Updated ${formatUpdated(updatedAt)}` : undefined}
          style={step(4)}
        />
      )}
      {prior && (
        <SeasonLeaders title={priorTitle} data={prior} style={step(5)} />
      )}
    </HomeIntro>
  );
}
