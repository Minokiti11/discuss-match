import { RoomSummary } from "./types";

export const mockSummary: RoomSummary = {
  roomId: "tbd",
  matchLabel: "TBD: 次の注目試合",
  updatedAt: "2026-02-07T00:45:00+09:00",
  batchPolicy: "5分ごと、または10件ごとに更新",
  topics: [
    {
      id: "pressing",
      title: "前線プレスの有効性",
      counts: { support: 52, oppose: 28, neutral: 14 },
      supportSummary:
        "前からの連動が噛み合い、相手のビルドアップが停滞している。セカンドボールの回収率も高いという見方が多い。",
      opposeSummary:
        "前線が空回りして背後のスペースを空けているという懸念。後半に体力が落ちると崩壊するという声。",
      neutralSummary:
        "相手の配置次第で効き目が変わるため、状況次第という意見が一定数。",
    },
    {
      id: "midfield",
      title: "中盤の距離感",
      counts: { support: 40, oppose: 35, neutral: 22 },
      supportSummary:
        "縦の距離が詰まり、中央での回収が安定したという評価。テンポを落とす場面で効果的。",
      opposeSummary:
        "距離を詰め過ぎて展開が単調になり、外での優位を作れないという指摘。",
      neutralSummary:
        "時間帯で良し悪しが分かれており、チームの狙いは見えるが結果待ちという声。",
    },
    {
      id: "wing",
      title: "両ウイングの仕掛け",
      counts: { support: 58, oppose: 18, neutral: 11 },
      supportSummary:
        "1対1の勝率が高く、幅を取れている。クロスの質も上がったという意見。",
      opposeSummary:
        "仕掛けの回数が多い分、ロストからのカウンターが怖いという懸念。",
      neutralSummary:
        "個の能力は高いが、周囲のサポートがまだ噛み合っていないという見方。",
    },
    {
      id: "setpiece",
      title: "セットプレー設計",
      counts: { support: 22, oppose: 19, neutral: 27 },
      supportSummary:
        "狙いが明確で、ニアの動きが効果的という評価。",
      opposeSummary:
        "キッカーの精度が安定せず、狙いが活きていないという声。",
      neutralSummary:
        "試行回数が少なく判断材料が不足しているという意見。",
    },
    {
      id: "referee",
      title: "判定の一貫性",
      counts: { support: 12, oppose: 46, neutral: 20 },
      supportSummary:
        "基準は一貫しているので受け入れられるという声が少数。",
      opposeSummary:
        "接触の基準がぶれており試合の流れを壊しているという不満が多い。",
      neutralSummary:
        "当たりの強いプレーは流し、軽い接触は取る傾向で賛否が割れている。",
    },
  ],
};
