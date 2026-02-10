import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { cache, CACHE_KEYS } from "@/lib/cache";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string; topicId: string }> }
) {
  const { roomId, topicId } = await params;
  const session = await getServerSession(getAuthOptions());

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit: 20 votes per minute per user
  const rateLimit = await checkRateLimit(request, session.user.id, {
    maxRequests: 20,
    windowMs: 60000,
    keyExtractor: (_, userId) => `hot_topic_vote:${userId}`,
  });

  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.resetAt);
  }

  const body = (await request.json().catch(() => null)) as
    | { vote: boolean; reason?: string }
    | null;

  if (body === null || typeof body.vote !== "boolean") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (body.reason && body.reason.length > 100) {
    return NextResponse.json(
      { error: "Reason too long (max 100 characters)" },
      { status: 400 }
    );
  }

  const supabaseAdmin = getSupabaseAdmin();

  // Upsert vote (replace if user already voted)
  const { error: voteError } = await supabaseAdmin
    .from("hot_topic_votes")
    .upsert(
      {
        hot_topic_id: topicId,
        user_id: session.user.id,
        vote: body.vote,
        reason: body.reason?.trim() || null,
      },
      { onConflict: "hot_topic_id,user_id" }
    );

  if (voteError) {
    return NextResponse.json(
      { error: "Failed to save vote" },
      { status: 500 }
    );
  }

  // Update vote counts and velocity
  const { data: votes } = await supabaseAdmin
    .from("hot_topic_votes")
    .select("vote, created_at")
    .eq("hot_topic_id", topicId);

  if (votes) {
    const yesCount = votes.filter((v) => v.vote).length;
    const noCount = votes.filter((v) => !v.vote).length;

    // Calculate velocity: votes in last 5 minutes
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: recentVotes } = await supabaseAdmin
      .from("hot_topic_votes")
      .select("created_at")
      .eq("hot_topic_id", topicId)
      .gte("created_at", fiveMinAgo);

    const velocityScore = recentVotes ? recentVotes.length / 5 : 0; // votes per minute

    await supabaseAdmin
      .from("hot_topics")
      .update({
        yes_count: yesCount,
        no_count: noCount,
        velocity_score: velocityScore,
        updated_at: new Date().toISOString(),
      })
      .eq("id", topicId);
  }

  // Invalidate cache
  cache.delete(CACHE_KEYS.hotTopics(roomId));

  return NextResponse.json({ ok: true });
}
