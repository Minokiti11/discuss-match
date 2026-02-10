"use client";

import { useState, useEffect } from "react";

interface HotTopic {
  id: string;
  topic_text: string;
  yes_count: number;
  no_count: number;
  velocity_score: number;
}

export function HotTopics({ roomId }: { roomId: string }) {
  const [topics, setTopics] = useState<HotTopic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const fetchTopics = async () => {
      const res = await fetch(`/api/rooms/${roomId}/hot-topics`);
      if (res.ok) {
        const data = await res.json();
        setTopics(data.topics);
      }
    };

    fetchTopics();
    const interval = setInterval(fetchTopics, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [roomId]);

  const handleVote = async (topicId: string, vote: boolean) => {
    setStatus(null);
    const res = await fetch(`/api/rooms/${roomId}/hot-topics/${topicId}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vote, reason: reason.trim() || undefined }),
    });

    if (res.ok) {
      setStatus("投票しました");
      setSelectedTopic(null);
      setReason("");
      // Refresh topics
      const refreshRes = await fetch(`/api/rooms/${roomId}/hot-topics`);
      if (refreshRes.ok) {
        const data = await refreshRes.json();
        setTopics(data.topics);
      }
    } else {
      const err = await res.json().catch(() => null);
      setStatus(err?.error ?? "投票に失敗しました");
    }
  };

  if (topics.length === 0) return null;

  return (
    <div className="rounded-3xl border border-[color:var(--line)] bg-gradient-to-br from-orange-50 to-red-50 p-6 shadow-lg">
      <div className="flex items-center gap-2">
        <span className="text-2xl">🔥</span>
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-orange-700">
            Hot Topics
          </p>
          <h3 className="text-xl font-semibold text-[color:var(--panel-ink)]">
            今、熱い議題トップ3
          </h3>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {topics.map((topic, idx) => {
          const total = topic.yes_count + topic.no_count;
          const yesPercent = total > 0 ? (topic.yes_count / total) * 100 : 50;

          return (
            <div
              key={topic.id}
              className="rounded-2xl border border-orange-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-white">
                      {idx + 1}
                    </span>
                    <p className="text-sm font-semibold text-[color:var(--panel-ink)]">
                      {topic.topic_text}
                    </p>
                  </div>

                  <div className="mt-3 flex items-center gap-3 text-xs text-[color:var(--muted)]">
                    <span>
                      Yes {topic.yes_count} · No {topic.no_count}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="text-orange-600">⚡</span>
                      {topic.velocity_score.toFixed(1)} 票/分
                    </span>
                  </div>

                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200">
                    <div
                      className="h-full bg-gradient-to-r from-green-500 to-emerald-600"
                      style={{ width: `${yesPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              {selectedTopic === topic.id ? (
                <div className="mt-3 rounded-xl border border-orange-200 bg-orange-50 p-3">
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={100}
                    placeholder="理由を簡潔に（任意、100字まで）"
                    className="w-full rounded-lg border border-orange-300 bg-white p-2 text-sm outline-none"
                    rows={2}
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => handleVote(topic.id, true)}
                      className="flex-1 rounded-lg bg-green-500 px-3 py-2 text-sm font-semibold text-white hover:bg-green-600"
                      type="button"
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => handleVote(topic.id, false)}
                      className="flex-1 rounded-lg bg-red-500 px-3 py-2 text-sm font-semibold text-white hover:bg-red-600"
                      type="button"
                    >
                      No
                    </button>
                    <button
                      onClick={() => {
                        setSelectedTopic(null);
                        setReason("");
                      }}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                      type="button"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setSelectedTopic(topic.id)}
                  className="mt-3 w-full rounded-lg border border-orange-300 bg-orange-100 px-3 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-200"
                  type="button"
                >
                  投票する
                </button>
              )}
            </div>
          );
        })}
      </div>

      {status && (
        <div className="mt-3 rounded-lg border border-orange-200 bg-white px-3 py-2 text-xs text-[color:var(--muted)]">
          {status}
        </div>
      )}
    </div>
  );
}
