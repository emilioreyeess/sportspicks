-- ============================================================
-- SportsPicks — group_bets table migration
-- Run in Supabase SQL Editor after schema-v2-fix.sql
-- ============================================================

-- ── group_bets ────────────────────────────────────────────────
-- Tracks which bets a user has shared to a private group.
-- A bet can only be shared once per group (UNIQUE constraint).
-- is_pre_match is set by the server based on the bet's status at
-- share time: only bets with status='pending' are accepted,
-- guaranteeing the pick was registered before it was settled.

create table if not exists public.group_bets (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.friend_groups(id) on delete cascade,
  bet_id       uuid not null references public.bets(id) on delete cascade,
  user_email   text not null references public.users_log(email) on delete cascade,
  shared_at    timestamptz not null default now(),
  is_pre_match boolean not null default true,
  unique (group_id, bet_id)   -- a bet can only be shared once per group
);

create index if not exists idx_group_bets_group_id
  on public.group_bets (group_id);

create index if not exists idx_group_bets_user_email
  on public.group_bets (user_email);

create index if not exists idx_group_bets_bet_id
  on public.group_bets (bet_id);

-- RLS: members can read bets shared to their groups
alter table public.group_bets enable row level security;

create policy "group_bets_read_members" on public.group_bets
  for select using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = group_bets.group_id
        and gm.user_email = auth.jwt() ->> 'email'
    )
  );

create policy "group_bets_insert_own" on public.group_bets
  for insert with check (
    user_email = auth.jwt() ->> 'email'
    and exists (
      select 1 from public.group_members gm
      where gm.group_id = group_bets.group_id
        and gm.user_email = auth.jwt() ->> 'email'
    )
  );

create policy "group_bets_delete_own" on public.group_bets
  for delete using (user_email = auth.jwt() ->> 'email');
