import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { fetchMatchById, normalizeMatchStatus } from "@/lib/football-data";
import { cache, CACHE_KEYS } from "@/lib/cache";

export const runtime = "nodejs";
export const maxDuration = 30;

const cronSecret = process.env.CRON_SECRET;

export async function GET(request: Request) {
  // Cron authentication
  if (cronSecret) {
    const incoming = request.headers.get("x-cron-secret");
    const vercelCron = request.headers.get("x-vercel-cron");
    const url = new URL(request.url);
    const querySecret = url.searchParams.get("secret");

    if (
      incoming !== cronSecret &&
      querySecret !== cronSecret &&
      vercelCron !== "1"
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabaseAdmin = getSupabaseAdmin();

  try {
    // Fetch all live matches from database
    const { data: liveMatches } = await supabaseAdmin
      .from("matches")
      .select("id, external_id")
      .eq("status", "LIVE");

    if (!liveMatches || liveMatches.length === 0) {
      return NextResponse.json({
        ok: true,
        updated: 0,
        note: "No live matches to update",
      });
    }

    const updatePromises = liveMatches.map(async (match) => {
      try {
        // Fetch fresh data from football-data.org API
        const freshData = await fetchMatchById(Number(match.external_id));
        const status = normalizeMatchStatus(freshData.status);

        await supabaseAdmin
          .from("matches")
          .update({
            status,
            home_score: freshData.score.fullTime.home ?? 0,
            away_score: freshData.score.fullTime.away ?? 0,
            minute: freshData.minute ?? 0,
            updated_at: new Date().toISOString(),
          })
          .eq("id", match.id);

        // Invalidate cache for updated match
        cache.delete(CACHE_KEYS.match(match.id));

        return match.id;
      } catch (err) {
        console.error("Failed to update match:", match.id, err);
        return null;
      }
    });

    const results = await Promise.all(updatePromises);
    const updated = results.filter(Boolean).length;

    return NextResponse.json({
      ok: true,
      updated,
      total: liveMatches.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Score update failed:", error);
    return NextResponse.json(
      { error: "Score update failed", details: error.message },
      { status: 500 }
    );
  }
}
