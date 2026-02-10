import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  fetchPremierLeagueMatches,
  normalizeMatchStatus,
} from "@/lib/football-data";
import { cache, CACHE_KEYS } from "@/lib/cache";

export const runtime = "nodejs";
export const maxDuration = 30; // 30 seconds for API calls

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
    // Fetch next 7 days of Premier League matches
    const today = new Date().toISOString().split("T")[0];
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const matches = await fetchPremierLeagueMatches(today, nextWeek);

    const upsertPromises = matches.map(async (match) => {
      const status = normalizeMatchStatus(match.status);

      const { data, error } = await supabaseAdmin
        .from("matches")
        .upsert(
          {
            external_id: match.id.toString(),
            competition: match.competition.code,
            home_team: match.homeTeam.name,
            away_team: match.awayTeam.name,
            home_crest: match.homeTeam.crest,
            away_crest: match.awayTeam.crest,
            kickoff_time: match.utcDate,
            status,
            home_score: match.score.fullTime.home ?? 0,
            away_score: match.score.fullTime.away ?? 0,
            minute: match.minute ?? 0,
            metadata: { raw: match },
            updated_at: new Date().toISOString(),
          },
          { onConflict: "external_id" }
        )
        .select("id, external_id, status")
        .single();

      if (error) {
        console.error("Failed to upsert match:", error);
        return null;
      }

      // Auto-create room for live matches
      if (status === "LIVE" && data) {
        const roomId = `match_${match.id}`;
        await supabaseAdmin.from("match_rooms").upsert(
          { match_id: data.id, room_id: roomId },
          { onConflict: "match_id,room_id" }
        );

        // Invalidate match cache
        cache.delete(CACHE_KEYS.match(data.id));
      }

      return data;
    });

    const results = await Promise.all(upsertPromises);
    const synced = results.filter(Boolean).length;

    return NextResponse.json({
      ok: true,
      synced,
      total: matches.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Match sync failed:", error);
    return NextResponse.json(
      { error: "Match sync failed", details: error.message },
      { status: 500 }
    );
  }
}
