import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const status = url.searchParams.get("status"); // SCHEDULED | LIVE | FINISHED
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 20), 50);

  const supabaseAdmin = getSupabaseAdmin();
  let query = supabaseAdmin
    .from("matches")
    .select("*")
    .order("kickoff_time", { ascending: false })
    .limit(limit);

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: "Failed to load matches" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    matches: data ?? [],
    count: data?.length ?? 0,
  });
}
