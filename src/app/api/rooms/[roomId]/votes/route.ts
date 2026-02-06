import { NextResponse } from "next/server";
import { VoteInput, Stance } from "@/lib/types";

const validStances: Stance[] = ["support", "oppose", "neutral"];

export async function POST(
  request: Request,
  { params }: { params: { roomId: string } }
) {
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

  return NextResponse.json({
    accepted: true,
    roomId: params.roomId,
    receivedAt: new Date().toISOString(),
  });
}
