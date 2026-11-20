import { getDataUpdatedAt } from "@/lib/db/queries";

// When the data last changed, for components/DataFreshness.tsx: a page left
// open, or one Safari restores from its own copy, compares this against the
// date it was rendered with and refreshes itself if the data has moved on.
// Read through the data cache, so a check costs Neon nothing; the revalidate
// after each job expires that cache outright, so this is never behind it.
export async function GET() {
  return Response.json(
    { updatedAt: await getDataUpdatedAt() },
    { headers: { "cache-control": "no-store" } },
  );
}
