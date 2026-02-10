"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { mockSummary } from "@/lib/mock";
import { RoomSummary } from "@/lib/types";
import {
  TransformComponent,
  TransformWrapper,
  type ReactZoomPanPinchRef,
} from "react-zoom-pan-pinch";
import { HotTopics } from "@/components/HotTopics";

const stanceMeta = {
  support: { label: "賛成", color: "#22c55e" },
  oppose: { label: "反対", color: "#f43f5e" },
  neutral: { label: "中立", color: "#94a3b8" },
} as const;

type Stance = keyof typeof stanceMeta;

type OpinionPoint = {
  id: string;
  stance?: Stance;
  category: string;
  x: number;
  y: number;
  topicId: string;
  topicTitle: string;
  color: string;
};

type TopicMap = {
  id: string;
  title: string;
  prompt: string;
  categories: {
    label: string;
    center: { x: number; y: number };
    radius: number;
    count: number;
    color: string;
  }[];
};

const MAP_WIDTH = 900;
const MAP_HEIGHT = 700;

const categoryPalette = [
  "#1f6feb",
  "#f97316",
  "#22c55e",
  "#ef4444",
  "#a855f7",
  "#14b8a6",
  "#f59e0b",
  "#38bdf8",
];

const categoryCenters = [
  { x: 200, y: 160 },
  { x: 450, y: 140 },
  { x: 700, y: 210 },
  { x: 650, y: 420 },
  { x: 420, y: 520 },
  { x: 200, y: 440 },
  { x: 320, y: 280 },
  { x: 560, y: 320 },
];

const mockMatchCategories = [
  "前線の連動",
  "中盤のプレス",
  "サイドの崩し",
  "背後のケア",
  "ビルドアップ",
  "決定力",
  "交代采配",
  "守備ブロック",
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

    const labels = mockMatchCategories;
    const per = 8;

    const categories = labels.map((label, idx) => ({
      label,
      center: categoryCenters[idx % categoryCenters.length],
      radius: 140,
      count: per,
      color: categoryPalette[idx % categoryPalette.length],
    }));

    return {
      id: topic.id || `topic-${index}`,
      title: topic.title,
      prompt: "今日の試合で多かった話題をカテゴリ別に可視化。",
      categories,
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

  topic.categories.forEach((category) => {
    for (let i = 0; i < category.count; i += 1) {
        seed += 1;
        const angle = pseudoRandom(seed) * Math.PI * 2;
        seed += 1;
        const radius = Math.sqrt(pseudoRandom(seed)) * (category.radius - 20);
        const jitter = (pseudoRandom(seed + 1) - 0.5) * 8;
        const x = category.center.x + Math.cos(angle) * radius + jitter;
        const y = category.center.y + Math.sin(angle) * radius + jitter;
        points.push({
          id: `${topic.id}-${category.label}-${i}`,
          category: category.label,
          x,
          y,
          topicId: topic.id,
          topicTitle: topic.title,
          color: category.color,
        });
      }
  });

  return points;
};

const MapCard = ({ topic }: { topic: TopicMap }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>(
    topic.categories[0]?.label ?? ""
  );
  const normalTransformRef = useRef<ReactZoomPanPinchRef | null>(null);
  const fullTransformRef = useRef<ReactZoomPanPinchRef | null>(null);

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

  const categoryAnchors = useMemo(() => {
    if (!points) return [] as Array<{ label: string; x: number; y: number; color: string }>;
    return topic.categories.map((category) => {
      const relatedPoints = points.filter((point) => point.category === category.label);
      if (!relatedPoints.length) {
        return {
          label: category.label,
          x: category.center.x,
          y: category.center.y,
          color: category.color,
        };
      }
      const avgX =
        relatedPoints.reduce((acc, point) => acc + point.x, 0) /
        relatedPoints.length;
      const avgY =
        relatedPoints.reduce((acc, point) => acc + point.y, 0) /
        relatedPoints.length;
      return { label: category.label, x: avgX, y: avgY, color: category.color };
    });
  }, [points, topic]);

  const resetView = () => {
    normalTransformRef.current?.resetTransform();
  };

  const mockOpinions = useMemo(() => {
    const base = [
      "連動が良くなってチャンスが増えた",
      "もう少し距離感を詰めたい",
      "相手のプレスに対して判断が遅い",
      "リズムが出た時間帯がはっきりしていた",
      "改善できれば得点に直結しそう",
    ];
    return topic.categories.reduce<Record<string, string[]>>((acc, cat) => {
      acc[cat.label] = base.map((text) => `${cat.label}: ${text}`);
      return acc;
    }, {});
  }, [topic.categories]);

  const renderMap = (
    heightClass: string,
    ref: React.RefObject<ReactZoomPanPinchRef | null>,
    initialScale: number
  ) => (
    <TransformWrapper
      ref={ref}
      minScale={0.7}
      maxScale={2.2}
      initialScale={initialScale}
      centerOnInit
      limitToBounds
      centerZoomedOut
      wheel={{ step: 0.08 }}
      doubleClick={{ disabled: true }}
      panning={{ velocityDisabled: true }}
    >
      <div
        className={`relative w-full overflow-hidden rounded-2xl border border-[color:var(--line)] bg-[color:var(--background)] ${heightClass}`}
      >
        <TransformComponent
          wrapperClass="h-full w-full"
          contentClass="relative h-full w-full"
          wrapperStyle={{ touchAction: "none", width: "100%", height: "100%" }}
        >
          {!points ? (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-[color:var(--muted)]">
              読み込み中…
            </div>
          ) : (
            <div
              className="relative h-full w-full"
              role="img"
              aria-label="Opinion points map"
            >
              <svg
                viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
                preserveAspectRatio="xMidYMid meet"
                className="h-full w-full"
              >
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

              {topic.categories.map((category) => (
                <g key={category.label}>
                  <circle
                    cx={category.center.x}
                    cy={category.center.y}
                    r={category.radius}
                    fill={category.color}
                    opacity={0.08}
                  />
                </g>
              ))}

              {categoryAnchors.map((anchor) => (
                <g key={anchor.label}>
                  <rect
                    x={anchor.x - 44}
                    y={anchor.y - 18}
                    rx={10}
                    ry={10}
                    width={88}
                    height={24}
                    fill="#ffffff"
                    opacity={0.95}
                  />
                  <text
                    x={anchor.x}
                    y={anchor.y - 2}
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
                const left = `${(point.x / MAP_WIDTH) * 100}%`;
                const top = `${(point.y / MAP_HEIGHT) * 100}%`;
                return (
                  <button
                    key={point.id}
                    type="button"
                    onClick={() => {
                      setSelectedCategory(point.category);
                    }}
                    className="absolute h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full transition hover:scale-110 focus:outline-none sm:h-2 sm:w-2"
                  style={{
                    left,
                    top,
                    background: point.color,
                    opacity: 0.9,
                  }}
                  aria-label={`${point.topicTitle} ${point.category}`}
                />
              );
            })}
            </div>
          )}
        </TransformComponent>

        <div className="pointer-events-none absolute left-2 top-2 hidden flex-col gap-1 rounded-xl border border-[color:var(--line)] bg-white/80 px-3 py-2 text-[11px] text-[color:var(--muted)] shadow-sm sm:flex">
          <span>ドラッグ: 移動</span>
          <span>ピンチ / + − : ズーム</span>
          <span>点タップ: 右に表示</span>
        </div>
      </div>
    </TransformWrapper>
  );

  return (
    <article className="w-full rounded-[28px] bg-[#1f2657] p-5 shadow-[0_30px_70px_rgba(17,24,39,0.35)]">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(220px,300px)]">
        <div className="rounded-[22px] bg-[#eaf3fb] p-4 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.08)]">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#5a6c86]">
            <span>Topic Map</span>
            <div className="flex items-center gap-2 text-[11px] normal-case tracking-normal">
              <button
                className="rounded-full border border-white/70 bg-white px-3 py-1 font-semibold text-[#1f2657]"
                type="button"
                onClick={() => setIsExpanded(true)}
              >
                全画面
              </button>
              <button
                className="rounded-full border border-white/70 bg-white px-3 py-1 font-semibold text-[#1f2657]"
                type="button"
                onClick={() => normalTransformRef.current?.zoomIn(0.15)}
              >
                +
              </button>
              <button
                className="rounded-full border border-white/70 bg-white px-3 py-1 font-semibold text-[#1f2657]"
                type="button"
                onClick={() => normalTransformRef.current?.zoomOut(0.15)}
              >
                −
              </button>
              <button
                className="rounded-full border border-white/70 bg-white px-3 py-1 font-semibold text-[#1f2657]"
                type="button"
                onClick={resetView}
              >
                Reset
              </button>
            </div>
          </div>
          {renderMap("h-[320px] sm:h-[380px] lg:h-[420px]", normalTransformRef, 1.05)}
        </div>

        <div className="rounded-[22px] bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.15)]">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#64748b]">
            Insight Card
          </p>
          <h3 className="mt-3 text-2xl font-semibold text-[#111827]">
            {topic.title}
          </h3>
          <p className="mt-2 text-sm text-[#6b7280]">{topic.prompt}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-[#64748b]">
            {topic.categories.slice(0, 6).map((item) => (
              <span
                key={item.label}
                className="flex items-center gap-2 rounded-full border border-[#e2e8f0] bg-[#f8fafc] px-3 py-1"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: item.color }}
                />
                <span>{item.label}</span>
              </span>
            ))}
          </div>
          <div className="mt-4 rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] p-4 text-sm text-[#1f2937]">
            <p className="text-xs uppercase tracking-[0.2em] text-[#64748b]">
              選択中の論点
            </p>
            <h4 className="mt-2 text-lg font-semibold text-[#111827]">
              {selectedCategory || "カテゴリを選択"}
            </h4>
            <div className="mt-3 flex flex-col gap-2 text-sm text-[#475569]">
              {(mockOpinions[selectedCategory] ?? []).map((line, idx) => (
                <p key={`${selectedCategory}-${idx}`}>{line}</p>
              ))}
              {!mockOpinions[selectedCategory]?.length && (
                <p>点をタップすると同じクラスタの意見が表示されます。</p>
              )}
            </div>
          </div>
          <p className="mt-4 text-xs text-[#94a3b8]">
            点をタップすると右側に同クラスタの意見が表示されます。
          </p>
        </div>
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
                onClick={() => fullTransformRef.current?.zoomIn(0.15)}
              >
                +
              </button>
              <button
                className="rounded-full border border-[color:var(--line)] bg-white px-3 py-1 font-semibold text-[color:var(--panel-ink)]"
                type="button"
                onClick={() => fullTransformRef.current?.zoomOut(0.15)}
              >
                −
              </button>
              <button
                className="rounded-full border border-[color:var(--line)] bg-white px-3 py-1 font-semibold text-[color:var(--panel-ink)]"
                type="button"
                onClick={() => fullTransformRef.current?.resetTransform()}
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
            {renderMap("h-[calc(100dvh-140px)]", fullTransformRef, 1.2)}
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
            {/* Hot Topics Section */}
            <HotTopics roomId={roomId} />

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
                  <MapCard key={topic.id} topic={topic} />
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
