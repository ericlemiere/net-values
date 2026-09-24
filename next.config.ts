import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * /advanced-stats was its own route until the three player tables were put
   * behind one toggle on /stats. Kept as a redirect rather than deleted
   * outright so existing links and bookmarks still land somewhere — Next
   * carries the original query string across, so a saved season/team/sort
   * survives the move.
   *
   * Temporary (307) rather than permanent: a 308 is cached by the browser
   * forever, and this is an internal reshuffle that isn't worth making
   * irreversible.
   */
  async redirects() {
    return [
      {
        source: "/advanced-stats",
        destination: "/stats?type=advanced",
        permanent: false,
      },
    ];
  },
  images: {
    // Player headshots come straight off NBA.com's CDN, keyed by the
    // nba_person_id we already store on each player.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.nba.com",
        port: "",
        pathname: "/headshots/nba/latest/**",
        search: "",
      },
    ],
  },
};

export default nextConfig;
