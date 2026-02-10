import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { cache, CACHE_KEYS, CACHE_TTL } from "@/lib/cache";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const url = new URL(request.url);
  const stance = url.searchParams.get("stance");
  const topic = url.searchParams.get("topic");
  const subtopic = url.searchParams.get("subtopic");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);
  const cursor = url.searchParams.get("cursor"); // ISO timestamp for pagination

  // Check cache (only for first page without cursor)
  const cacheKey = `${CACHE_KEYS.votes(roomId, stance || "all")}:${topic || ""}:${subtopic || ""}`;
  const cached = cache.get(cacheKey);

  if (cached && !cursor) {
    return NextResponse.json(cached, {
      headers: { "X-Cache": "HIT" },
    });
  }

  const supabaseAdmin = getSupabaseAdmin();

  // Use composite index: votes_room_stance_created_idx
  let query = supabaseAdmin
    .from("votes")
    .select("id, stance, comment, created_at, user_id")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(limit);

  // Stance filtering uses composite index
  if (stance) {
    query = query.eq("stance", stance);
  }

  // Cursor-based pagination for infinite scroll
  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  // Use full-text search instead of ILIKE for 10-50x performance gain
  const keyword = subtopic || topic;
  if (keyword) {
    // Uses votes_comment_fts_idx (GIN index on comment_tsv)
    query = query.textSearch("comment_tsv", keyword, {
      type: "plain",
      config: "simple",
    });
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: "Failed to load thread" },
      { status: 500 }
    );
  }

  const response = {
    roomId,
    stance,
    topic,
    subtopic,
    items: data ?? [],
    nextCursor: data && data.length === limit ? data[data.length - 1].created_at : null,
  };

  // Cache first page for 2 minutes
  if (!cursor) {
    cache.set(cacheKey, response, CACHE_TTL.votes);
  }

  return NextResponse.json(response, {
    headers: {
      "Cache-Control": "public, max-age=120",
      "X-Cache": cached ? "HIT" : "MISS",
    },
  });
}
