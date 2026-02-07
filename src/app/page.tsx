"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { mockSummary } from "@/lib/mock";
import { RoomSummary } from "@/lib/types";

const stanceMeta = {
  support: { label: "賛成", color: "#22c55e" },
  oppose: { label: "反対", color: "#f43f5e" },
  neutral: { label: "中立", color: "#94a3b8" },
} as const;

type Stance = keyof typeof stanceMeta;

type OpinionPoint = {
  id: string;
  stance: Stance;
  subtopic: string;
  x: number;
  y: number;
  topicId: string;
  topicTitle: string;
};

type TopicMap = {
  id: string;
  title: string;
  prompt: string;
  clusters: {
    stance: Stance;
    center: { x: number; y: number };
    radius: number;
    subtopics: { label: string; count: number }[];
  }[];
};

const clusterCenters = [
  { stance: "support" as const, center: { x: 260, y: 220 }, radius: 150 },
  { stance: "oppose" as const, center: { x: 640, y: 240 }, radius: 160 },
  { stance: "neutral" as const, center: { x: 460, y: 520 }, radius: 140 },
];

const splitSummary = (text: string) =>
  text
    .split(/。|\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3);

const buildTopicMapsFromSummary = (summary: RoomSummary): TopicMap[] => {
  if (!summary.topics.length) return [];

  return summary.topics.map((topic, index) => {
    const prompts = [
      "賛成・反対・中立それぞれの意見点が集まるマップ",
      "中盤論点の賛否と中立が点で見える",
      "サイド論点の意見点を拡大して確認",
    ];

    const stanceToSummary = {
      support: splitSummary(topic.supportSummary),
      oppose: splitSummary(topic.opposeSummary),
      neutral: splitSummary(topic.neutralSummary),
    };

    const stanceToCount = {
      support: topic.counts.support,
      oppose: topic.counts.oppose,
      neutral: topic.counts.neutral,
    };

    const clusters = clusterCenters.map((base) => {
      const parts = stanceToSummary[base.stance];
      const count = stanceToCount[base.stance];
      const per = parts.length ? Math.max(1, Math.round(count / parts.length)) : count;

      const subtopics = parts.length
        ? parts.map((label) => ({ label, count: per }))
        : [{ label: `${stanceMeta[base.stance].label}意見`, count }];

      return {
        ...base,
        subtopics,
      };
    });

    return {
      id: topic.id || `topic-${index}`,
      title: topic.title,
      prompt: prompts[index % prompts.length],
      clusters,
    };
  });
};

const pseudoRandom = (seed: number) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

const buildOpinionPoints = (topic: TopicMap) => {
  const points: OpinionPoint[] = [];
  let seed = 1;

  topic.clusters.forEach((cluster) => {
    cluster.subtopics.forEach((subtopic) => {
      for (let i = 0; i < subtopic.count; i += 1) {
        seed += 1;
        const angle = pseudoRandom(seed) * Math.PI * 2;
        seed += 1;
        const radius = Math.sqrt(pseudoRandom(seed)) * (cluster.radius - 20);
        const jitter = (pseudoRandom(seed + 1) - 0.5) * 8;
        const x = cluster.center.x + Math.cos(angle) * radius + jitter;
        const y = cluster.center.y + Math.sin(angle) * radius + jitter;
        points.push({
          id: `${topic.id}-${cluster.stance}-${subtopic.label}-${i}`,
          stance: cluster.stance,
          subtopic: subtopic.label,
          x,
          y,
          topicId: topic.id,
          topicTitle: topic.title,
        });
      }
    });
  });

  return points;
};

const MapCard = ({ topic, roomId }: { topic: TopicMap; roomId: string }) => {
  const [scale, setScale] = useState(0.5);
  const [offset, setOffset] = useState({ x: -135, y: -50 });
  const [isDragging, setIsDragging] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const dragRef = useRef({ x: 0, y: 0 });
  const offsetRef = useRef({ x: 0, y: 0 });
  const movedRef = useRef(false);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ distance: number; scale: number } | null>(null);

  const [points, setPoints] = useState<OpinionPoint[] | null>(null);

  useEffect(() => {
    setPoints(buildOpinionPoints(topic));
  }, [topic]);

  useEffect(() => {
    if (!isExpanded) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isExpanded]);

  const subtopicAnchors = useMemo(() => {
    if (!points) return [] as Array<{ label: string; x: number; y: number; stance: Stance }>;
    return topic.clusters.flatMap((cluster) =>
      cluster.subtopics.map((subtopic) => {
        const relatedPoints = points.filter(
          (point) =>
            point.stance === cluster.stance &&
            point.subtopic === subtopic.label
        );

        if (relatedPoints.length === 0) {
          return {
            label: subtopic.label,
            x: cluster.center.x,
            y: cluster.center.y,
            stance: cluster.stance,
          };
        }

        const avgX =
          relatedPoints.reduce((acc, point) => acc + point.x, 0) /
          relatedPoints.length;
        const avgY =
          relatedPoints.reduce((acc, point) => acc + point.y, 0) /
          relatedPoints.length;

        return { label: subtopic.label, x: avgX, y: avgY, stance: cluster.stance };
      })
    );
  }, [points, topic]);

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    const delta = event.deltaY > 0 ? -0.08 : 0.08;
    setScale((prev) => Math.min(2.2, Math.max(0.6, prev + delta)));
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    if (pointersRef.current.size === 2) {
      const [first, second] = Array.from(pointersRef.current.values());
      const distance = Math.hypot(first.x - second.x, first.y - second.y);
      pinchRef.current = { distance, scale };
      setIsDragging(false);
      movedRef.current = false;
      return;
    }

    setIsDragging(true);
    movedRef.current = false;
    dragRef.current = { x: event.clientX, y: event.clientY };
    offsetRef.current = offset;
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    if (pointersRef.current.size === 2 && pinchRef.current) {
      const [first, second] = Array.from(pointersRef.current.values());
      const distance = Math.hypot(first.x - second.x, first.y - second.y);
      const ratio = distance / pinchRef.current.distance;
      const nextScale = Math.min(
        2.2,
        Math.max(0.6, pinchRef.current.scale * ratio)
      );
      setScale(nextScale);
      return;
    }

    if (!isDragging) return;
    const dx = event.clientX - dragRef.current.x;
    const dy = event.clientY - dragRef.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      movedRef.current = true;
    }
    setOffset({ x: offsetRef.current.x + dx, y: offsetRef.current.y + dy });
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pointersRef.current.has(event.pointerId)) {
      pointersRef.current.delete(event.pointerId);
    }
    event.currentTarget.releasePointerCapture(event.pointerId);

    if (pointersRef.current.size < 2) {
      pinchRef.current = null;
    }

    if (pointersRef.current.size === 1) {
      const remaining = Array.from(pointersRef.current.values())[0];
      dragRef.current = { x: remaining.x, y: remaining.y };
      offsetRef.current = offset;
      setIsDragging(true);
      return;
    }

    setIsDragging(false);
  };

  const resetView = () => {
    setScale(0.47);
    setOffset({ x: -135, y: -50 });
  };

  const buildThreadUrl = (point: OpinionPoint) => {
    const params = new URLSearchParams({
      roomId,
      topic: point.topicTitle,
      stance: point.stance,
      subtopic: point.subtopic,
    });
    return `/topics/${point.topicId}?${params.toString()}`;
  };

  const renderMap = (heightClass: string) => (
    <div
      className={`relative overflow-hidden rounded-2xl border border-[color:var(--line)] bg-[color:var(--background)] ${heightClass}`}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerUp}
      style={{ touchAction: "none" }}
    >
      {!points ? (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-[color:var(--muted)]">
          読み込み中…
        </div>
      ) : (
        <div
          className="absolute inset-0"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: "50% 50%",
            transition: isDragging ? "none" : "transform 0.08s ease-out",
            touchAction: "none",
          }}
        >
          <div
            className="relative"
            style={{ width: 900, height: 700 }}
            role="img"
            aria-label="Opinion points map"
          >
            <svg viewBox="0 0 900 700" className="h-full w-full">
              <defs>
                <radialGradient id="supportGlow" cx="50%" cy="50%" r="60%">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity="0.04" />
                </radialGradient>
                <radialGradient id="opposeGlow" cx="50%" cy="50%" r="60%">
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.04" />
                </radialGradient>
                <radialGradient id="neutralGlow" cx="50%" cy="50%" r="60%">
                  <stop offset="0%" stopColor="#94a3b8" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#94a3b8" stopOpacity="0.04" />
                </radialGradient>
              </defs>

              {topic.clusters.map((cluster) => (
                <g key={cluster.stance}>
                  <circle
                    cx={cluster.center.x}
                    cy={cluster.center.y}
                    r={cluster.radius}
                    fill={`url(#${cluster.stance}Glow)`}
                  />
                  <circle
                    cx={cluster.center.x}
                    cy={cluster.center.y}
                    r={cluster.radius - 24}
                    fill="none"
                    stroke={stanceMeta[cluster.stance].color}
                    strokeOpacity="0.3"
                    strokeWidth="2"
                    strokeDasharray="6 8"
                  />
                  <text
                    x={cluster.center.x}
                    y={cluster.center.y}
                    textAnchor="middle"
                    fontSize="16"
                    fill={stanceMeta[cluster.stance].color}
                    fontWeight="600"
                  >
                    {stanceMeta[cluster.stance].label}
                  </text>
                </g>
              ))}

              {subtopicAnchors.map((anchor) => (
                <g key={`${anchor.stance}-${anchor.label}`}>
                  <circle
                    cx={anchor.x}
                    cy={anchor.y}
                    r={14}
                    fill={stanceMeta[anchor.stance].color}
                    opacity={0.18}
                  />
                  <text
                    x={anchor.x}
                    y={anchor.y - 16}
                    textAnchor="middle"
                    fontSize="11"
                    fill="#1f2937"
                  >
                    {anchor.label}
                  </text>
                </g>
              ))}
            </svg>

            {points.map((point) => {
              const href = buildThreadUrl(point);
              return (
                <button
                  key={point.id}
                  type="button"
                  onClick={() => {
                    window.location.href = href;
                  }}
                  className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full transition hover:scale-110 focus:outline-none sm:h-3 sm:w-3"
                  style={{
                    left: point.x,
                    top: point.y,
                    background: stanceMeta[point.stance].color,
                    opacity: 0.9,
                  }}
                  aria-label={`${point.topicTitle} ${point.subtopic}`}
                />
              );
            })}
          </div>
        </div>
      )}
      <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1 rounded-xl border border-[color:var(--line)] bg-white/80 px-3 py-2 text-[11px] text-[color:var(--muted)] shadow-sm">
        <span>ドラッグ: 移動</span>
        <span>+ / − : ズーム</span>
        <span>点タップ: スレッドへ</span>
      </div>
    </div>
  );

  return (
    <article className="w-full rounded-3xl border border-[color:var(--line)] bg-white/80 p-5 shadow-[var(--shadow)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-[color:var(--muted)]">
            Topic Map
          </p>
          <h3 className="mt-2 text-xl font-semibold text-[color:var(--panel-ink)]">
            {topic.title}
          </h3>
          <p className="mt-1 text-xs text-[color:var(--muted)]">
            {topic.prompt}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <button
            className="rounded-full border border-[color:var(--line)] bg-white px-3 py-1 font-semibold text-[color:var(--panel-ink)]"
            type="button"
            onClick={() => setIsExpanded(true)}
          >
            全画面
          </button>
          <button
            className="rounded-full border border-[color:var(--line)] bg-white px-3 py-1 font-semibold text-[color:var(--panel-ink)]"
            type="button"
            onClick={() => setScale((prev) => Math.min(2.2, prev + 0.15))}
          >
            +
          </button>
          <button
            className="rounded-full border border-[color:var(--line)] bg-white px-3 py-1 font-semibold text-[color:var(--panel-ink)]"
            type="button"
            onClick={() => setScale((prev) => Math.max(0.6, prev - 0.15))}
          >
            −
          </button>
          <button
            className="rounded-full border border-[color:var(--line)] bg-white px-3 py-1 font-semibold text-[color:var(--panel-ink)]"
            type="button"
            onClick={resetView}
          >
            Reset
          </button>
        </div>
      </div>

      <div className="mt-4">{renderMap("h-[360px] sm:h-[420px]")}</div>

      <div className="mt-3 flex flex-wrap gap-3 text-xs">
        {Object.entries(stanceMeta).map(([key, meta]) => (
          <span
            key={key}
            className="flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-white px-3 py-1"
          >
            <span className="h-2 w-2 rounded-full" style={{ background: meta.color }} />
            <span className="text-[color:var(--panel-ink)]">{meta.label}</span>
          </span>
        ))}
      </div>

      {isExpanded && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[color:var(--background)]/95 backdrop-blur overscroll-contain">
          <div className="flex items-center justify-between border-b border-[color:var(--line)] bg-white/90 px-5 py-4">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-[color:var(--muted)]">
                Topic Map
              </p>
              <p className="text-lg font-semibold text-[color:var(--panel-ink)]">
                {topic.title}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <button
                className="rounded-full border border-[color:var(--line)] bg-white px-3 py-1 font-semibold text-[color:var(--panel-ink)]"
                type="button"
                onClick={() => setScale((prev) => Math.min(2.2, prev + 0.15))}
              >
                +
              </button>
              <button
                className="rounded-full border border-[color:var(--line)] bg-white px-3 py-1 font-semibold text-[color:var(--panel-ink)]"
                type="button"
                onClick={() => setScale((prev) => Math.max(0.6, prev - 0.15))}
              >
                −
              </button>
              <button
                className="rounded-full border border-[color:var(--line)] bg-white px-3 py-1 font-semibold text-[color:var(--panel-ink)]"
                type="button"
                onClick={resetView}
              >
                Reset
              </button>
              <button
                className="rounded-full border border-[color:var(--line)] bg-white px-4 py-2 text-xs font-semibold text-[color:var(--panel-ink)]"
                type="button"
                onClick={() => setIsExpanded(false)}
              >
                閉じる
              </button>
            </div>
          </div>
          <div className="flex-1 p-4">
            {renderMap("h-[calc(100dvh-140px)]")}
          </div>
        </div>
      )}
    </article>
  );
};

export default function Home() {
  const { data: session } = useSession();
  const [summary, setSummary] = useState<RoomSummary>(mockSummary);
  const [topicMaps, setTopicMaps] = useState<TopicMap[]>([]);
  const [stance, setStance] = useState<Stance | null>(null);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const roomId = "default";

  useEffect(() => {
    let cancelled = false;
    const fetchSummary = async () => {
      try {
        const res = await fetch(`/api/rooms/${roomId}/summary`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as RoomSummary;
        if (!cancelled) {
          setSummary(data);
          const maps = buildTopicMapsFromSummary(data);
          setTopicMaps(maps.length ? maps : buildTopicMapsFromSummary(mockSummary));
        }
      } catch {
        if (!cancelled) {
          setTopicMaps(buildTopicMapsFromSummary(mockSummary));
        }
      }
    };

    fetchSummary();
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  const handleSubmit = async () => {
    if (!stance || !comment.trim()) {
      setStatus("スタンスとコメントを入力してください。");
      return;
    }
    if (!session?.user) {
      setStatus("投稿にはログインが必要です。");
      return;
    }

    setIsSubmitting(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/rooms/${roomId}/votes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stance, comment }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        setStatus(err?.error ?? "投稿に失敗しました。");
      } else {
        setComment("");
        setStance(null);
        setStatus("投稿しました。集約に反映されます。");
      }
    } catch {
      setStatus("投稿に失敗しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  const mapsToRender = topicMaps.length
    ? topicMaps
    : buildTopicMapsFromSummary(summary);

  return (
    <main className="min-h-screen px-6 py-10 md:px-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <header className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--muted)]">
                Match Note · Collective Match Pulse
              </p>
              <h1 className="mt-3 text-4xl font-semibold text-[color:var(--panel-ink)] md:text-5xl">
                みんなの意見を、試合の論点として可視化する。
              </h1>
            </div>
            <div className="rounded-full border border-[color:var(--line)] bg-white/70 px-4 py-2 text-xs text-[color:var(--muted)] shadow-sm">
              更新: {summary.batchPolicy}
            </div>
          </div>
          <p className="max-w-2xl text-lg text-[color:var(--muted)]">
            匿名投票と自由コメントをAIで整理し、トピックごとの賛否と中立を一枚で見える化します。
            試合中は5分ごと、または10件ごとに再集約。
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
          <div className="rounded-3xl border border-[color:var(--line)] bg-white/90 p-6 shadow-[var(--shadow)] backdrop-blur">
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-[color:var(--muted)]">
                  Live Vote
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-[color:var(--panel-ink)]">
                  {summary.matchLabel}
                </h2>
                <p className="mt-2 text-sm text-[color:var(--muted)]">
                  匿名・300字まで。試合中は5分/10件ごとに反映。
                </p>
              </div>

              <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--background)] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  スタンス
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {Object.entries(stanceMeta).map(([key, meta]) => (
                    <button
                      key={key}
                      className={`rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-medium text-[color:var(--panel-ink)] transition hover:translate-y-[-1px] hover:bg-white ${
                        stance === key ? "bg-white" : ""
                      }`}
                      type="button"
                      onClick={() => setStance(key as Stance)}
                    >
                      {meta.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label
                  className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]"
                  htmlFor="comment"
                >
                  コメント（最大300字）
                </label>
                <textarea
                  id="comment"
                  rows={6}
                  maxLength={300}
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="例: 前線の連動は良いが、背後の対応が遅い。"
                  className="mt-3 w-full rounded-2xl border border-[color:var(--line)] bg-white/80 p-4 text-sm text-[color:var(--panel-ink)] outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent)]/20"
                />
                <div className="mt-2 flex items-center justify-between text-xs text-[color:var(--muted)]">
                  <span>
                    {session?.user
                      ? `ログイン中: ${session.user.name ?? ""}`
                      : "閲覧のみ可能。投稿にはログインが必要。"}
                  </span>
                  <span>{comment.length} / 300</span>
                </div>
              </div>

              {status && (
                <div className="rounded-2xl border border-[color:var(--line)] bg-white/70 px-4 py-3 text-xs text-[color:var(--muted)]">
                  {status}
                </div>
              )}

              {!session?.user && (
                <div className="rounded-2xl border border-dashed border-[color:var(--line)] bg-white/70 p-4 text-xs text-[color:var(--muted)]">
                  <p className="font-semibold text-[color:var(--panel-ink)]">
                    閲覧のみ可能です
                  </p>
                  <p className="mt-2">
                    投稿にはログインが必要です。Googleでログインするとすぐ投稿できます。
                  </p>
                  <button
                    className="mt-3 w-full rounded-2xl bg-[color:var(--accent)] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:translate-y-[-1px] hover:bg-[color:var(--accent-strong)]"
                    type="button"
                    onClick={() => signIn("google")}
                  >
                    Googleでログインして投稿
                  </button>
                </div>
              )}

              <button
                className="rounded-2xl bg-[color:var(--accent)] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:translate-y-[-1px] hover:bg-[color:var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                disabled={!session?.user || isSubmitting}
                onClick={handleSubmit}
              >
                {isSubmitting ? "送信中..." : "意見を送る"}
              </button>

              {session?.user && (
                <div className="flex flex-wrap gap-2 text-xs">
                  <button
                    className="rounded-full border border-[color:var(--line)] bg-white px-4 py-2 font-semibold text-[color:var(--panel-ink)]"
                    type="button"
                    onClick={() => signOut()}
                  >
                    ログアウト
                  </button>
                </div>
              )}

              <div className="rounded-2xl border border-[color:var(--line)] bg-white/70 p-4 text-xs text-[color:var(--muted)]">
                <p className="font-semibold text-[color:var(--panel-ink)]">集約プロセス</p>
                <p className="mt-2">
                  コメントはトピックごとにクラスタリングし、賛成/反対/中立をそれぞれ3文で要約します。
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="rounded-3xl border border-[color:var(--line)] bg-white/90 p-6 shadow-[var(--shadow)]">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-[color:var(--muted)]">
                    Topic Maps
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-[color:var(--panel-ink)]">
                    論点マップ（Talk To The City風）
                  </h2>
                </div>
                <div className="rounded-full bg-[color:var(--accent-warm)]/10 px-3 py-1 text-xs font-semibold text-[color:var(--accent-warm)]">
                  更新 {summary.updatedAt}
                </div>
              </div>

              <p className="mt-3 text-sm text-[color:var(--muted)]">
                トピックごとに縦に並べて表示します。全画面で拡大して閲覧できます。
              </p>

              <div className="mt-4 flex flex-col gap-5">
                {mapsToRender.map((topic) => (
                  <MapCard key={topic.id} topic={topic} roomId={roomId} />
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-[color:var(--line)] bg-white/80 p-6 text-sm text-[color:var(--muted)]">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-[color:var(--muted)]">
                    Roadmap
                  </p>
                  <p className="mt-2 text-lg font-semibold text-[color:var(--panel-ink)]">
                    配信者連携・自動カード生成へ
                  </p>
                </div>
                <button
                  className="rounded-full border border-[color:var(--line)] bg-white px-4 py-2 text-xs font-semibold text-[color:var(--panel-ink)]"
                  type="button"
                >
                  導入相談
                </button>
              </div>
              <p className="mt-3">
                次の段階では配信画面にリアルタイムで埋め込めるウィジェットと、試合後の総意カードを生成します。
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
