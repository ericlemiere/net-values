import Image from "next/image";

/**
 * NBA.com serves headshots off a public CDN keyed by the same person id the
 * nba_api returns, which is what `players.nba_person_id` holds — so no
 * scraping or storage is needed, the id alone builds the URL.
 *
 * Players with no headshot on file (most of the pre-1990s roster, and anyone
 * we never matched to an nba_person_id) get a generic silhouette back at
 * HTTP 200 rather than a 404, so there's no way to detect the gap from the
 * response. That silhouette reads fine as a placeholder, so we render it.
 */
const HEADSHOT_BASE = "https://cdn.nba.com/headshots/nba/latest";

/** Native headshot aspect ratio; 260x190 is the smallest size NBA.com serves. */
const RATIO = 260 / 190;

export function PlayerHeadshot({
  nbaPersonId,
  name,
  height = 95,
}: {
  nbaPersonId: number | null;
  name: string;
  height?: number;
}) {
  const width = Math.round(height * RATIO);

  return (
    <div
      className="shrink-0 overflow-hidden rounded-lg border border-white/15 bg-white/5"
      style={{ width, height }}
    >
      {nbaPersonId !== null && (
        <Image
          src={`${HEADSHOT_BASE}/1040x760/${nbaPersonId}.png`}
          alt={`${name} headshot`}
          width={width}
          height={height}
          preload
          className="h-full w-full object-cover object-top"
        />
      )}
    </div>
  );
}
