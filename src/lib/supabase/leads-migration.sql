-- ─────────────────────────────────────────────────────────────────────────────
-- SportsPicks — tabla `leads` para Lead Magnets (Calculadora EV y futuros)
-- ─────────────────────────────────────────────────────────────────────────────
-- Trazabilidad legal RGPD: cada fila prueba el consentimiento (art. 6.1.a)
-- con email, timestamp y hash de IP. RLS habilitada — solo service_role escribe.
-- Migración idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.leads (
  email         text primary key,
  source        text not null,
  consent_gdpr  boolean not null default false,
  consent_at    timestamptz not null default now(),
  ip_hash       text,
  created_at    timestamptz not null default now()
);

-- Índice para segmentar por fuente de captación (analítica de funnel)
create index if not exists leads_source_idx
  on public.leads (source, created_at desc);

-- ── RLS: bloquear anon, permitir solo service_role (backend) ──────────────────
alter table public.leads enable row level security;

-- Bloqueo explícito de la anon key (defensa en profundidad — el service_role
-- bypasea RLS, así que sin políticas permisivas la tabla queda cerrada al anon).
drop policy if exists deny_anon_leads on public.leads;
create policy deny_anon_leads
  on public.leads
  for all
  to anon
  using (false)
  with check (false);

-- Verificación:
--   select column_name, data_type, is_nullable
--   from information_schema.columns
--   where table_schema = 'public' and table_name = 'leads';
--
--   select relrowsecurity from pg_class where relname = 'leads';  -- debe ser true
