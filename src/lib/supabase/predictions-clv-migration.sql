-- ─────────────────────────────────────────────────────────────────────────────
-- predictions_log — captura de Closing Line Value (CLV)
-- ─────────────────────────────────────────────────────────────────────────────
-- Guarda la CUOTA DE CIERRE de la selección predicha, capturada minutos ANTES
-- del kickoff (cron /api/cron/capture-clv). Responsabilidad SEPARADA del settle
-- (ml-settle solo resuelve Won/Lost/Void). Permite nulos (partidos antiguos /
-- mercados sin cuota en la fuente).
-- Migración idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.predictions_log
  add column if not exists closing_line_value numeric;
