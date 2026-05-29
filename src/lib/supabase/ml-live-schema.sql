-- ============================================================
-- SportsPicks — ML self-learning loop (STEP 1) + live cache (STEP 3)
-- Applied to Supabase project qtsbmazqjdmwssplactj (eu-west-1).
-- Idempotent: safe to re-run. Run in the Supabase SQL Editor.
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- STEP 1 — Continuous ML loop
-- ════════════════════════════════════════════════════════════

-- ── predictions_log ───────────────────────────────────────────
-- Every probability the AI emits is recorded here before kickoff.
-- The ml-settle cron (00:00 & 12:00) fetches FINAL results from
-- ESPN and flips status pending → won/lost/void. model_prob is
-- stored as 0..1. Written/read by the service-role client only.
create table if not exists public.predictions_log (
  id          uuid primary key default gen_random_uuid(),
  match_id    text not null,
  league      text not null,
  home_team   text,
  away_team   text,
  market      text not null,                 -- 1x2 | btts | goals_ou | corners_ou | cards_ou
  pick        text not null,
  odds        numeric,
  model_prob  numeric not null,              -- 0..1
  edge        numeric,
  user_id     text,                          -- NextAuth email, nullable
  kickoff_iso timestamptz,
  status      text not null default 'pending'
              check (status in ('pending','won','lost','void')),
  home_score  integer,
  away_score  integer,
  settled_at  timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists predictions_log_status_idx  on public.predictions_log (status);
create index if not exists predictions_log_match_idx   on public.predictions_log (match_id);
create index if not exists predictions_log_league_idx  on public.predictions_log (league);
create index if not exists predictions_log_market_idx  on public.predictions_log (market);
create index if not exists predictions_log_created_idx on public.predictions_log (created_at desc);

-- ── model_performance ─────────────────────────────────────────
-- Daily Brier score + accuracy + ROI per scope (global / league /
-- market), recomputed by computeBrierAndAccuracy() each cron run.
create table if not exists public.model_performance (
  id             uuid primary key default gen_random_uuid(),
  as_of_date     date not null,
  scope_type     text not null default 'global'
                 check (scope_type in ('global','league','market')),
  scope          text not null default 'global',
  samples        integer not null default 0,
  wins           integer not null default 0,
  accuracy       numeric,
  brier_score    numeric,                    -- mean((prob - outcome)^2)
  avg_model_prob numeric,
  avg_actual     numeric,
  roi            numeric,
  created_at     timestamptz not null default now(),
  unique (as_of_date, scope_type, scope)
);

create index if not exists model_performance_date_idx
  on public.model_performance (as_of_date desc);

-- ── team_form_weights ─────────────────────────────────────────
-- Self-adjusting multipliers the model ALWAYS consults before it
-- outputs a probability (getCombinedFormWeight). adjustTeamFormWeights()
-- nudges these toward avg_actual/avg_model_prob, clamped to 0.5..1.5,
-- by at most one MAX_WEIGHT_STEP per cycle, once samples >= 20.
create table if not exists public.team_form_weights (
  id          uuid primary key default gen_random_uuid(),
  scope_type  text not null check (scope_type in ('league','market','team')),
  scope_key   text not null,
  weight      numeric not null default 1.0 check (weight >= 0.5 and weight <= 1.5),
  samples     integer not null default 0,
  brier_score numeric,
  reason      text,
  updated_at  timestamptz not null default now(),
  unique (scope_type, scope_key)
);

create index if not exists team_form_weights_scope_idx
  on public.team_form_weights (scope_type, scope_key);

-- ════════════════════════════════════════════════════════════
-- STEP 3 — Global real-time live cache
-- ════════════════════════════════════════════════════════════

-- ── live_matches_cache ────────────────────────────────────────
-- The live-sync cron (every 60s) is the ONLY caller of ESPN for live
-- data: it upserts every fixture here. Browsers never hit ESPN — they
-- read this table once and then subscribe via Supabase Realtime. One
-- external API call per minute serves all clients.
create table if not exists public.live_matches_cache (
  match_id      text primary key,
  league        text not null,
  league_name   text,
  home_team     text,
  away_team     text,
  home_logo     text,
  away_logo     text,
  home_score    integer default 0,
  away_score    integer default 0,
  status_state  text,                        -- pre | in | post
  status_detail text,
  clock         text,
  kickoff_iso   timestamptz,
  odds_home     numeric,
  odds_draw     numeric,
  odds_away     numeric,
  payload       jsonb not null default '{}'::jsonb,
  updated_at    timestamptz not null default now()
);

create index if not exists live_matches_cache_kickoff_idx on public.live_matches_cache (kickoff_iso);
create index if not exists live_matches_cache_status_idx  on public.live_matches_cache (status_state);

-- ════════════════════════════════════════════════════════════
-- Row Level Security
-- ════════════════════════════════════════════════════════════
-- The three ML tables are service-role only: RLS on, no anon policy,
-- so the model's internal logs/weights are never exposed to clients.
alter table public.predictions_log   enable row level security;
alter table public.model_performance enable row level security;
alter table public.team_form_weights enable row level security;

-- live_matches_cache is public-read so the browser can hydrate the
-- "Partidos de Hoy" grid and the live overlay. Writes still require
-- the service role (no insert/update/delete policy granted to anon).
alter table public.live_matches_cache enable row level security;

drop policy if exists "live_matches_public_read" on public.live_matches_cache;
create policy "live_matches_public_read" on public.live_matches_cache
  for select using (true);

-- ════════════════════════════════════════════════════════════
-- Realtime — broadcast live_matches_cache changes over WebSocket
-- (postgres_changes). Respects RLS, so only the public-read rows
-- above are streamed. Wrapped to stay idempotent.
-- ════════════════════════════════════════════════════════════
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'live_matches_cache'
  ) then
    alter publication supabase_realtime add table public.live_matches_cache;
  end if;
end $$;
