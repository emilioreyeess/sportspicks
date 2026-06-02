-- ============================================================
-- SportsPicks — Distingue value picks oficiales de analysis views
-- ============================================================
-- Hasta ahora `predictions_log` mezclaba:
--   · value picks publicados por el pipeline (los que ven los users en /value)
--   · predicciones internas que registra /api/matches/analysis cuando alguien
--     abre el detalle de un partido (alimentan el ML loop pero NO son picks
--     "oficiales" del modelo).
--
-- El histórico debe mostrar SOLO los oficiales. Añadimos una columna `source`
-- para separarlos, hacemos backfill conservador (todos los existentes →
-- 'analysis_view', excepto los manuales de 2026-06-01 que sí fueron picks
-- reales), y actualizamos las RPCs para filtrar por defecto.
--
-- IDEMPOTENTE — safe re-run.
-- ============================================================

-- 1. Columna source con CHECK
alter table public.predictions_log
  add column if not exists source text not null default 'analysis_view'
  check (source in ('value_pick','analysis_view'));

create index if not exists predictions_log_source_idx
  on public.predictions_log (source);

create index if not exists predictions_log_source_status_idx
  on public.predictions_log (source, status);

-- 2. Backfill conservador
--    Los 3 picks manuales de 2026-06-01 (Remo / Everton CD / Fluminense)
--    SÍ fueron value picks oficiales del modelo → los marcamos.
--    El resto del histórico queda como 'analysis_view' (no se muestran en
--    /historico pero siguen calibrando Brier/ROI internos del ML loop).
update public.predictions_log
   set source = 'value_pick'
 where match_id like 'manual-2026-06-01-%'
   and source = 'analysis_view';

-- 3. Reemplazar RPCs para filtrar por defecto a value_pick
--    Mantenemos el parámetro opcional `p_source` por si el panel admin
--    quiere ver el feed completo (analysis_view incluidos).

drop function if exists public.get_picks_global_stats(text, timestamptz, text);
create or replace function public.get_picks_global_stats(
  p_context  text default 'club',
  p_since    timestamptz default null,
  p_user_id  text default null,
  p_source   text default 'value_pick'
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
      and (p_source  is null or source  = p_source)
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
    settled,
    wins,
    losses,
    voids,
    case when settled > 0
         then round((wins::numeric / settled::numeric) * 100, 2)
         else 0 end,
    case when avg_odd is not null then round(avg_odd::numeric, 3) else null end,
    case when staked_units > 0
         then round((profit_units::numeric / staked_units::numeric) * 100, 2)
         else 0 end
  from tally;
$$;

drop function if exists public.get_picks_history_page(timestamptz, int, text, text);
create or replace function public.get_picks_history_page(
  p_before   timestamptz default null,
  p_limit    int         default 50,
  p_context  text        default 'club',
  p_user_id  text        default null,
  p_source   text        default 'value_pick'
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
    and (p_before  is null or kickoff_iso < p_before)
    and (p_context is null or context = p_context)
    and (p_user_id is null or user_id = p_user_id)
    and (p_source  is null or source  = p_source)
  order by kickoff_iso desc, id desc
  limit greatest(1, least(p_limit, 200));
$$;

-- 4. Permisos
revoke all on function public.get_picks_global_stats(text, timestamptz, text, text) from public;
revoke all on function public.get_picks_history_page(timestamptz, int, text, text, text) from public;
grant execute on function public.get_picks_global_stats(text, timestamptz, text, text) to service_role;
grant execute on function public.get_picks_history_page(timestamptz, int, text, text, text) to service_role;

-- 5. Verificación
--    Antes del backfill: ambas devolvían 21 settled, 12 W, 9 L (mezclados).
--    Después: solo los 3 value picks reales (3 W, 0 L) en stats — el feed de
--    histórico verá únicamente los 3.
-- select * from get_picks_global_stats();
-- select * from get_picks_history_page(now(), 10);
