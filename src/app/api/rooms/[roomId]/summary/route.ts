import { NextResponse } from "next/server";
import { mockSummary } from "@/lib/mock";

export async function GET(
  _request: Request,
  { params }: { params: { roomId: string } }
) {
  return NextResponse.json({
    ...mockSummary,
    roomId: params.roomId,
  });
}
