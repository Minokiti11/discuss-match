import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { VoteInput, Stance } from "@/lib/types";
import { getAuthOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { cache, CACHE_KEYS } from "@/lib/cache";

const validStances: Stance[] = ["support", "oppose", "neutral"];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const session = await getServerSession(getAuthOptions());

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limiting: 10 votes per minute per user
  // Prevents spam and DoS attacks during high-traffic match events
  const rateLimit = await checkRateLimit(request, session.user.id, {
    maxRequests: 10,
    windowMs: 60000,
    keyExtractor: (_, userId) => `vote:${userId}`,
  });

  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.resetAt);
  }

  const supabaseAdmin = getSupabaseAdmin();

  const body = (await request.json().catch(() => null)) as VoteInput | null;

  if (!body || typeof body.comment !== "string" || !validStances.includes(body.stance)) {
    return NextResponse.json(
      { error: "Invalid payload" },
      { status: 400 }
    );
  }

  if (body.comment.length > 300) {
    return NextResponse.json(
      { error: "Comment too long" },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin.from("votes").insert({
    room_id: roomId,
    stance: body.stance,
    comment: body.comment.trim(),
    user_id: session.user.id,
  });

  if (error) {
    return NextResponse.json(
      { error: "Failed to save vote" },
      { status: 500 }
    );
  }

  // Invalidate relevant caches to ensure fresh data
  cache.invalidatePattern(`votes:${roomId}:.*`);
  cache.delete(CACHE_KEYS.summary(roomId));

  return NextResponse.json(
    {
      accepted: true,
      roomId,
      receivedAt: new Date().toISOString(),
      rateLimit: {
        remaining: rateLimit.remaining,
        resetAt: new Date(rateLimit.resetAt).toISOString(),
      },
    },
    {
      headers: {
        "X-RateLimit-Remaining": rateLimit.remaining.toString(),
        "X-RateLimit-Reset": new Date(rateLimit.resetAt).toISOString(),
      },
    }
  );
}
