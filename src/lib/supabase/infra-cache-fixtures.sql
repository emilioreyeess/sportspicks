-- ─────────────────────────────────────────────────────────────────────────────
-- SportsPicks — Infraestructura de caché: llm_cache + fixtures (API-Football)
-- ─────────────────────────────────────────────────────────────────────────────
-- Objetivo: reducir gasto de tokens LLM (caché de respuestas) y llamadas a
-- API-Football (caché de fixtures). Ambas tablas son backend-only: RLS habilitada
-- con deny_anon, escritura/lectura exclusiva del service_role.
-- Migración idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── llm_cache ─────────────────────────────────────────────────────────────────
-- Cachea respuestas del LLM por hash del prompt para evitar regenerar lo mismo.
create table if not exists public.llm_cache (
  prompt_hash  text primary key,
  response     text not null,
  created_at   timestamptz not null default now()
);

-- Índice para purga por antigüedad (TTL 24h se aplica en la app, pero ayuda al
-- cron de limpieza si se añade en el futuro).
create index if not exists llm_cache_created_at_idx
  on public.llm_cache (created_at);

-- ── fixtures ──────────────────────────────────────────────────────────────────
-- Cachea partidos de API-Football. stats jsonb para estadísticas flexibles.
create table if not exists public.fixtures (
  fixture_id  bigint primary key,
  home_team   text,
  away_team   text,
  match_date  timestamptz,
  status      text,
  stats       jsonb,
  updated_at  timestamptz not null default now()
);

-- Índice para consultas por fecha (hot path de getFixtures por día).
create index if not exists fixtures_match_date_idx
  on public.fixtures (match_date);

-- ── RLS: bloquear anon en ambas tablas ────────────────────────────────────────
alter table public.llm_cache enable row level security;
alter table public.fixtures  enable row level security;

drop policy if exists deny_anon_llm_cache on public.llm_cache;
create policy deny_anon_llm_cache
  on public.llm_cache
  for all
  to anon
  using (false)
  with check (false);

drop policy if exists deny_anon_fixtures on public.fixtures;
create policy deny_anon_fixtures
  on public.fixtures
  for all
  to anon
  using (false)
  with check (false);

-- Verificación:
--   select relname, relrowsecurity from pg_class
--   where relname in ('llm_cache','fixtures');
--   select tablename, policyname from pg_policies
--   where tablename in ('llm_cache','fixtures');
