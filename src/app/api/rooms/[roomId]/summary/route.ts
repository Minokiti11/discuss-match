import { NextRequest, NextResponse } from "next/server";
import { mockSummary } from "@/lib/mock";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const { data } = await supabaseAdmin
    .from("summaries")
    .select("payload, created_at")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.payload) {
    return NextResponse.json({
      ...mockSummary,
      roomId,
    });
  }

  return NextResponse.json({
    ...data.payload,
    roomId,
    updatedAt: data.created_at ?? new Date().toISOString(),
  });
}
