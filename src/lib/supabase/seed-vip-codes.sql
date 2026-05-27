-- ============================================================
-- Seed VIP access codes for testing
-- Run in Supabase SQL Editor
-- ============================================================

insert into public.vip_access_codes (code, is_active)
values
  ('TIPSTER1', true),
  ('TIPSTER2', true),
  ('TIPSTER3', true),
  ('DEMO99',   true),
  ('SPVIP01',  true)
on conflict (code) do nothing;
