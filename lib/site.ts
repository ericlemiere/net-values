import type { Metadata } from "next";

export const SITE_NAME = "The Net Values";

export const SITE_DESCRIPTION =
  "NBA player value measured against salary. Net Value compares what every player produced on the court with what his contract paid for, for every season since 1990-91.";

/**
 * The absolute origin every canonical URL, sitemap entry and social card is
 * built from. Set NEXT_PUBLIC_SITE_URL once the site has its own domain; until
 * then Vercel's production hostname stands in, and local dev falls back to
 * localhost so nothing breaks off-platform.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000")
).replace(/\/$/, "");

/**
 * Title, description, canonical and social cards for one page.
 *
 * Next merges metadata shallowly, so a page that sets `openGraph` at all
 * replaces the layout's whole object rather than extending it. Building every
 * page's cards here keeps the image and site name from silently dropping out
 * of one of them.
 *
 * `path` is the canonical: the list pages are reachable under endless
 * sort/page/filter query strings, and pointing them all at one URL keeps
 * search engines from treating each as a duplicate.
 */
export function pageMetadata({
  title,
  description,
  path,
  image,
}: {
  title: string;
  description: string;
  path: string;
  /** Replaces the logo on the social card, e.g. a player's headshot. */
  image?: { url: string; width: number; height: number; alt: string };
}): Metadata {
  const fullTitle = `${title} - ${SITE_NAME}`;
  const card = image ?? {
    url: "/tnv2.png",
    width: 1254,
    height: 1254,
    alt: SITE_NAME,
  };
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: fullTitle,
      description,
      url: path,
      siteName: SITE_NAME,
      type: "website",
      locale: "en_US",
      images: [card],
    },
    twitter: {
      card: "summary",
      title: fullTitle,
      description,
      images: [card.url],
    },
  };
}

/** A JSON-LD payload, escaped so a stray `<` in a name can't close the tag. */
export function jsonLd(data: object) {
  return { __html: JSON.stringify(data).replace(/</g, "\\u003c") };
}
