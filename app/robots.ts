import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * AI crawlers, for training and for answer engines alike. They're turned away
 * from /equation outright. Search engines aren't: they have to be allowed to
 * fetch the page to read its noindex, and a URL blocked here can still be
 * indexed bare from a link.
 */
const AI_CRAWLERS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "Bytespider",
  "CCBot",
  "Meta-ExternalAgent",
  "Amazonbot",
  "cohere-ai",
  "DuckAssistBot",
  "MistralAI-User",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // The search endpoint is JSON for the header's search box, not a page.
        disallow: "/api/",
      },
      {
        userAgent: AI_CRAWLERS,
        allow: "/",
        disallow: ["/api/", "/equation"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
