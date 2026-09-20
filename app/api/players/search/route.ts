import type { NextRequest } from "next/server";
import { searchPlayers } from "@/lib/db/queries";

// Feeds the header type-ahead. Reads the query off the request, so it always
// runs at request time rather than being prerendered.
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const players = await searchPlayers(q);
  return Response.json({ players });
}
