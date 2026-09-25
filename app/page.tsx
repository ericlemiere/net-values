import type { Metadata } from "next";
import { HomeIntro } from "@/components/HomeIntro";
import { SITE_DESCRIPTION, SITE_NAME, pageMetadata } from "@/lib/site";

// The intro animates on the client, so it lives in its own component and this
// stays a server file that can carry the page's metadata.
const base = pageMetadata({
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
  path: "/",
});

export const metadata: Metadata = {
  ...base,
  // The home page is the brand itself; "The Net Values - The Net Values"
  // would read as a mistake.
  title: { absolute: `${SITE_NAME}: NBA Player Value vs. Salary` },
};

export default function Home() {
  return <HomeIntro />;
}
