import { NextRequest, NextResponse } from "next/server";
import { mockSummary } from "@/lib/mock";
import { getSupabaseAdmin } from "@/lib/supabase";
import { cache, CACHE_KEYS, CACHE_TTL } from "@/lib/cache";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;

  // Check cache first - critical for handling 10k+ concurrent users
  const cacheKey = CACHE_KEYS.summary(roomId);
  const cached = cache.get(cacheKey);

  if (cached) {
    return NextResponse.json(cached, {
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
        "X-Cache": "HIT",
      },
    });
  }

  const supabaseAdmin = getSupabaseAdmin();

  // Use partial index for "live" snapshots (faster query)
  const { data } = await supabaseAdmin
    .from("summaries")
    .select("payload, created_at")
    .eq("room_id", roomId)
    .eq("snapshot", "live") // Uses partial index: summaries_room_live_idx
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.payload) {
    const fallback = {
      ...mockSummary,
      roomId,
    };
    // Cache fallback for 5 minutes to reduce DB load
    cache.set(cacheKey, fallback, CACHE_TTL.summary);
    return NextResponse.json(fallback, {
      headers: {
        "Cache-Control": "public, max-age=300",
        "X-Cache": "MISS",
      },
    });
  }

  const response = {
    ...data.payload,
    roomId,
    updatedAt: data.created_at ?? new Date().toISOString(),
  };

  // Cache for 5 minutes - 100x reduction in DB queries
  cache.set(cacheKey, response, CACHE_TTL.summary);

  return NextResponse.json(response, {
    headers: {
      "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
      "X-Cache": "MISS",
      "X-Updated-At": response.updatedAt,
    },
  });
}
