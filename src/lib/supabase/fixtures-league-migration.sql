-- ─────────────────────────────────────────────────────────────────────────────
-- SportsPicks — añade `league` a la tabla `fixtures`
-- ─────────────────────────────────────────────────────────────────────────────
-- El bot necesita la competición/liga real (ej. "Segunda División", "Playoffs
-- de Ascenso") para no alucinar sobre la división de un equipo usando su
-- conocimiento de entrenamiento. La capturamos de API-Football (league.name).
-- Migración idempotente. Ya aplicada en prod vía MCP.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.fixtures add column if not exists league text;

create index if not exists fixtures_league_idx on public.fixtures (league);
