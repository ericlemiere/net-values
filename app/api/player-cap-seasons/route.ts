import type { NextRequest } from "next/server";
import { getPlayerCapSeasons } from "@/lib/db/queries";

// Feeds the /cap-converter player picker: once a player is chosen, the season
// dropdown narrows to the seasons he was paid in, and switching back to a
// salary or a share carries his pay across.
export async function GET(request: NextRequest) {
  const id = Number(request.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return Response.json({ seasons: [] }, { status: 400 });
  }
  const seasons = await getPlayerCapSeasons(id);
  return Response.json({
    seasons: seasons.map(({ season, salary }) => ({ season, salary })),
  });
}
