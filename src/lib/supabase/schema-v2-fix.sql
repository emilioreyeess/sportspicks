-- ============================================================
-- SportsPicks v2 — Fix column name mismatches
-- Run in Supabase SQL Editor after schema-v2.sql
-- ============================================================

-- ── bets: rename odds → combined_odds, add sport + notes ─────
alter table public.bets rename column odds to combined_odds;
alter table public.bets add column if not exists sport  text not null default 'football';
alter table public.bets add column if not exists notes  text;

-- ── bet_legs: rename match_name → match, make market nullable ─
alter table public.bet_legs rename column match_name to match;
alter table public.bet_legs alter column market drop not null;
alter table public.bet_legs alter column market set default null;

-- ── friend_groups: rename avatar_emoji → emoji ────────────────
alter table public.friend_groups rename column avatar_emoji to emoji;

-- ── group_messages: rename message_text → content, add sender ─
alter table public.group_messages rename column message_text to content;
alter table public.group_messages add column if not exists sender_name   text;
alter table public.group_messages add column if not exists sender_avatar text;
