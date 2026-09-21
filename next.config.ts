import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
