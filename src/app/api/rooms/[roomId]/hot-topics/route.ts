import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { cache, CACHE_KEYS, CACHE_TTL } from "@/lib/cache";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

// GET: Fetch top hot topics
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;

  // Check cache
  const cacheKey = CACHE_KEYS.hotTopics(roomId);
  const cached = cache.get(cacheKey);
  if (cached) {
    return NextResponse.json(cached, {
      headers: { "X-Cache": "HIT" },
    });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("hot_topics")
    .select("*")
    .eq("room_id", roomId)
    .eq("is_active", true)
    .order("velocity_score", { ascending: false })
    .limit(3);

  if (error) {
    return NextResponse.json(
      { error: "Failed to load hot topics" },
      { status: 500 }
    );
  }

  const response = { roomId, topics: data ?? [] };
  cache.set(cacheKey, response, CACHE_TTL.hotTopics);

  return NextResponse.json(response, {
    headers: {
      "Cache-Control": "public, max-age=30",
      "X-Cache": "MISS",
    },
  });
}

// POST: Create new hot topic
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const session = await getServerSession(getAuthOptions());

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit: 3 topics per hour per user
  const rateLimit = await checkRateLimit(request, session.user.id, {
    maxRequests: 3,
    windowMs: 60 * 60 * 1000,
    keyExtractor: (_, userId) => `hot_topic_create:${userId}`,
  });

  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.resetAt);
  }

  const body = (await request.json().catch(() => null)) as
    | { topicText: string }
    | null;

  if (!body?.topicText || body.topicText.length > 100) {
    return NextResponse.json(
      { error: "Invalid topic text (max 100 characters)" },
      { status: 400 }
    );
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("hot_topics")
    .insert({
      room_id: roomId,
      topic_text: body.topicText.trim(),
      yes_count: 0,
      no_count: 0,
      velocity_score: 0,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Failed to create hot topic" },
      { status: 500 }
    );
  }

  // Invalidate cache
  cache.delete(CACHE_KEYS.hotTopics(roomId));

  return NextResponse.json({ ok: true, topic: data });
}
