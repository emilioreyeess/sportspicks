-- ─────────────────────────────────────────────────────────────────────────────
-- SportsPicks Analytics — RLS policies para Supabase
-- Ejecutar en Supabase → SQL Editor (una sola vez, idempotente con IF NOT EXISTS)
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. user_profiles ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_profiles (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email              TEXT UNIQUE NOT NULL,
  display_name       TEXT,
  plan               TEXT NOT NULL DEFAULT 'free'
                       CHECK (plan IN ('free', 'premium', 'pro')),
  stripe_customer_id TEXT UNIQUE,
  birth_date         DATE,          -- opcional, para COPPA estricto en el futuro
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Cada usuario solo ve y edita su propio perfil
DROP POLICY IF EXISTS "user_own_profile" ON user_profiles;
CREATE POLICY "user_own_profile" ON user_profiles
  FOR ALL USING (auth.uid()::text = id::text);

-- Trigger: auto-crear perfil al registrar con Supabase Auth (si se migra a Supabase Auth)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, display_name)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'name'
  )
  ON CONFLICT (email) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── 2. picks_history ────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS picks_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_own_picks" ON picks_history;
CREATE POLICY "user_own_picks" ON picks_history
  FOR ALL USING (user_id = auth.uid()::text);

-- ─── 3. second_opinion_usage ─────────────────────────────────────────────────
ALTER TABLE IF EXISTS second_opinion_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_own_quota" ON second_opinion_usage;
CREATE POLICY "user_own_quota" ON second_opinion_usage
  FOR ALL USING (user_id = auth.uid()::text);

-- ─── 4. Tablas solo accesibles con service_role ───────────────────────────────
-- (audit_logs, patterns, model_weights, model_outputs, learning_reports)

ALTER TABLE IF EXISTS audit_logs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS patterns        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS model_weights   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS model_outputs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS learning_reports ENABLE ROW LEVEL SECURITY;

-- Bloquear acceso anon/authenticated; solo service_role (bypasa RLS)
DROP POLICY IF EXISTS "deny_all_audit"   ON audit_logs;
CREATE POLICY "deny_all_audit"   ON audit_logs   FOR ALL USING (false);

DROP POLICY IF EXISTS "deny_all_patterns" ON patterns;
CREATE POLICY "deny_all_patterns" ON patterns   FOR ALL USING (false);

DROP POLICY IF EXISTS "deny_all_weights" ON model_weights;
CREATE POLICY "deny_all_weights" ON model_weights FOR ALL USING (false);

DROP POLICY IF EXISTS "deny_all_outputs" ON model_outputs;
CREATE POLICY "deny_all_outputs" ON model_outputs FOR ALL USING (false);

DROP POLICY IF EXISTS "deny_all_reports" ON learning_reports;
CREATE POLICY "deny_all_reports" ON learning_reports FOR ALL USING (false);

-- ─── 5. COPPA: bloquear picks a usuarios menores de 18 (futuro) ──────────────
-- Activar cuando se recoja birth_date en el registro:
--
-- DROP POLICY IF EXISTS "adults_only_picks" ON picks_history;
-- CREATE POLICY "adults_only_picks" ON picks_history
--   FOR ALL USING (
--     EXISTS (
--       SELECT 1 FROM user_profiles
--       WHERE user_profiles.email = auth.jwt()->>'email'
--         AND (user_profiles.birth_date IS NULL
--              OR user_profiles.birth_date <= (CURRENT_DATE - INTERVAL '18 years'))
--     )
--   );

-- ─── 6. Índices de rendimiento ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_picks_history_user_id   ON picks_history (user_id);
CREATE INDEX IF NOT EXISTS idx_picks_history_created   ON picks_history (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_second_opinion_user_date ON second_opinion_usage (user_id, used_date);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email      ON user_profiles (email);
