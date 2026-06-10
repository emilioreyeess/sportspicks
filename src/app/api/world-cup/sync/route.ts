/**
 * /api/world-cup/sync — Data pipeline sync endpoint.
 *
 * Intended to be called by a Vercel Cron Job (vercel.json) or manually.
 * Fetches fresh data from API-Football (when key present) and ESPN,
 * writes to Supabase, and invalidates Upstash KV caches.
 *
 * Security: protected by CRON_SECRET header (Vercel Cron standard).
 * Usage: GET /api/world-cup/sync
 *        Authorization: Bearer <CRON_SECRET>
 *
 * Phases:
 *   1. fixtures  — upsert all WC fixtures from API-Football
 *   2. odds      — upsert odds for the next N upcoming matches
 *   3. lineups   — upsert lineups for matches ≤ 48h away
 *   4. stats     — upsert match stats for completed matches
 *   5. teams     — sync team/player data (weekly, skip if recently synced)
 *   6. cache_bust— delete Upstash KV keys so next request re-fetches
 */

import { NextRequest } from "next/server"
import {
  isApiFootballEnabled,
  getAllFixtures as apfGetFixtures,
  getFixtureOdds,
  getLineups,
  getFixtureStats,
  getFixturePlayerStats,
  getQuota,
} from "@/lib/world-cup/api-football"
import { getAllFixtures as espnGetFixtures } from "@/lib/world-cup/data-service"
import { cacheGet, cacheSet, WC_CACHE_TTL } from "@/lib/world-cup/cache"
import { ingestWorldCupFixtures, syncWorldCupSquads, ingestWorldCupOdds } from "@/lib/infrastructure/footballApi"

export const runtime  = "nodejs"
export const maxDuration = 300   // 5 min max (Vercel Pro)

// ─── Auth ─────────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  // CN-031: fail CLOSED. Este endpoint escribe en Supabase y consume la cuota
  // limitada de API-Football, así que NUNCA debe quedar abierto por falta de
  // secret (antes `if (!secret) return true` lo dejaba público si CRON_SECRET
  // no estaba configurado). Consistente con /api/cron/settle-bets: exige
  // CRON_SECRET de ≥16 chars + cabecera Bearer.
  const secret = process.env.CRON_SECRET
  if (!secret || secret.trim().length < 16) return false
  const auth = req.headers.get("authorization") ?? ""
  return auth === `Bearer ${secret}`
}

// ─── Supabase client (server-side service role) ───────────────────────────────

async function getSupabase() {
  const { createClient } = await import("@supabase/supabase-js")
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

// ─── Phase helpers ────────────────────────────────────────────────────────────

type SyncLog = Array<{ phase: string; status: "ok" | "skip" | "error"; detail?: string; count?: number }>

async function syncFixtures(sb: Awaited<ReturnType<typeof getSupabase>>, log: SyncLog) {
  if (!sb) { log.push({ phase: "fixtures", status: "skip", detail: "no supabase client" }); return [] }

  // Try API-Football first
  if (isApiFootballEnabled()) {
    const apfFixtures = await apfGetFixtures()
    if (apfFixtures && apfFixtures.length > 0) {
      const rows = apfFixtures.map((f) => ({
        match_id:           `wc26-${f.fixture.id}`,
        api_football_id:    f.fixture.id,
        stage:              mapRound(f.league.round),
        kickoff_iso:        f.fixture.date,
        venue_city:         f.fixture.venue.city ?? "—",
        venue_stadium:      f.fixture.venue.name ?? "—",
        venue_country:      "—",
        home_code:          f.teams.home.code?.toUpperCase() ?? f.teams.home.name.slice(0, 3).toUpperCase(),
        away_code:          f.teams.away.code?.toUpperCase() ?? f.teams.away.name.slice(0, 3).toUpperCase(),
        referee_name:       f.fixture.referee ?? null,
        status:             mapStatus(f.fixture.status.short),
        home_score:         f.goals.home ?? null,
        away_score:         f.goals.away ?? null,
        home_score_ht:      f.score.halftime.home ?? null,
        away_score_ht:      f.score.halftime.away ?? null,
        home_penalties:     f.score.penalty.home ?? null,
        away_penalties:     f.score.penalty.away ?? null,
        source:             "api-football",
        fetched_at:         new Date().toISOString(),
        updated_at:         new Date().toISOString(),
      }))

      const { error, count } = await sb.from("wc_matches")
        .upsert(rows, { onConflict: "match_id", ignoreDuplicates: false })
        .select("match_id")
      if (error) {
        log.push({ phase: "fixtures", status: "error", detail: error.message })
        return []
      }
      log.push({ phase: "fixtures", status: "ok", count: rows.length })
      return rows.map((r) => ({ matchId: r.match_id, apfId: r.api_football_id, kickoff: r.kickoff_iso, status: r.status }))
    }
  }

  // Fallback: ESPN
  const espnFixtures = await espnGetFixtures()
  if (espnFixtures.length === 0) {
    log.push({ phase: "fixtures", status: "skip", detail: "no data from ESPN" })
    return []
  }
  const rows = espnFixtures.map((f) => ({
    match_id:     f.matchId,
    stage:        f.stage,
    kickoff_iso:  f.kickoffISO,
    venue_city:   f.venue.city,
    venue_stadium: f.venue.stadium,
    venue_country: f.venue.country,
    home_code:    f.homeCode,
    away_code:    f.awayCode,
    status:       f.status,
    home_score:   f.result?.homeScore ?? null,
    away_score:   f.result?.awayScore ?? null,
    source:       "espn",
    fetched_at:   new Date().toISOString(),
    updated_at:   new Date().toISOString(),
  }))
  await sb.from("wc_matches").upsert(rows, { onConflict: "match_id" })
  log.push({ phase: "fixtures", status: "ok", count: rows.length, detail: "espn fallback" })
  return rows.map((r) => ({ matchId: r.match_id, apfId: undefined as number | undefined, kickoff: r.kickoff_iso, status: r.status }))
}

async function syncOdds(
  sb: Awaited<ReturnType<typeof getSupabase>>,
  fixtures: Array<{ matchId: string; apfId?: number; kickoff: string; status: string }>,
  log: SyncLog,
) {
  if (!sb || !isApiFootballEnabled()) {
    log.push({ phase: "odds", status: "skip", detail: "api-football disabled" }); return
  }
  const now  = Date.now()
  const h48  = now + 48 * 3600 * 1000
  const upcoming = fixtures.filter(
    (f) => f.apfId && f.status === "scheduled" && new Date(f.kickoff).getTime() <= h48
  )
  if (upcoming.length === 0) { log.push({ phase: "odds", status: "skip", detail: "no upcoming ≤48h" }); return }

  let upserted = 0
  for (const f of upcoming.slice(0, 6)) {   // limit to 6 to save quota
    if (!f.apfId) continue
    const odds = await getFixtureOdds(f.apfId)
    if (!odds) continue

    for (const bk of odds.bookmakers) {
      const row: Record<string, unknown> = {
        match_id:   f.matchId,
        bookmaker:  bk.name,
        market:     "combined",
        source:     "api-football",
        fetched_at: new Date().toISOString(),
      }
      for (const bet of bk.bets) {
        if (bet.name === "Match Winner") {
          row.market    = "1x2"
          row.odds_home = parseOdd(findOdd(bet.values, "Home"))
          row.odds_draw = parseOdd(findOdd(bet.values, "Draw"))
          row.odds_away = parseOdd(findOdd(bet.values, "Away"))
        }
        if (bet.name.includes("Over/Under")) {
          const line = parseFloat(bet.name.match(/[\d.]+/)?.[0] ?? "2.5")
          row.market    = "ou25"
          row.ou_line   = line
          row.odds_over  = parseOdd(findOdd(bet.values, "Over"))
          row.odds_under = parseOdd(findOdd(bet.values, "Under"))
        }
        if (bet.name === "Both Teams Score") {
          row.market          = "btts"
          row.odds_btts_yes   = parseOdd(findOdd(bet.values, "Yes"))
          row.odds_btts_no    = parseOdd(findOdd(bet.values, "No"))
        }
      }
      const { error } = await sb.from("wc_odds").upsert(row, { onConflict: "match_id,bookmaker,market" })
      if (!error) upserted++
    }
  }
  log.push({ phase: "odds", status: "ok", count: upserted })
}

async function syncLineups(
  sb: Awaited<ReturnType<typeof getSupabase>>,
  fixtures: Array<{ matchId: string; apfId?: number; kickoff: string; status: string }>,
  log: SyncLog,
) {
  if (!sb || !isApiFootballEnabled()) {
    log.push({ phase: "lineups", status: "skip", detail: "api-football disabled" }); return
  }
  const now   = Date.now()
  const h24   = now + 24 * 3600 * 1000
  const close = fixtures.filter(
    (f) => f.apfId && (f.status === "scheduled" || f.status === "live")
            && new Date(f.kickoff).getTime() <= h24
  )
  if (close.length === 0) { log.push({ phase: "lineups", status: "skip", detail: "no fixtures ≤24h" }); return }

  let upserted = 0
  for (const f of close.slice(0, 4)) {
    if (!f.apfId) continue
    const lineups = await getLineups(f.apfId)
    if (!lineups) continue

    for (const lu of lineups) {
      const isHome = lineups.indexOf(lu) === 0   // first lineup is usually home
      const players = [
        ...lu.startXI.map((p) => ({ ...p.player, starter: true })),
        ...lu.substitutes.map((p) => ({ ...p.player, starter: false })),
      ]
      const { error } = await sb.from("wc_lineups").upsert({
        match_id:     f.matchId,
        team_code:    lu.team.code?.toUpperCase() ?? lu.team.name.slice(0, 3).toUpperCase(),
        is_home:      isHome,
        lineup_type:  "confirmed",
        formation:    lu.formation,
        players_json: players,
        source:       "api-football",
        fetched_at:   new Date().toISOString(),
      }, { onConflict: "match_id,team_code" })
      if (!error) upserted++
    }
  }
  log.push({ phase: "lineups", status: "ok", count: upserted })
}

async function syncMatchStats(
  sb: Awaited<ReturnType<typeof getSupabase>>,
  fixtures: Array<{ matchId: string; apfId?: number; kickoff: string; status: string }>,
  log: SyncLog,
) {
  if (!sb || !isApiFootballEnabled()) {
    log.push({ phase: "stats", status: "skip", detail: "api-football disabled" }); return
  }
  const completed = fixtures.filter((f) => f.apfId && f.status === "final")
  if (completed.length === 0) { log.push({ phase: "stats", status: "skip", detail: "no completed fixtures" }); return }

  let upserted = 0
  for (const f of completed.slice(0, 8)) {
    if (!f.apfId) continue
    const stats = await getFixtureStats(f.apfId)
    if (!stats) continue

    for (let i = 0; i < stats.length; i++) {
      const ts = stats[i]
      const sv = (name: string) => {
        const s = ts.statistics.find((x) => x.type === name)
        if (!s || s.value == null) return null
        if (typeof s.value === "number") return s.value
        return parseFloat(String(s.value).replace("%", "")) || null
      }
      const { error } = await sb.from("wc_team_stats").upsert({
        match_id:       f.matchId,
        team_code:      ts.team.name.slice(0, 3).toUpperCase(),
        is_home:        i === 0,
        possession:     sv("Ball Possession"),
        shots_total:    sv("Total Shots"),
        shots_on_target: sv("Shots on Goal"),
        passes_total:   sv("Total passes"),
        pass_accuracy:  sv("Passes %"),
        fouls:          sv("Fouls"),
        yellow_cards:   sv("Yellow Cards"),
        red_cards:      sv("Red Cards"),
        corners:        sv("Corner Kicks"),
        offsides:       sv("Offsides"),
        source:         "api-football",
        fetched_at:     new Date().toISOString(),
      }, { onConflict: "match_id,team_code" })
      if (!error) upserted++
    }
  }
  log.push({ phase: "stats", status: "ok", count: upserted })
}

async function bustKvCache(log: SyncLog) {
  try {
    const { kv } = await import("@vercel/kv")
    const keys = [
      "fixtures:all", "standings:all:v2", "teams:all:v2",
    ]
    await Promise.allSettled(keys.map((k) => kv.del(k)))
    log.push({ phase: "cache_bust", status: "ok", count: keys.length })
  } catch {
    log.push({ phase: "cache_bust", status: "skip", detail: "kv not available" })
  }
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function mapStatus(short: string): "scheduled" | "live" | "final" | "postponed" {
  if (["FT", "AET", "PEN", "AWD", "WO"].includes(short)) return "final"
  if (["1H", "HT", "2H", "ET", "P", "LIVE"].includes(short)) return "live"
  if (["PST", "CANC", "ABD", "INT", "SUSP"].includes(short)) return "postponed"
  return "scheduled"
}

function mapRound(round: string): string {
  const r = round.toLowerCase()
  if (r.includes("group")) return "group"
  if (r.includes("32")) return "round-of-32"
  if (r.includes("16")) return "round-of-16"
  if (r.includes("quarter")) return "quarter-final"
  if (r.includes("semi")) return "semi-final"
  if (r.includes("third")) return "third-place"
  if (r.includes("final")) return "final"
  return "group"
}

function findOdd(values: Array<{ value: string; odd: string }>, label: string): string | null {
  return values.find((v) => v.value === label)?.odd ?? null
}

function parseOdd(s: string | null): number | null {
  if (!s) return null
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

// ─── Route handler ────────────────────────────────────────────────────────────

// Mundial 2026 kickoff: 11 Jun 2026 20:00 ET
const WC_KICKOFF = new Date("2026-06-11T20:00:00-04:00").getTime()
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Skip sync until 2 days before the tournament starts
  const now = Date.now()
  if (now < WC_KICKOFF - TWO_DAYS_MS) {
    const daysLeft = Math.ceil((WC_KICKOFF - now) / (24 * 60 * 60 * 1000))
    return Response.json({
      ok: true,
      skipped: true,
      reason: `El Mundial empieza en ${daysLeft} días. El sync se activa 2 días antes (${new Date(WC_KICKOFF - TWO_DAYS_MS).toISOString().slice(0, 10)}).`,
    })
  }

  const log: SyncLog = []
  const t0 = Date.now()

  // 0. Check quota
  if (isApiFootballEnabled()) {
    const quota = await getQuota()
    if (quota) {
      log.push({ phase: "quota", status: "ok", detail: `${quota.remaining}/${quota.limit} requests remaining` })
      if (quota.remaining < 20) {
        return Response.json({
          ok: false, error: "quota_low",
          detail: `Only ${quota.remaining} API-Football requests remaining today.`,
          log,
        }, { status: 429 })
      }
    }
  }

  const sb = await getSupabase()

  // 1. Fixtures (tabla wc_matches específica del Mundial)
  const fixtures = await syncFixtures(sb, log)

  // 1b. MISMOS fixtures → tabla general `fixtures` (la que lee el bot/RAG) con
  //     stats.league_id=1, para curar la ceguera del bot ante el Mundial.
  const wcDb = await ingestWorldCupFixtures(2026)
  log.push({
    phase: "fixtures_table",
    status: wcDb.error ? "error" : "ok",
    detail: wcDb.error,
    count: wcDb.count,
  })

  // 1c. Convocatorias (squads) → tabla wc_squads (degrada si aún no se publican).
  const sq = await syncWorldCupSquads()
  log.push({
    phase: "squads",
    status: sq.error ? "error" : "ok",
    detail: sq.error ?? `${sq.teams} equipos · ${sq.players} jugadores`,
    count: sq.players,
  })

  // 1d. Cuotas del Mundial → fixtures.stats.odds (alimenta UI Partidos/Combinadas).
  const wcOdds = await ingestWorldCupOdds()
  log.push({
    phase: "wc_odds",
    status: wcOdds.errors > 0 && wcOdds.updated === 0 ? "error" : "ok",
    detail: `${wcOdds.withOdds}/${wcOdds.scanned} con cuotas · ${wcOdds.updated} actualizados · ${wcOdds.errors} errores`,
    count: wcOdds.updated,
  })

  // 2. Odds (only if API-Football, upcoming ≤48h)
  await syncOdds(sb, fixtures, log)

  // 3. Lineups (≤24h)
  await syncLineups(sb, fixtures, log)

  // 4. Match stats (completed)
  await syncMatchStats(sb, fixtures, log)

  // 5. Bust KV cache so next hub load gets fresh data
  await bustKvCache(log)

  return Response.json({
    ok: true,
    durationMs: Date.now() - t0,
    apiFootballEnabled: isApiFootballEnabled(),
    log,
  })
}
