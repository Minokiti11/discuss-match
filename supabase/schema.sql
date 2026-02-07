-- Match Note MVP schema

create extension if not exists pgcrypto;

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  room_id text not null,
  stance text not null check (stance in ('support', 'oppose', 'neutral')),
  comment text not null,
  user_id text not null,
  created_at timestamptz not null default now()
);

create index if not exists votes_room_created_idx on public.votes (room_id, created_at desc);
create index if not exists votes_user_idx on public.votes (user_id);

create table if not exists public.summaries (
  id uuid primary key default gen_random_uuid(),
  room_id text not null,
  snapshot text not null default 'live',
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists summaries_room_created_idx on public.summaries (room_id, created_at desc);
