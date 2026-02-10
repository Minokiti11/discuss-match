-- Match Tables Migration
-- Premier League match scheduling and hot topics feature

-- Matches table: Store Premier League match data from football-data.org API
CREATE TABLE IF NOT EXISTS public.matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text UNIQUE NOT NULL, -- football-data.org match ID
  competition text NOT NULL DEFAULT 'PL',
  home_team text NOT NULL,
  away_team text NOT NULL,
  home_crest text,
  away_crest text,
  kickoff_time timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('SCHEDULED', 'LIVE', 'FINISHED', 'POSTPONED')),
  home_score int DEFAULT 0,
  away_score int DEFAULT 0,
  minute int DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS matches_status_kickoff_idx
ON public.matches (status, kickoff_time DESC);

CREATE INDEX IF NOT EXISTS matches_kickoff_idx
ON public.matches (kickoff_time DESC);

CREATE INDEX IF NOT EXISTS matches_external_id_idx
ON public.matches (external_id);

-- Match rooms: Junction table linking matches to voting rooms
CREATE TABLE IF NOT EXISTS public.match_rooms (
  match_id uuid REFERENCES public.matches(id) ON DELETE CASCADE,
  room_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, room_id)
);

CREATE INDEX IF NOT EXISTS match_rooms_room_id_idx
ON public.match_rooms (room_id);

-- Hot topics: Controversial discussion points with Yes/No voting
CREATE TABLE IF NOT EXISTS public.hot_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id text NOT NULL,
  topic_text text NOT NULL CHECK (length(topic_text) <= 100),
  yes_count int DEFAULT 0 CHECK (yes_count >= 0),
  no_count int DEFAULT 0 CHECK (no_count >= 0),
  velocity_score float DEFAULT 0 CHECK (velocity_score >= 0), -- votes per minute
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fetching top hot topics by velocity
CREATE INDEX IF NOT EXISTS hot_topics_room_active_velocity_idx
ON public.hot_topics (room_id, is_active, velocity_score DESC);

CREATE INDEX IF NOT EXISTS hot_topics_room_created_idx
ON public.hot_topics (room_id, created_at DESC);

-- Hot topic votes: User votes on controversial topics
CREATE TABLE IF NOT EXISTS public.hot_topic_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hot_topic_id uuid REFERENCES public.hot_topics(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  vote boolean NOT NULL, -- true=yes, false=no
  reason text CHECK (reason IS NULL OR length(reason) <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(hot_topic_id, user_id) -- One vote per user per topic
);

CREATE INDEX IF NOT EXISTS hot_topic_votes_topic_created_idx
ON public.hot_topic_votes (hot_topic_id, created_at DESC);

CREATE INDEX IF NOT EXISTS hot_topic_votes_user_idx
ON public.hot_topic_votes (user_id);

-- Add match_id reference to votes table (optional, for future analytics)
ALTER TABLE public.votes
ADD COLUMN IF NOT EXISTS match_id uuid REFERENCES public.matches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS votes_match_id_idx
ON public.votes (match_id) WHERE match_id IS NOT NULL;

-- Trigger to automatically update updated_at on matches
CREATE TRIGGER update_matches_updated_at
BEFORE UPDATE ON public.matches
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger to automatically update updated_at on hot_topics
CREATE TRIGGER update_hot_topics_updated_at
BEFORE UPDATE ON public.hot_topics
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
