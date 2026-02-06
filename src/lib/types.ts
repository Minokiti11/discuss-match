export type Stance = "support" | "oppose" | "neutral";

export interface VoteInput {
  stance: Stance;
  comment: string;
  createdAt?: string;
}

export interface TopicCounts {
  support: number;
  oppose: number;
  neutral: number;
}

export interface TopicSummary {
  id: string;
  title: string;
  counts: TopicCounts;
  supportSummary: string;
  opposeSummary: string;
  neutralSummary: string;
}

export interface RoomSummary {
  roomId: string;
  matchLabel: string;
  updatedAt: string;
  batchPolicy: string;
  topics: TopicSummary[];
}
