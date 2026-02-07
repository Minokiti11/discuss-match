"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const stanceMeta = {
  support: { label: "賛成", color: "bg-emerald-100 text-emerald-800" },
  oppose: { label: "反対", color: "bg-rose-100 text-rose-800" },
  neutral: { label: "中立", color: "bg-slate-100 text-slate-700" },
} as const;

type ThreadItem = {
  id: string;
  stance: keyof typeof stanceMeta;
  comment: string;
  created_at: string;
  user_id: string;
};

export default function TopicThreadPage({
  params,
}: {
  params: { topicId: string };
}) {
  const searchParams = useSearchParams();
  const roomId = searchParams.get("roomId") ?? "default";
  const topic = searchParams.get("topic") ?? "";
  const stance = searchParams.get("stance") ?? "";
  const subtopic = searchParams.get("subtopic") ?? "";

  const [items, setItems] = useState<ThreadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const label = useMemo(() => {
    if (subtopic) return subtopic;
    if (topic) return topic;
    return params.topicId;
  }, [subtopic, topic, params.topicId]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = new URL(
          `/api/rooms/${roomId}/threads`,
          window.location.origin
        );
        if (topic) url.searchParams.set("topic", topic);
        if (subtopic) url.searchParams.set("subtopic", subtopic);
        if (stance) url.searchParams.set("stance", stance);
        const res = await fetch(url.toString(), { cache: "no-store" });
        if (!res.ok) {
          throw new Error("Failed to load thread");
        }
        const data = await res.json();
        if (!cancelled) {
          setItems(data.items ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Error");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [roomId, topic, stance, subtopic]);

  return (
    <main className="min-h-screen px-6 py-10 md:px-10">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <Link
          href="/"
          className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]"
        >
          ← Match Note に戻る
        </Link>

        <header className="rounded-3xl border border-[color:var(--line)] bg-white/90 p-6 shadow-[var(--shadow)]">
          <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Thread
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-[color:var(--panel-ink)]">
            {label}
          </h1>
          <p className="mt-2 text-sm text-[color:var(--muted)]">
            クリックした意見点に近いコメントの一覧です。
          </p>
        </header>

        <section className="rounded-3xl border border-[color:var(--line)] bg-white/90 p-6 shadow-[var(--shadow)]">
          {loading && (
            <p className="text-sm text-[color:var(--muted)]">読み込み中…</p>
          )}
          {error && (
            <p className="text-sm text-rose-600">{error}</p>
          )}
          {!loading && !error && items.length === 0 && (
            <p className="text-sm text-[color:var(--muted)]">
              該当するコメントがまだありません。
            </p>
          )}

          <div className="mt-4 flex flex-col gap-3">
            {items.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--background)] p-4"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--muted)]">
                  <span
                    className={`rounded-full px-2 py-1 ${
                      stanceMeta[item.stance]?.color ??
                      "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {stanceMeta[item.stance]?.label ?? item.stance}
                  </span>
                  <span>
                    {new Date(item.created_at).toLocaleString("ja-JP")}
                  </span>
                </div>
                <p className="mt-2 text-sm text-[color:var(--panel-ink)]">
                  {item.comment}
                </p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
