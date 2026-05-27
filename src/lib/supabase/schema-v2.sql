-- ============================================================
-- SportsPicks v2 — Schema migration
-- Run in Supabase SQL Editor (service_role, public schema)
-- ============================================================

-- pgvector extension (for RAG embeddings)
create extension if not exists vector;

-- ── Extend users_log ─────────────────────────────────────────
alter table public.users_log
  add column if not exists is_vip_tipster boolean not null default false;

-- ── bets ─────────────────────────────────────────────────────
-- Personal bet tracker. Profit / Winrate / Yield calculated in app.
create table if not exists public.bets (
  id               uuid primary key default gen_random_uuid(),
  user_email       text not null references public.users_log(email) on delete cascade,
  title            text,
  stake            numeric(10,2),
  odds             numeric(8,2),
  potential_return numeric(10,2),
  profit           numeric(10,2),
  status           text not null default 'pending'
                     check (status in ('pending','won','lost','void','cashout')),
  is_pre_match     boolean not null default true,
  is_published     boolean not null default false,
  is_pro_exclusive boolean not null default false,
  ai_analyzed      boolean not null default false,
  created_at       timestamptz not null default now(),
  settled_at       timestamptz
);

-- ── bet_legs ──────────────────────────────────────────────────
create table if not exists public.bet_legs (
  id          uuid primary key default gen_random_uuid(),
  bet_id      uuid not null references public.bets(id) on delete cascade,
  match_name  text not null,
  market      text not null,
  selection   text not null,
  odds        numeric(8,2) not null,
  status      text not null default 'pending'
                check (status in ('pending','won','lost','void')),
  created_at  timestamptz not null default now()
);

-- ── friend_groups ─────────────────────────────────────────────
create table if not exists public.friend_groups (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  avatar_emoji text not null default '⚽',
  created_by   text not null references public.users_log(email),
  invite_code  text unique not null default upper(substring(md5(random()::text), 1, 6)),
  is_private   boolean not null default true,
  created_at   timestamptz not null default now()
);

-- ── group_members ─────────────────────────────────────────────
create table if not exists public.group_members (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.friend_groups(id) on delete cascade,
  user_email  text not null references public.users_log(email) on delete cascade,
  role        text not null default 'member' check (role in ('admin','member')),
  joined_at   timestamptz not null default now(),
  unique (group_id, user_email)
);

-- ── group_messages ────────────────────────────────────────────
-- message_text or bet_id (shared bet card), or both
create table if not exists public.group_messages (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.friend_groups(id) on delete cascade,
  user_email   text not null references public.users_log(email) on delete cascade,
  message_text text,
  bet_id       uuid references public.bets(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- ── vip_access_codes ──────────────────────────────────────────
-- Gate for /creators route
create table if not exists public.vip_access_codes (
  id         uuid primary key default gen_random_uuid(),
  code       text unique not null,
  granted_to text references public.users_log(email) on delete set null,
  used_at    timestamptz,
  expires_at timestamptz,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- ── tipster_bounties ──────────────────────────────────────────
-- Bounty: tipster submits tweet with generated image; gets paid if bet won & odds > 1.50
create table if not exists public.tipster_bounties (
  id             uuid primary key default gen_random_uuid(),
  tipster_email  text not null references public.users_log(email) on delete cascade,
  bet_id         uuid not null references public.bets(id) on delete cascade,
  twitter_url    text,
  status         text not null default 'pending'
                   check (status in ('pending','approved','rejected')),
  payout_amount  numeric(10,2),
  submitted_at   timestamptz not null default now(),
  resolved_at    timestamptz
);

-- ── ai_learning_embeddings ────────────────────────────────────
-- pgvector RAG store; updated nightly by cron job
create table if not exists public.ai_learning_embeddings (
  id         uuid primary key default gen_random_uuid(),
  content    text not null,
  embedding  vector(1536),
  metadata   jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ── Indexes ───────────────────────────────────────────────────
create index if not exists bets_user_email      on public.bets(user_email);
create index if not exists bets_status          on public.bets(status);
create index if not exists bets_created_at      on public.bets(created_at desc);
create index if not exists bet_legs_bet_id      on public.bet_legs(bet_id);
create index if not exists gm_group_id          on public.group_members(group_id);
create index if not exists gm_user_email        on public.group_members(user_email);
create index if not exists gmsg_group_created   on public.group_messages(group_id, created_at desc);
create index if not exists bounties_status      on public.tipster_bounties(status);
create index if not exists embeddings_vec       on public.ai_learning_embeddings
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- ── RLS (service_role bypasses all policies) ──────────────────
alter table public.bets                    enable row level security;
alter table public.bet_legs                enable row level security;
alter table public.friend_groups           enable row level security;
alter table public.group_members           enable row level security;
alter table public.group_messages          enable row level security;
alter table public.vip_access_codes        enable row level security;
alter table public.tipster_bounties        enable row level security;
alter table public.ai_learning_embeddings  enable row level security;

create policy "deny_anon_bets"       on public.bets                   using (false);
create policy "deny_anon_legs"       on public.bet_legs                using (false);
create policy "deny_anon_groups"     on public.friend_groups           using (false);
create policy "deny_anon_members"    on public.group_members           using (false);
create policy "deny_anon_messages"   on public.group_messages          using (false);
create policy "deny_anon_vip"        on public.vip_access_codes        using (false);
create policy "deny_anon_bounties"   on public.tipster_bounties        using (false);
create policy "deny_anon_embeddings" on public.ai_learning_embeddings  using (false);
