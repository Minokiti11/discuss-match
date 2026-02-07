import { NextResponse } from "next/server";
import { mockSummary } from "@/lib/mock";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(
  _request: Request,
  { params }: { params: { roomId: string } }
) {
  const { data } = await supabaseAdmin
    .from("summaries")
    .select("payload, created_at")
    .eq("room_id", params.roomId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.payload) {
    return NextResponse.json({
      ...mockSummary,
      roomId: params.roomId,
    });
  }

  return NextResponse.json({
    ...data.payload,
    roomId: params.roomId,
    updatedAt: data.created_at ?? new Date().toISOString(),
  });
}
