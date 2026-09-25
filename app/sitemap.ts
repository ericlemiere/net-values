import type { MetadataRoute } from "next";
import { getAwardSeasons, getSitemapEntries } from "@/lib/db/queries";
import { SITE_URL } from "@/lib/site";

// The data refreshes once a day, so the list of pages can too.
export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [{ playerIds, teamAbbrs }, seasons] = await Promise.all([
    getSitemapEntries(),
    getAwardSeasons(),
  ]);

  const section = (
    path: string,
    priority: number,
    changeFrequency: "daily" | "weekly" | "monthly" | "yearly",
  ) => ({ url: `${SITE_URL}${path}`, priority, changeFrequency });

  return [
    section("/", 1, "daily"),
    section("/salaries", 0.9, "daily"),
    section("/stats", 0.9, "daily"),
    section("/teams", 0.8, "daily"),
    section("/net-value", 0.8, "weekly"),
    section("/seasons", 0.7, "weekly"),
    section("/price-check", 0.6, "monthly"),
    ...["/mvp", "/dpoy", "/roy", "/6moy", "/mip"].map((p) =>
      section(p, 0.6, "monthly"),
    ),
    // Past seasons are finished, so only the newest is still moving.
    ...seasons.map((s, i) =>
      section(
        `/seasons?season=${encodeURIComponent(s)}`,
        0.5,
        i === 0 ? "weekly" : "yearly",
      ),
    ),
    ...teamAbbrs.map((a) => section(`/teams/${a}`, 0.7, "daily")),
    ...playerIds.map((id) => section(`/players/${id}`, 0.6, "weekly")),
  ];
}
