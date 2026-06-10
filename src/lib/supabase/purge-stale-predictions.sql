-- ─────────────────────────────────────────────────────────────────────────────
-- FASE 3 — Purga de alucinaciones (combinadas/value picks con cuotas inventadas)
-- ─────────────────────────────────────────────────────────────────────────────
-- El motor, ANTES de migrar las cuotas a API-Football, pudo generar predicciones
-- con cuotas no verificadas (scraping de ESPN / fallback). Esta purga elimina de
-- predictions_log (única tabla de predicciones; no hay tabla `combinadas`
-- separada) TODOS los registros generados antes de HOY, para que el motor vuelva
-- a generarlos limpios con cuotas reales de API-Football.
--
-- Ejecutado vía Supabase MCP el 2026-06-10 (26 filas purgadas).
-- Idempotente: re-ejecutar solo borra lo anterior al día en curso.
-- ─────────────────────────────────────────────────────────────────────────────

delete from public.predictions_log
where created_at < date_trunc('day', now() at time zone 'Europe/Madrid');
