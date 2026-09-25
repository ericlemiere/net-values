import type { NextRequest } from "next/server";
import { searchPlayers, searchTeams } from "@/lib/db/queries";

// Feeds the header type-ahead. Reads the query off the request, so it always
// runs at request time rather than being prerendered.
//
// Teams and players are returned as separate lists rather than one merged,
// ranked list: they are ranked by different things (a franchise has no career
// span to sort by) and the dropdown shows them as labeled groups anyway.
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  // The /price-check picker only wants players, so it skips the team query.
  const playersOnly = request.nextUrl.searchParams.get("scope") === "players";
  const [teams, players] = await Promise.all([
    playersOnly ? [] : searchTeams(q),
    searchPlayers(q),
  ]);
  return Response.json({ teams, players });
}
