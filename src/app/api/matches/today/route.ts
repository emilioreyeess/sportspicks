/**
 * GET /api/matches/today  — "Partidos de Hoy" (STEP 4)
 *
 * Devuelve los 5 partidos MÁS IMPORTANTES del día, priorizando las Top-5 ligas
 * europeas + competiciones UEFA + grandes torneos internacionales. Los datos
 * vienen de los scoreboards de ESPN (cuotas reales si las hay; nunca inventadas).
 */
import { NextRequest } from "next/server"
import { consume, getClientIp, tooManyRequests } from "@/lib/rate-limit"
import { cacheFetch, CK, TTL } from "@/lib/kv"

export const runtime = "nodejs"
export const maxDuration = 30

// slug → { nombre, prioridad }. Mayor prioridad = más importante.
const LEAGUES: Record<string, { name: string; flag: string; prio: number }> = {
  "uefa.champions":   { name: "Champions League", flag: "🏆", prio: 100 },
  "uefa.europa":      { name: "Europa League",     flag: "🏅", prio: 80  },
  "fifa.world":       { name: "Copa del Mundo",     flag: "🌍", prio: 98  },
  "conmebol.america": { name: "Copa América",       flag: "🏆", prio: 70  },
  "UEFA.EURO":        { name: "Eurocopa",           flag: "🇪🇺", prio: 72  },
  "esp.1":            { name: "LaLiga",             flag: "🇪🇸", prio: 90  },
  "eng.1":            { name: "Premier League",     flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", prio: 92  },
  "ger.1":            { name: "Bundesliga",         flag: "🇩🇪", prio: 86  },
  "ita.1":            { name: "Serie A",            flag: "🇮🇹", prio: 86  },
  "fra.1":            { name: "Ligue 1",            flag: "🇫🇷", prio: 82  },
  "por.1":            { name: "Primeira Liga",      flag: "🇵🇹", prio: 60  },
  "ned.1":            { name: "Eredivisie",         flag: "🇳🇱", prio: 58  },
  "usa.1":            { name: "MLS",                flag: "🇺🇸", prio: 50  },
  "mex.1":            { name: "Liga MX",            flag: "🇲🇽", prio: 55  },
  "bra.1":            { name: "Brasileirão",        flag: "🇧🇷", prio: 56  },
  "arg.1":            { name: "Liga Argentina",     flag: "🇦🇷", prio: 54  },
  "fifa.friendly":    { name: "Selección",          flag: "🤝", prio: 40  },
}

const STATE_BOOST: Record<string, number> = { in: 30, pre: 10, post: 0 }

interface TodayMatch {
  match_id: string
  league: string
  league_name: string
  flag: string
  home_team: string
  away_team: string
  home_id: string | null
  away_id: string | null
  home_logo: string | null
  away_logo: string | null
  home_score: number
  away_score: number
  status_state: string
  status_detail: string | null
  clock: string | null
  kickoff_iso: string | null
  odds_home: number | null
  odds_draw: number | null
  odds_away: number | null
  _score: number
}

function americanToDecimal(ml: any): number | null {
  const n = typeof ml === "number" ? ml : parseFloat(String(ml ?? "").replace("+", ""))
  if (!isFinite(n) || n === 0) return null
  const dec = n > 0 ? n / 100 + 1 : 100 / Math.abs(n) + 1
  return Math.round(dec * 100) / 100
}

async function fetchLeague(slug: string): Promise<TodayMatch[]> {
  const meta = LEAGUES[slug]
  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/${encodeURIComponent(slug)}/scoreboard`,
      { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(7000) },
    )
    if (!res.ok) return []
    const data = await res.json()
    const events: any[] = data?.events ?? []
    const now = Date.now()
    const rows: TodayMatch[] = []

    for (const ev of events) {
      const comp = ev?.competitions?.[0]
      if (!comp) continue
      const competitors: any[] = comp.competitors ?? []
      const home = competitors.find((c) => c.homeAway === "home")
      const away = competitors.find((c) => c.homeAway === "away")
      if (!home || !away) continue

      const kickoff = ev.date ?? null
      const kickoffMs = kickoff ? new Date(kickoff).getTime() : now
      // Ventana "hoy": desde 6h atrás hasta 30h adelante (cubre husos LatAm/EU)
      if (kickoffMs < now - 6 * 3_600_000 || kickoffMs > now + 30 * 3_600_000) continue

      const state = comp.status?.type?.state ?? "pre"
      const odds = comp.odds?.[0]

      rows.push({
        match_id: String(ev.id),
        league: slug,
        league_name: meta.name,
        flag: meta.flag,
        home_team: home.team?.displayName ?? "Local",
        away_team: away.team?.displayName ?? "Visitante",
        home_id: home.team?.id ? String(home.team.id) : null,
        away_id: away.team?.id ? String(away.team.id) : null,
        home_logo: home.team?.logo ?? null,
        away_logo: away.team?.logo ?? null,
        home_score: parseInt(home.score ?? "0") || 0,
        away_score: parseInt(away.score ?? "0") || 0,
        status_state: state,
        status_detail: comp.status?.type?.detail ?? comp.status?.type?.shortDetail ?? null,
        clock: comp.status?.displayClock ?? null,
        kickoff_iso: kickoff,
        odds_home: americanToDecimal(odds?.homeTeamOdds?.moneyLine),
        odds_draw: americanToDecimal(odds?.drawOdds?.moneyLine),
        odds_away: americanToDecimal(odds?.awayTeamOdds?.moneyLine),
        _score: meta.prio + (STATE_BOOST[state] ?? 0),
      })
    }
    return rows
  } catch {
    return []
  }
}

// ─── Cache key: one entry per calendar day-hour-minute bucket ─────────────
// Live days: 60s TTL (scores change). Static days: 5 min TTL.
function todayDateKey(): string {
  // Round to current minute so the cache key is stable within a minute window
  const d = new Date()
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}-${d.getUTCHours()}-${Math.floor(d.getUTCMinutes() / 1)}`
}

function buildRanked(merged: TodayMatch[]) {
  const seen = new Set<string>()
  return merged
    .filter((m) => (seen.has(m.match_id) ? false : (seen.add(m.match_id), true)))
    .sort((a, b) => {
      if (b._score !== a._score) return b._score - a._score
      const ka = a.kickoff_iso ? new Date(a.kickoff_iso).getTime() : 0
      const kb = b.kickoff_iso ? new Date(b.kickoff_iso).getTime() : 0
      return ka - kb
    })
    .slice(0, 5)
    .map(({ _score, ...rest }) => rest)
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req)
  if (!consume(`matches-today:${ip}`, 30, 6)) return tooManyRequests(60)

  const dateKey = todayDateKey()
  const cacheKey = CK.matchesToday(dateKey)

  // Cache strategy:
  // · KV hit  → return instantly (all 1000 concurrent users share 1 ESPN call/min)
  // · KV miss → fan-out 16 ESPN calls, store result, return
  // · SWR     → stale data returned immediately while background refresh runs
  const ranked = await cacheFetch(
    cacheKey,
    TTL.MATCHES_LIVE,        // 60s TTL — aggressive for live scores
    async () => {
      const all = await Promise.all(Object.keys(LEAGUES).map(fetchLeague))
      return buildRanked(all.flat())
    },
  )

  return Response.json({ matches: ranked, count: ranked.length, ts: new Date().toISOString() })
}
