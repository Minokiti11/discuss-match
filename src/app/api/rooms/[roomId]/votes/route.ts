import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { VoteInput, Stance } from "@/lib/types";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

const validStances: Stance[] = ["support", "oppose", "neutral"];

export async function POST(
  request: Request,
  { params }: { params: { roomId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    room_id: params.roomId,
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

  return NextResponse.json({
    accepted: true,
    roomId: params.roomId,
    receivedAt: new Date().toISOString(),
  });
}
