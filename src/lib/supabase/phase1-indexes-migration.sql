-- ============================================================
-- SportsPicks — FASE 1: Indexing, Meta-Indexing & N+1 Fix
-- Cloud Architect · Senior DBA · Lead Backend Engineer
--
-- Strategy:
--   1. Composite B-Tree indexes on hot filter+sort paths
--   2. Partial index on predictions_log (pending only)
--   3. GIN trigram indexes for team-name text search
--   4. users_log coverage for admin dashboard
--   5. RPC to collapse groups N+1 into a single aggregated query
--
-- Idempotent: safe to re-run (all IF NOT EXISTS).
-- Run in Supabase SQL Editor (service_role context).
-- ============================================================

-- ── Prerequisites ────────────────────────────────────────────
create extension if not exists pg_trgm;

-- ═══════════════════════════════════════════════════════════
-- 1. bets — hot paths
-- ═══════════════════════════════════════════════════════════

-- GET /api/bets: .eq("user_email").order("created_at", desc)
-- Composite allows Postgres to go straight to user rows, pre-sorted
create index if not exists bets_user_created_at
  on public.bets (user_email, created_at desc);

-- Stats computation + admin: filter by user AND status
create index if not exists bets_user_status
  on public.bets (user_email, status);

-- Public picks feed: .eq("is_published", true).order("created_at", desc)
create index if not exists bets_published_created
  on public.bets (is_published, created_at desc)
  where is_published = true;

-- ═══════════════════════════════════════════════════════════
-- 2. predictions_log — ML settle cron & winrate engine
-- ═══════════════════════════════════════════════════════════

-- CRITICAL: settle cron queries pending predictions by kickoff time.
-- SELECT * FROM predictions_log WHERE status='pending' AND kickoff_iso < now()
-- Partial index — only covers the ~small% of rows that are pending.
-- Drops to near-zero cost once most rows are settled.
create index if not exists predictions_log_pending_kickoff
  on public.predictions_log (kickoff_iso)
  where status = 'pending';

-- Winrate engine: GROUP BY league, market WHERE status IN ('won','lost')
create index if not exists predictions_log_status_league_market
  on public.predictions_log (status, league, market);

-- AI stats route: look up all picks for a specific league
create index if not exists predictions_log_league_status
  on public.predictions_log (league, status);

-- Settle cron join: match_id lookup (already exists as single-col, add status)
create index if not exists predictions_log_match_status
  on public.predictions_log (match_id, status);

-- ═══════════════════════════════════════════════════════════
-- 3. model_performance — scope-specific lookups
-- ═══════════════════════════════════════════════════════════

-- Query pattern: WHERE scope_type = 'league' AND scope = 'laliga' ORDER BY as_of_date DESC
-- Existing index only covers as_of_date. This composite allows instant scope filtering.
create index if not exists model_performance_scope_date
  on public.model_performance (scope_type, scope, as_of_date desc);

-- ═══════════════════════════════════════════════════════════
-- 4. live_matches_cache — real-time grid & bot match search
-- ═══════════════════════════════════════════════════════════

-- "Partidos de Hoy" grid: WHERE status_state = 'pre' ORDER BY kickoff_iso
create index if not exists live_matches_state_kickoff
  on public.live_matches_cache (status_state, kickoff_iso);

-- Composite: league filter + status filter (e.g. "all live laliga matches")
create index if not exists live_matches_league_state
  on public.live_matches_cache (league, status_state);

-- Bot IA match search: trigram on team names for fast ILIKE/similarity queries
create index if not exists live_matches_home_trgm
  on public.live_matches_cache using gin (home_team gin_trgm_ops);

create index if not exists live_matches_away_trgm
  on public.live_matches_cache using gin (away_team gin_trgm_ops);

-- ═══════════════════════════════════════════════════════════
-- 5. users_log — admin dashboard
-- ═══════════════════════════════════════════════════════════
-- NOTE: users_log was created before this repo. Add indexes only.
-- Admin route: ORDER BY last_sign_in DESC (no index → full seq scan)
create index if not exists users_log_last_sign_in
  on public.users_log (last_sign_in desc nulls last);

-- Admin filter/segment by subscription plan
create index if not exists users_log_plan
  on public.users_log (plan);

-- Admin ILIKE search on email (trgm enables fast partial match)
create index if not exists users_log_email_trgm
  on public.users_log using gin (email gin_trgm_ops);

-- ═══════════════════════════════════════════════════════════
-- 6. ai_learning_embeddings — JSONB metadata lookups
-- ═══════════════════════════════════════════════════════════

-- RAG pipeline filters embeddings by metadata keys (league, type, etc.)
create index if not exists embeddings_metadata_gin
  on public.ai_learning_embeddings using gin (metadata jsonb_path_ops);

-- ═══════════════════════════════════════════════════════════
-- 7. tipster_bounties — tipster dashboard queries
-- ═══════════════════════════════════════════════════════════

-- tipster_email + status: "my pending bounties"
create index if not exists bounties_tipster_status
  on public.tipster_bounties (tipster_email, status);

-- ═══════════════════════════════════════════════════════════
-- 8. N+1 FIX: RPC get_user_groups
-- ═══════════════════════════════════════════════════════════
-- Problem: GET /api/groups does:
--   Q1: SELECT group_id FROM group_members WHERE user_email = email   (1 query)
--   Q2: SELECT * FROM friend_groups WHERE id IN (groupIds)            (1 query)
--   Qn: SELECT COUNT(*) FROM group_members WHERE group_id = g.id      (N queries, 1 per group!)
--
-- This RPC collapses all N+2 queries into a single aggregated JOIN.
-- Average user with 5 groups: 7 queries → 1 query (86% reduction).
-- ─────────────────────────────────────────────────────────────
create or replace function public.get_user_groups(p_email text)
returns table (
  id           uuid,
  name         text,
  description  text,
  emoji        text,
  created_by   text,
  invite_code  text,
  is_private   boolean,
  created_at   timestamptz,
  member_count bigint,
  my_role      text
)
language sql
security definer
set search_path = public
as $$
  select
    fg.id,
    fg.name,
    fg.description,
    fg.emoji,
    fg.created_by,
    fg.invite_code,
    fg.is_private,
    fg.created_at,
    count(all_m.id)::bigint    as member_count,
    my_m.role                  as my_role
  from public.group_members my_m
  join public.friend_groups fg
    on fg.id = my_m.group_id
  left join public.group_members all_m
    on all_m.group_id = fg.id
  where my_m.user_email = p_email
  group by
    fg.id, fg.name, fg.description, fg.emoji,
    fg.created_by, fg.invite_code, fg.is_private, fg.created_at,
    my_m.role
  order by fg.created_at desc
$$;

-- Grant execute to the service_role (anon/authenticated are blocked by RLS anyway)
grant execute on function public.get_user_groups(text) to service_role;

-- ═══════════════════════════════════════════════════════════
-- 9. World Cup 2026 — supplement missing composite indexes
-- ═══════════════════════════════════════════════════════════

-- Match lookup by stage + status (knockout bracket filters)
create index if not exists wc_matches_stage_status
  on public.wc_matches (stage, status);

-- Standings view performance: filter final + group together
create index if not exists wc_matches_group_status
  on public.wc_matches ("group", status);

-- Player search by team + position (lineup builder)
create index if not exists wc_players_team_pos
  on public.wc_players (team_code, "position");

-- wc_odds: bookmaker filter within a match
create index if not exists wc_odds_match_bookmaker
  on public.wc_odds (match_id, bookmaker, market);
