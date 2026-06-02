-- ============================================================
-- SportsPicks — Historial global + winrate agregado
-- ============================================================
-- Aporta los RPCs que necesita /api/picks/history y /api/picks/stats
-- para evitar traer miles de filas al cliente. Todo es agregación
-- server-side sobre `predictions_log` (la tabla ya existe).
--
-- IDEMPOTENTE — safe re-run. Aplicar en Supabase SQL Editor.
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- 1. RPC: estadísticas globales de picks resueltos
-- ════════════════════════════════════════════════════════════
-- Cuenta wins/losses/voids agregando directamente en Postgres.
-- Excluye 'pending' por definición. Filtros opcionales:
--   p_context   — "club" | "international_friendly" | ... | null = todos
--   p_since     — fecha mínima de kickoff (null = sin límite)
--   p_user_id   — solo predicciones del sistema por defecto (user_id IS NULL)
create or replace function public.get_picks_global_stats(
  p_context  text default 'club',
  p_since    timestamptz default null,
  p_user_id  text default null
)
returns table (
  total_settled  bigint,
  wins           bigint,
  losses         bigint,
  voids          bigint,
  winrate_pct    numeric,
  avg_odd        numeric,
  roi_pct        numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with src as (
    select status, odds
    from public.predictions_log
    where status in ('won','lost','void')
      and (p_context is null or context = p_context)
      and (p_since   is null or kickoff_iso >= p_since)
      and (p_user_id is null or user_id = p_user_id)
  ),
  tally as (
    select
      count(*) filter (where status in ('won','lost'))           as settled,
      count(*) filter (where status = 'won')                     as wins,
      count(*) filter (where status = 'lost')                    as losses,
      count(*) filter (where status = 'void')                    as voids,
      avg(odds) filter (where status in ('won','lost'))          as avg_odd,
      sum(case when status = 'won' and odds is not null
               then odds - 1 else 0 end)
        - count(*) filter (where status = 'lost')                as profit_units,
      count(*) filter (where status in ('won','lost')
                       and odds is not null)                     as staked_units
    from src
  )
  select
    settled                                                       as total_settled,
    wins                                                          as wins,
    losses                                                        as losses,
    voids                                                         as voids,
    case when settled > 0
         then round((wins::numeric / settled::numeric) * 100, 2)
         else 0 end                                               as winrate_pct,
    case when avg_odd is not null then round(avg_odd::numeric, 3) else null end as avg_odd,
    case when staked_units > 0
         then round((profit_units::numeric / staked_units::numeric) * 100, 2)
         else 0 end                                               as roi_pct
  from tally;
$$;

comment on function public.get_picks_global_stats is
  'Agrega wins/losses/voids/winrate/ROI sobre predictions_log. Excluye pending.';

-- ════════════════════════════════════════════════════════════
-- 2. RPC: una página del histórico (cursor por kickoff_iso DESC)
-- ════════════════════════════════════════════════════════════
-- Devuelve los próximos N picks finalizados (won/lost/void) cuyo
-- kickoff es ESTRICTAMENTE anterior al cursor `p_before`. El TS
-- agrupa por fecha y construye nextCursor = última row.kickoff_iso.
create or replace function public.get_picks_history_page(
  p_before   timestamptz default null,
  p_limit    int         default 50,
  p_context  text        default 'club',
  p_user_id  text        default null
)
returns table (
  id           uuid,
  match_id     text,
  league       text,
  home_team    text,
  away_team    text,
  market       text,
  pick         text,
  odds         numeric,
  model_prob   numeric,
  edge         numeric,
  kickoff_iso  timestamptz,
  status       text,
  home_score   integer,
  away_score   integer,
  settled_at   timestamptz,
  context      text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    id, match_id, league, home_team, away_team,
    market, pick, odds, model_prob, edge,
    kickoff_iso, status, home_score, away_score, settled_at, context
  from public.predictions_log
  where status in ('won','lost','void')
    and (p_before   is null or kickoff_iso < p_before)
    and (p_context  is null or context = p_context)
    and (p_user_id  is null or user_id = p_user_id)
  order by kickoff_iso desc, id desc
  limit greatest(1, least(p_limit, 200));
$$;

comment on function public.get_picks_history_page is
  'Página de historial picks ordenada por kickoff_iso DESC. Cursor: pasa la última kickoff_iso recibida como p_before.';

-- ════════════════════════════════════════════════════════════
-- 3. Permisos — service_role + ejecutables vía RPC desde el server
-- ════════════════════════════════════════════════════════════
-- Las funciones son SECURITY DEFINER → corren con el dueño y leen
-- predictions_log aunque RLS esté activo. Solo el service-role
-- client del backend invoca estos RPCs; el anon no tiene grant.
revoke all on function public.get_picks_global_stats(text, timestamptz, text) from public;
revoke all on function public.get_picks_history_page(timestamptz, int, text, text) from public;

grant execute on function public.get_picks_global_stats(text, timestamptz, text) to service_role;
grant execute on function public.get_picks_history_page(timestamptz, int, text, text) to service_role;

-- ════════════════════════════════════════════════════════════
-- 4. Soporte de mercado "handicap" en predictions_log
-- ════════════════════════════════════════════════════════════
-- El value engine emite picks "Hándicap"; los logueamos a
-- predictions_log mapeados como market='handicap' para que entren
-- al historial. El check actual NO restringe `market`, así que
-- no hace falta migrar la columna — pero documentamos el valor
-- canónico aquí para que esté de referencia.
-- (No-op DDL — el catálogo de mercados es un text libre por diseño.)

-- ════════════════════════════════════════════════════════════
-- Verificación rápida
-- ════════════════════════════════════════════════════════════
-- select * from get_picks_global_stats();
-- select * from get_picks_history_page(now(), 5);
