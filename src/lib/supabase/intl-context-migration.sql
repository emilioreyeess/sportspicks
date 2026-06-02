-- ============================================================
-- SportsPicks — International context isolation (WC 2026 prep)
-- ============================================================
-- Aísla las predicciones de selecciones (amistosos + competitivas)
-- del flujo de aprendizaje del fútbol de clubes. Sin esto, un
-- amistoso Brasil–Senegal con rotaciones y resultado raro empuja
-- los pesos del Brasileirão (perdiendo calibración para clubes).
--
-- Idempotente: SAFE re-run. Aplicar en Supabase SQL Editor del
-- proyecto qtsbmazqjdmwssplactj (eu-west-1).
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- 1. predictions_log — columna `context`
-- ════════════════════════════════════════════════════════════
-- Etiqueta cada predicción con su contexto competitivo. Valores:
--   · "club"                       → liga doméstica + UEFA clubs
--   · "international_friendly"     → amistosos de selecciones
--   · "international_competitive"  → Mundial, Eurocopa, Copa América…
-- Default 'club' para no romper datos históricos (todos pre-migración
-- son de clubes — fifa.friendly aún no se ingestaba).
alter table public.predictions_log
  add column if not exists context text not null default 'club'
  check (context in ('club','international_friendly','international_competitive'));

-- Índices para queries de Brier/accuracy agrupadas por contexto.
create index if not exists predictions_log_context_idx
  on public.predictions_log (context);

create index if not exists predictions_log_context_status_idx
  on public.predictions_log (context, status);

-- ════════════════════════════════════════════════════════════
-- 2. model_performance — admitir scope_type='context'
-- ════════════════════════════════════════════════════════════
-- El CHECK original solo permitía 'global'|'league'|'market'.
-- Hay que ampliarlo. Postgres no permite editar un CHECK in-place:
-- lo dropeamos y recreamos.
alter table public.model_performance
  drop constraint if exists model_performance_scope_type_check;

alter table public.model_performance
  add constraint model_performance_scope_type_check
  check (scope_type in ('global','league','market','context'));

-- ════════════════════════════════════════════════════════════
-- 3. team_form_weights — admitir scope_type='context'
-- ════════════════════════════════════════════════════════════
-- Igual que arriba: el motor podrá guardar/leer un peso por
-- contexto, p.ej. un multiplicador específico para
-- 'international_friendly' que NO toca el de clubes.
alter table public.team_form_weights
  drop constraint if exists team_form_weights_scope_type_check;

alter table public.team_form_weights
  add constraint team_form_weights_scope_type_check
  check (scope_type in ('league','market','team','context'));

-- ════════════════════════════════════════════════════════════
-- 4. Seed inicial — pesos neutros por contexto
-- ════════════════════════════════════════════════════════════
-- Insertamos 1.0 para los tres contextos si no existen, así el
-- motor encuentra un peso aunque aún no haya samples para ajustar.
insert into public.team_form_weights (scope_type, scope_key, weight, reason)
values
  ('context', 'club',                       1.00, 'seed inicial — calibración por defecto'),
  ('context', 'international_friendly',     1.00, 'seed inicial — pre-Mundial 2026'),
  ('context', 'international_competitive',  1.00, 'seed inicial — pre-Mundial 2026')
on conflict (scope_type, scope_key) do nothing;

-- ════════════════════════════════════════════════════════════
-- 5. (Opcional) Backfill — todos los registros previos eran club
-- ════════════════════════════════════════════════════════════
-- Ya cubierto por DEFAULT 'club' en el ADD COLUMN; este UPDATE
-- es no-op si todo el histórico ya quedó marcado como 'club'.
update public.predictions_log
  set context = 'club'
  where context is null;

-- ════════════════════════════════════════════════════════════
-- Verificación — debería devolver 3 filas (una por contexto).
-- ════════════════════════════════════════════════════════════
-- select scope_key, weight, samples, updated_at
-- from public.team_form_weights
-- where scope_type = 'context';
