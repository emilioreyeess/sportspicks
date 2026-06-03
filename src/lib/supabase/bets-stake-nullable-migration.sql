-- ============================================================
-- SportsPicks — bets.stake: NULL-safe para ingesta OCR (regla R1)
-- ============================================================
-- Regla innegociable R1: si el OCR no extrae el stake (o la confianza
-- es baja), el campo debe quedar NULL para forzar input manual en el
-- editor visual. CERO valores por defecto.
--
-- Estado previo: stake era `nullable: YES` pero con `DEFAULT 0`. Un
-- INSERT que omitiera la columna persistía 0 (un stake "fantasma"
-- indistinguible de una apuesta real de 0€). Quitamos el default para
-- que la ausencia de stake sea siempre NULL semánticamente.
--
-- Idempotente: DROP DEFAULT no falla si ya no hay default.
-- Aplicar en Supabase SQL Editor (proyecto qtsbmazqjdmwssplactj).
-- ============================================================

-- 1. Quitar el DEFAULT 0 — la ausencia de stake debe ser NULL
alter table public.bets
  alter column stake drop default;

-- 2. Asegurar que la columna admite NULL (ya lo era, pero lo blindamos
--    de forma idempotente por si alguna migración previa lo cambió).
alter table public.bets
  alter column stake drop not null;

-- 3. Lo mismo para potential_return: si stake es NULL, el retorno
--    potencial no puede calcularse → debe poder ser NULL sin default.
alter table public.bets
  alter column potential_return drop default;

-- Verificación esperada tras aplicar:
--   stake            → is_nullable=YES, column_default=NULL
--   potential_return → is_nullable=YES, column_default=NULL
--
-- select column_name, is_nullable, column_default
-- from information_schema.columns
-- where table_schema='public' and table_name='bets'
--   and column_name in ('stake','potential_return');
