-- ============================================================
-- World Cup 2026 — Supabase Schema
-- Run via: Supabase Dashboard → SQL Editor → New query
--
-- Strategy:
--   - wc_teams        : 48 teams (seeded from static-data.ts)
--   - wc_matches      : fixtures + live results
--   - wc_odds         : pre-match odds per market (1X2, O/U, AH)
--   - wc_lineups      : confirmed/predicted XI per match + player events
--   - wc_referees     : referee cards/stats for each match
--   - wc_players      : player profiles (merged ESPN + API-Football)
--   - wc_team_stats   : per-match team stats snapshot
--   - wc_player_stats : per-match player performance
--
-- RLS: all tables are READ-ONLY for anon/authenticated.
--      Writes only via service_role (backend sync jobs).
-- ============================================================

-- ─── Extensions ──────────────────────────────────────────────────────────────
create extension if not exists "pg_trgm";  -- fast text search

-- ─── wc_teams ──────────────────────────────────────────────────────────────
create table if not exists public.wc_teams (
  code           text primary key,                 -- "ESP", "ARG", "USA"
  name           text not null,
  short_name     text not null,
  flag_emoji     text not null default '',
  confederation  text not null,
  fifa_ranking   integer,
  "group"        text check ("group" in ('A','B','C','D','E','F','G','H','I','J','K','L')),
  qualified_via  text not null default 'qualifier',
  source         text not null default 'curated',
  updated_at     timestamptz not null default now()
);

alter table public.wc_teams enable row level security;
create policy "read_all_wc_teams" on public.wc_teams for select using (true);

-- ─── wc_matches ──────────────────────────────────────────────────────────────
create table if not exists public.wc_matches (
  match_id            text primary key,            -- "wc26-ESP-MAR-1"
  api_football_id     integer unique,              -- API-Football fixture ID (null until mapped)
  espn_id             text,                        -- ESPN event ID
  stage               text not null default 'group',
  "group"             text check ("group" in ('A','B','C','D','E','F','G','H','I','J','K','L')),
  stage_match_number  integer not null default 0,
  kickoff_iso         timestamptz not null,
  venue_city          text not null default '—',
  venue_country       text not null default '—',
  venue_stadium       text not null default '—',
  home_code           text not null references public.wc_teams(code),
  away_code           text not null references public.wc_teams(code),
  referee_name        text,
  referee_id          text,                        -- slug from wc_referees
  status              text not null default 'scheduled'
                        check (status in ('scheduled','live','final','postponed')),
  -- Result (null until played)
  home_score          integer,
  away_score          integer,
  home_score_ht       integer,
  away_score_ht       integer,
  home_penalties      integer,
  away_penalties      integer,
  -- Metadata
  source              text not null default 'espn',
  fetched_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists wc_matches_home_code  on public.wc_matches(home_code);
create index if not exists wc_matches_away_code  on public.wc_matches(away_code);
create index if not exists wc_matches_kickoff    on public.wc_matches(kickoff_iso);
create index if not exists wc_matches_status     on public.wc_matches(status);

alter table public.wc_matches enable row level security;
create policy "read_all_wc_matches" on public.wc_matches for select using (true);

-- ─── wc_odds ──────────────────────────────────────────────────────────────────
-- One row per match × bookmaker × market. Upsert keeps latest snapshot.
create table if not exists public.wc_odds (
  id              bigint generated always as identity primary key,
  match_id        text not null references public.wc_matches(match_id) on delete cascade,
  bookmaker       text not null,                   -- "bet365", "pinnacle", "avg"
  market          text not null,                   -- "1x2", "ou25", "ah", "btts", "dc"
  -- 1X2
  odds_home       numeric(6,3),
  odds_draw       numeric(6,3),
  odds_away       numeric(6,3),
  -- Over/Under
  ou_line         numeric(4,1),                    -- 2.5, 3.5…
  odds_over       numeric(6,3),
  odds_under      numeric(6,3),
  -- Asian Handicap
  ah_line         numeric(4,1),
  odds_ah_home    numeric(6,3),
  odds_ah_away    numeric(6,3),
  -- BTTS
  odds_btts_yes   numeric(6,3),
  odds_btts_no    numeric(6,3),
  -- Double chance
  odds_dc_1x      numeric(6,3),
  odds_dc_x2      numeric(6,3),
  odds_dc_12      numeric(6,3),
  -- Metadata
  source          text not null default 'api-football',
  fetched_at      timestamptz not null default now(),
  unique (match_id, bookmaker, market)
);

create index if not exists wc_odds_match on public.wc_odds(match_id);

alter table public.wc_odds enable row level security;
create policy "read_all_wc_odds" on public.wc_odds for select using (true);

-- ─── wc_referees ──────────────────────────────────────────────────────────────
create table if not exists public.wc_referees (
  id                    text primary key,            -- slug "mateu-lahoz"
  name                  text not null,
  nationality           text not null,
  age                   integer,
  international_matches integer not null default 0,
  recent_match          text,
  yellow_per_match      numeric(4,2) not null default 0,
  red_per_match         numeric(4,2) not null default 0,
  penalties_per_match   numeric(4,2),
  severity              text not null default 'moderate'
                          check (severity in ('lenient','moderate','strict','very-strict')),
  competitions          text[] not null default '{}',
  notes                 text,
  source                text not null default 'curated',
  fetched_at            timestamptz not null default now()
);

alter table public.wc_referees enable row level security;
create policy "read_all_wc_referees" on public.wc_referees for select using (true);

-- ─── wc_players ──────────────────────────────────────────────────────────────
create table if not exists public.wc_players (
  id              text primary key,                -- "ESP-12345"
  espn_id         text,
  api_football_id integer,
  team_code       text not null references public.wc_teams(code),
  name            text not null,
  "position"      text not null check ("position" in ('GK','DF','MF','FW')),
  shirt_number    integer,
  age             integer,
  club            text,
  club_country    text,
  tier            text not null default 'regular'
                    check (tier in ('world-class','top-club','regular','youngster')),
  caps            integer,
  goals           integer,
  injury_status   text not null default 'fit'
                    check (injury_status in ('fit','doubt','out')),
  injury_note     text,
  booked_for_next boolean not null default false,
  source          text not null default 'espn',
  fetched_at      timestamptz not null default now()
);

create index if not exists wc_players_team    on public.wc_players(team_code);
create index if not exists wc_players_pos     on public.wc_players("position");
create index if not exists wc_players_name    on public.wc_players using gin(name gin_trgm_ops);

alter table public.wc_players enable row level security;
create policy "read_all_wc_players" on public.wc_players for select using (true);

-- ─── wc_lineups ──────────────────────────────────────────────────────────────
-- One row per match-team combination. players_json stores the ordered XI + subs.
create table if not exists public.wc_lineups (
  id              bigint generated always as identity primary key,
  match_id        text not null references public.wc_matches(match_id) on delete cascade,
  team_code       text not null references public.wc_teams(code),
  is_home         boolean not null,
  lineup_type     text not null default 'predicted'
                    check (lineup_type in ('confirmed','predicted','unavailable')),
  formation       text,                            -- "4-3-3", "4-2-3-1"…
  players_json    jsonb not null default '[]',     -- array of {id, name, pos, shirt, starter}
  source          text not null default 'api-football',
  fetched_at      timestamptz not null default now(),
  unique (match_id, team_code)
);

create index if not exists wc_lineups_match on public.wc_lineups(match_id);

alter table public.wc_lineups enable row level security;
create policy "read_all_wc_lineups" on public.wc_lineups for select using (true);

-- ─── wc_team_stats ───────────────────────────────────────────────────────────
-- One row per match-team. Populated after matches are played.
create table if not exists public.wc_team_stats (
  id              bigint generated always as identity primary key,
  match_id        text not null references public.wc_matches(match_id) on delete cascade,
  team_code       text not null references public.wc_teams(code),
  is_home         boolean not null,
  -- Possession & shooting
  possession      numeric(5,2),                    -- 0-100
  shots_total     integer,
  shots_on_target integer,
  xg              numeric(5,3),                    -- null if not provided
  -- Passing
  passes_total    integer,
  pass_accuracy   numeric(5,2),
  -- Defensive
  fouls           integer,
  yellow_cards    integer,
  red_cards       integer,
  corners         integer,
  offsides        integer,
  source          text not null default 'api-football',
  fetched_at      timestamptz not null default now(),
  unique (match_id, team_code)
);

create index if not exists wc_team_stats_match on public.wc_team_stats(match_id);
create index if not exists wc_team_stats_team  on public.wc_team_stats(team_code);

alter table public.wc_team_stats enable row level security;
create policy "read_all_wc_team_stats" on public.wc_team_stats for select using (true);

-- ─── wc_player_stats ─────────────────────────────────────────────────────────
-- One row per player per match.
create table if not exists public.wc_player_stats (
  id              bigint generated always as identity primary key,
  match_id        text not null references public.wc_matches(match_id) on delete cascade,
  player_id       text not null references public.wc_players(id),
  team_code       text not null references public.wc_teams(code),
  minutes_played  integer,
  goals           integer not null default 0,
  assists         integer not null default 0,
  yellow_cards    integer not null default 0,
  red_cards       integer not null default 0,
  shots_total     integer,
  shots_on_target integer,
  passes_total    integer,
  pass_accuracy   numeric(5,2),
  rating          numeric(4,2),                    -- 0-10 (Whoscored style)
  source          text not null default 'api-football',
  fetched_at      timestamptz not null default now(),
  unique (match_id, player_id)
);

create index if not exists wc_player_stats_match  on public.wc_player_stats(match_id);
create index if not exists wc_player_stats_player on public.wc_player_stats(player_id);
create index if not exists wc_player_stats_team   on public.wc_player_stats(team_code);

alter table public.wc_player_stats enable row level security;
create policy "read_all_wc_player_stats" on public.wc_player_stats for select using (true);

-- ─── Useful views ─────────────────────────────────────────────────────────────

-- Group standings view (computed from wc_team_stats)
create or replace view public.vw_wc_group_standings as
select
  t."group",
  t.code as team_code,
  t.name as team_name,
  t.flag_emoji,
  t.fifa_ranking,
  count(distinct m.match_id) filter (where m.status = 'final') as played,
  count(distinct m.match_id) filter (
    where m.status = 'final'
    and (
      (m.home_code = t.code and m.home_score > m.away_score) or
      (m.away_code = t.code and m.away_score > m.home_score)
    )
  ) as won,
  count(distinct m.match_id) filter (
    where m.status = 'final' and m.home_score = m.away_score
  ) as drawn,
  count(distinct m.match_id) filter (
    where m.status = 'final'
    and (
      (m.home_code = t.code and m.home_score < m.away_score) or
      (m.away_code = t.code and m.away_score < m.home_score)
    )
  ) as lost,
  coalesce(sum(case when m.home_code = t.code then m.home_score
                    when m.away_code = t.code then m.away_score
                    else 0 end) filter (where m.status = 'final'), 0) as goals_for,
  coalesce(sum(case when m.home_code = t.code then m.away_score
                    when m.away_code = t.code then m.home_score
                    else 0 end) filter (where m.status = 'final'), 0) as goals_against
from public.wc_teams t
left join public.wc_matches m
  on (m.home_code = t.code or m.away_code = t.code)
  and m.stage = 'group'
  and t."group" is not null
group by t."group", t.code, t.name, t.flag_emoji, t.fifa_ranking
order by t."group", goals_for desc nulls last;

-- ─── Helper: updated_at trigger ───────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_wc_teams_updated_at
  before update on public.wc_teams
  for each row execute function public.set_updated_at();

create trigger trg_wc_matches_updated_at
  before update on public.wc_matches
  for each row execute function public.set_updated_at();
