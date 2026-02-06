"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { mockSummary } from "@/lib/mock";

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

const topicMaps: TopicMap[] = [
  {
    id: "pressing",
    title: "前線プレスは今の戦術の核か？",
    prompt: "賛成・反対・中立それぞれの意見点が集まるマップ",
    clusters: [
      {
        stance: "support",
        center: { x: 260, y: 220 },
        radius: 150,
        subtopics: [
          { label: "連動性", count: 34 },
          { label: "回収率", count: 28 },
          { label: "圧力", count: 22 },
          { label: "守備強度", count: 26 },
        ],
      },
      {
        stance: "oppose",
        center: { x: 640, y: 240 },
        radius: 160,
        subtopics: [
          { label: "背後ケア", count: 30 },
          { label: "疲労", count: 20 },
          { label: "失点リスク", count: 26 },
          { label: "中盤の穴", count: 18 },
        ],
      },
      {
        stance: "neutral",
        center: { x: 460, y: 520 },
        radius: 140,
        subtopics: [
          { label: "相手次第", count: 24 },
          { label: "時間帯差", count: 18 },
          { label: "保留", count: 22 },
        ],
      },
    ],
  },
  {
    id: "midfield",
    title: "中盤の距離感は最適か？",
    prompt: "中盤論点の賛否と中立が点で見える",
    clusters: [
      {
        stance: "support",
        center: { x: 240, y: 250 },
        radius: 140,
        subtopics: [
          { label: "コンパクト", count: 26 },
          { label: "奪取", count: 22 },
          { label: "テンポ管理", count: 18 },
        ],
      },
      {
        stance: "oppose",
        center: { x: 650, y: 240 },
        radius: 150,
        subtopics: [
          { label: "展開不足", count: 24 },
          { label: "外が空く", count: 20 },
          { label: "縦詰まり", count: 18 },
        ],
      },
      {
        stance: "neutral",
        center: { x: 460, y: 520 },
        radius: 130,
        subtopics: [
          { label: "流動性", count: 22 },
          { label: "相手依存", count: 16 },
        ],
      },
    ],
  },
  {
    id: "wing",
    title: "両ウイングの仕掛けは活きているか？",
    prompt: "サイド論点の意見点を拡大して確認",
    clusters: [
      {
        stance: "support",
        center: { x: 260, y: 230 },
        radius: 150,
        subtopics: [
          { label: "1対1", count: 30 },
          { label: "幅確保", count: 24 },
          { label: "クロス", count: 18 },
        ],
      },
      {
        stance: "oppose",
        center: { x: 640, y: 240 },
        radius: 150,
        subtopics: [
          { label: "ロスト", count: 20 },
          { label: "連動不足", count: 18 },
          { label: "孤立", count: 16 },
        ],
      },
      {
        stance: "neutral",
        center: { x: 460, y: 520 },
        radius: 130,
        subtopics: [
          { label: "調子次第", count: 18 },
          { label: "中盤次第", count: 14 },
          { label: "判断待ち", count: 12 },
        ],
      },
    ],
  },
];

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
        });
      }
    });
  });

  return points;
};

const MapCard = ({ topic }: { topic: TopicMap }) => {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ x: 0, y: 0 });
  const offsetRef = useRef({ x: 0, y: 0 });

  const [points, setPoints] = useState<OpinionPoint[] | null>(null);

  useEffect(() => {
    setPoints(buildOpinionPoints(topic));
  }, [topic]);

  const subtopicAnchors = useMemo(() => {
    if (!points) return [] as Array<{ label: string; x: number; y: number; stance: Stance }>;
    return topic.clusters.flatMap((cluster) =>
      cluster.subtopics.map((subtopic) => {
        const relatedPoints = points.filter(
          (point) =>
            point.stance === cluster.stance &&
            point.subtopic === subtopic.label
        );
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
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.08 : 0.08;
    setScale((prev) => Math.min(2.2, Math.max(0.6, prev + delta)));
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(true);
    dragRef.current = { x: event.clientX, y: event.clientY };
    offsetRef.current = offset;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const dx = event.clientX - dragRef.current.x;
    const dy = event.clientY - dragRef.current.y;
    setOffset({ x: offsetRef.current.x + dx, y: offsetRef.current.y + dy });
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const resetView = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  return (
    <article className="min-w-[320px] flex-1 rounded-3xl border border-[color:var(--line)] bg-white/80 p-5 shadow-[var(--shadow)]">
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

      <div
        className="relative mt-4 h-[420px] overflow-hidden rounded-2xl border border-[color:var(--line)] bg-[color:var(--background)]"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
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
            }}
          >
            <svg
              viewBox="0 0 900 700"
              className="h-full w-full"
              role="img"
              aria-label="Opinion points map"
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

              {points.map((point) => (
                <circle
                  key={point.id}
                  cx={point.x}
                  cy={point.y}
                  r={3.2}
                  fill={stanceMeta[point.stance].color}
                  opacity={0.85}
                >
                  <title>{point.subtopic}</title>
                </circle>
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
          </div>
        )}
      </div>

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
    </article>
  );
};

export default function Home() {
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
              更新: {mockSummary.batchPolicy}
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
                  {mockSummary.matchLabel}
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
                      className="rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-medium text-[color:var(--panel-ink)] transition hover:translate-y-[-1px] hover:bg-white"
                      type="button"
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
                  placeholder="例: 前線の連動は良いが、背後の対応が遅い。"
                  className="mt-3 w-full rounded-2xl border border-[color:var(--line)] bg-white/80 p-4 text-sm text-[color:var(--panel-ink)] outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent)]/20"
                />
                <div className="mt-2 flex items-center justify-between text-xs text-[color:var(--muted)]">
                  <span>匿名投稿。公開時には要約にのみ反映。</span>
                  <span>0 / 300</span>
                </div>
              </div>

              <button
                className="rounded-2xl bg-[color:var(--accent)] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:translate-y-[-1px] hover:bg-[color:var(--accent-strong)]"
                type="button"
              >
                意見を送る
              </button>

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
                  更新 {mockSummary.updatedAt}
                </div>
              </div>

              <p className="mt-3 text-sm text-[color:var(--muted)]">
                スワイプでトピックを横スクロール。各点は参加者の意見を表します。
              </p>

              <div className="mt-4 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-4">
                {topicMaps.map((topic) => (
                  <div key={topic.id} className="snap-center">
                    <MapCard topic={topic} />
                  </div>
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
