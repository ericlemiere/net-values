import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";
import { DATA_TAG } from "@/lib/db/cached";

// Called by the scraper after it writes (scraper/revalidate.py), so the site
// picks up new numbers right away instead of when the day-long cache runs out.
//
// "max" marks the data stale rather than dropping it: the next visitor to each
// page still gets an instant response and the fresh query runs behind it.
export async function POST(request: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  revalidateTag(DATA_TAG, "max");
  return Response.json({ revalidated: DATA_TAG });
}
