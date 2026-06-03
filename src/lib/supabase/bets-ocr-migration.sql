-- ============================================================
-- SportsPicks — Bets: OCR pipeline columns
-- ============================================================
-- Añade las columnas que la ingesta automática por visión necesita.
-- Idempotente. Aplicar en Supabase SQL Editor.
-- ============================================================

-- 1. URL pública de la imagen del boleto (Supabase Storage bucket `bet-images`)
alter table public.bets
  add column if not exists image_url text;

-- 2. Flag de "revisión necesaria" cuando la extracción tiene baja confianza
alter table public.bets
  add column if not exists needs_review boolean not null default false;

-- 3. Confianza global de la extracción (0..1) reportada por el modelo
alter table public.bets
  add column if not exists ai_confidence numeric(4,3);

-- 4. Timestamp de cuándo se extrajo automáticamente (null si fue manual)
alter table public.bets
  add column if not exists ai_extracted_at timestamptz;

-- 5. Índice para listar revisiones pendientes rápido
create index if not exists bets_needs_review_idx
  on public.bets (user_email, needs_review)
  where needs_review = true;

-- Verificación:
--   select column_name, data_type
--   from information_schema.columns
--   where table_schema = 'public' and table_name = 'bets'
--     and column_name in ('image_url','needs_review','ai_confidence','ai_extracted_at');
