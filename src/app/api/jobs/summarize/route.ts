import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

const cronSecret = process.env.CRON_SECRET;
const openaiApiKey = process.env.OPENAI_API_KEY;

const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

async function handleSummarize(request: Request) {
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

  if (!openai) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY not configured" },
      { status: 500 }
    );
  }

  const body = (await request.json().catch(() => null)) as
    | { roomId?: string; matchLabel?: string }
    | null;

  const roomId = body?.roomId ?? "default";
  const matchLabel = body?.matchLabel ?? "TBD: 次の注目試合";

  const supabaseAdmin = getSupabaseAdmin();
  const { data: votes, error } = await supabaseAdmin
    .from("votes")
    .select("stance, comment")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json(
      { error: "Failed to load votes" },
      { status: 500 }
    );
  }

  if (!votes || votes.length === 0) {
    return NextResponse.json({
      ok: true,
      roomId,
      note: "No votes to summarize",
    });
  }

  const response = await openai.responses.create({
    model: "gpt-4o-mini",
    input: [
      {
        role: "system",
        content:
          "You summarize soccer match opinions into topic clusters. Return concise Japanese summaries. Output raw JSON only, no code fences.",
      },
      {
        role: "user",
        content: `Votes: ${JSON.stringify(
          votes
        )}\n\nCreate up to 5 topics. For each topic, group relevant votes and count support/oppose/neutral. Provide 2-3 short sentences for each stance (support/oppose/neutral). Return JSON matching the schema exactly.`,
      },
    ],
  });

  const summary = response.output_text;

  const extractJson = (text: string) => {
    const fenced = text.match(/```json\\s*([\\s\\S]*?)\\s*```/i);
    if (fenced?.[1]) return fenced[1];
    const genericFence = text.match(/```\\s*([\\s\\S]*?)\\s*```/i);
    if (genericFence?.[1]) return genericFence[1];
    const firstBrace = text.indexOf(\"{\");
    const lastBrace = text.lastIndexOf(\"}\");
    if (firstBrace !== -1 && lastBrace !== -1) {
      return text.slice(firstBrace, lastBrace + 1);
    }
    return text;
  };

  type NormalizedTopic = {
    id: string;
    title: string;
    counts: { support: number; oppose: number; neutral: number };
    supportSummary: string;
    opposeSummary: string;
    neutralSummary: string;
  };

  const normalizeTopics = (raw: any): NormalizedTopic[] => {
    const topics = Array.isArray(raw?.topics) ? raw.topics : [];
    return topics.slice(0, 5).map((topic: any, index: number) => {
      if (topic?.counts && topic?.title) {
        return {
          id: topic.id ?? `topic-${index + 1}`,
          title: topic.title,
          counts: {
            support: Number(topic.counts.support ?? 0),
            oppose: Number(topic.counts.oppose ?? 0),
            neutral: Number(topic.counts.neutral ?? 0),
          },
          supportSummary: String(topic.supportSummary ?? \"\"),
          opposeSummary: String(topic.opposeSummary ?? \"\"),
          neutralSummary: String(topic.neutralSummary ?? \"\"),
        };
      }

      const votes = topic?.votes ?? {};
      const summaryBlock = topic?.summary ?? {};
      const toLines = (value: any) =>
        Array.isArray(value) ? value.join(\" \") : String(value ?? \"\");

      return {
        id: topic?.id ?? `topic-${index + 1}`,
        title: topic?.topic ?? topic?.title ?? `トピック ${index + 1}`,
        counts: {
          support: Number(votes.support ?? 0),
          oppose: Number(votes.oppose ?? 0),
          neutral: Number(votes.neutral ?? 0),
        },
        supportSummary: toLines(summaryBlock.support),
        opposeSummary: toLines(summaryBlock.oppose),
        neutralSummary: toLines(summaryBlock.neutral),
      };
    });
  };

  let parsed: { matchLabel?: string; batchPolicy?: string; topics?: Array<any> };

  try {
    parsed = JSON.parse(extractJson(summary));
  } catch {
    return NextResponse.json(
      { error: \"Failed to parse summary JSON\", raw: summary },
      { status: 500 }
    );
  }

  const payload = {
    matchLabel,
    updatedAt: new Date().toISOString(),
    batchPolicy: parsed.batchPolicy || \"5分ごと / 10件ごと\",
    topics: normalizeTopics(parsed),
  };

  const { error: insertError } = await supabaseAdmin
    .from("summaries")
    .insert({ room_id: roomId, snapshot: "live", payload });

  if (insertError) {
    return NextResponse.json(
      { error: "Failed to store summary" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, roomId, payload });
}

export async function POST(request: Request) {
  return handleSummarize(request);
}

export async function GET(request: Request) {
  return handleSummarize(request);
}
