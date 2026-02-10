import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { cache, CACHE_KEYS, CACHE_TTL } from "@/lib/cache";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const { matchId } = await params;

  // Check cache first
  const cacheKey = CACHE_KEYS.match(matchId);
  const cached = cache.get(cacheKey);
  if (cached) {
    return NextResponse.json(cached, {
      headers: { "X-Cache": "HIT", "Cache-Control": "public, max-age=60" },
    });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("matches")
    .select("*, match_rooms(room_id)")
    .eq("id", matchId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  // Cache for 1 minute
  cache.set(cacheKey, data, CACHE_TTL.match);

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "public, max-age=60",
      "X-Cache": "MISS",
    },
  });
}
