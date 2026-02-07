import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

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

  const supabaseAdmin = getSupabaseAdmin();
  let query = supabaseAdmin
    .from("votes")
    .select("id, stance, comment, created_at, user_id")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (stance) {
    query = query.eq("stance", stance);
  }

  const keyword = subtopic || topic;
  if (keyword) {
    query = query.ilike("comment", `%${keyword}%`);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: "Failed to load thread" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    roomId,
    stance,
    topic,
    subtopic,
    items: data ?? [],
  });
}
