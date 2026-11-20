import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";
import { DATA_TAG } from "@/lib/db/cached";

// Called by the scraper after it writes (scraper/revalidate.py), so the site
// picks up new numbers right away instead of when the day-long cache runs out.
//
// Expired outright ({ expire: 0 }), not marked stale with "max": under "max"
// the first visitor to each page after a job was served the old numbers while
// the new ones loaded behind them. Now that request waits for fresh data
// instead, and scraper/revalidate.py makes the first request to the home page
// itself, so a visitor there doesn't wait either.
export async function POST(request: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  revalidateTag(DATA_TAG, { expire: 0 });
  return Response.json({ revalidated: DATA_TAG });
}
