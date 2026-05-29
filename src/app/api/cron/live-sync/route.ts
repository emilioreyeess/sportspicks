/**
 * GET/POST /api/cron/live-sync  — Arquitectura de tiempo real (STEP 3)
 *
 * Cron centralizado (cada 60s, schedule "* * * * *" en vercel.json). El frontend
 * NUNCA llama a la API externa: este endpoint es el ÚNICO que habla con ESPN,
 * guarda el estado en `live_matches_cache`, y Supabase Realtime difunde el cambio
 * por WebSocket a todos los clientes suscritos.
 *
 *   ESPN scoreboard  ──(1 fetch/liga)──▶  live_matches_cache (upsert)
 *                                              │  postgres_changes
 *                                              ▼
 *                                    todos los navegadores suscritos
 *
 * Seguridad: requiere `Authorization: Bearer ${CRON_SECRET}` (≥16 chars).
 */
import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/client"

export const runtime = "nodejs"
export const maxDuration = 60
export const dynamic = "force-dynamic"

// Ligas cubiertas en tiempo real: top-5 europeas + competiciones UEFA +
// grandes ligas + selecciones internacionales (foco Mundial 2026).
const LIVE_LEAGUES: { slug: string; name: string }[] = [
  { slug: "esp.1", name: "LaLiga" },
  { slug: "eng.1", name: "Premier League" },
  { slug: "ger.1", name: "Bundesliga" },
  { slug: "ita.1", name: "Serie A" },
  { slug: "fra.1", name: "Ligue 1" },
  { slug: "uefa.champions", name: "Champions League" },
  { slug: "uefa.europa", name: "Europa League" },
  { slug: "uefa.conference", name: "Conference League" },
  { slug: "por.1", name: "Primeira Liga" },
  { slug: "ned.1", name: "Eredivisie" },
  { slug: "usa.1", name: "MLS" },
  { slug: "mex.1", name: "Liga MX" },
  { slug: "bra.1", name: "Brasileirão" },
  { slug: "arg.1", name: "Liga Argentina" },
  { slug: "fifa.world", name: "Copa del Mundo" },
  { slug: "conmebol.america", name: "Copa América" },
  { slug: "UEFA.EURO", name: "Eurocopa" },
  { slug: "fifa.friendly", name: "Selección" },
]

/** Cuota americana (moneyline) → decimal. Devuelve null si no es válida. */
function americanToDecimal(ml: any): number | null {
  const n = typeof ml === "number" ? ml : parseFloat(String(ml ?? "").replace("+", ""))
  if (!isFinite(n) || n === 0) return null
  const dec = n > 0 ? n / 100 + 1 : 100 / Math.abs(n) + 1
  return Math.round(dec * 100) / 100
}

interface CacheRow {
  match_id: string
  league: string
  league_name: string
  home_team: string
  away_team: string
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
  payload: any
  updated_at: string
}

async function fetchScoreboard(slug: string, name: string): Promise<CacheRow[]> {
  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/${encodeURIComponent(slug)}/scoreboard`,
      { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(8000) },
    )
    if (!res.ok) return []
    const data = await res.json()
    const events: any[] = data?.events ?? []
    const now = Date.now()

    const rows: CacheRow[] = []
    for (const ev of events) {
      const comp = ev?.competitions?.[0]
      if (!comp) continue
      const competitors: any[] = comp.competitors ?? []
      const home = competitors.find((c) => c.homeAway === "home")
      const away = competitors.find((c) => c.homeAway === "away")
      if (!home || !away) continue

      const state = comp.status?.type?.state ?? ev.status?.type?.state ?? "pre"
      const kickoff = ev.date ?? null

      // Solo guardamos partidos relevantes: en juego, o programados/recién
      // finalizados dentro de una ventana de ±12h (evita inflar la tabla).
      const kickoffMs = kickoff ? new Date(kickoff).getTime() : now
      if (Math.abs(now - kickoffMs) > 12 * 3_600_000 && state !== "in") continue

      // Odds (si ESPN las trae) — moneyline americana → decimal. Real o null.
      const odds = comp.odds?.[0]
      const odds_home = americanToDecimal(odds?.homeTeamOdds?.moneyLine)
      const odds_away = americanToDecimal(odds?.awayTeamOdds?.moneyLine)
      const odds_draw = americanToDecimal(odds?.drawOdds?.moneyLine)

      rows.push({
        match_id: String(ev.id),
        league: slug,
        league_name: name,
        home_team: home.team?.displayName ?? home.team?.shortDisplayName ?? "Local",
        away_team: away.team?.displayName ?? away.team?.shortDisplayName ?? "Visitante",
        home_logo: home.team?.logo ?? null,
        away_logo: away.team?.logo ?? null,
        home_score: parseInt(home.score ?? "0") || 0,
        away_score: parseInt(away.score ?? "0") || 0,
        status_state: state,
        status_detail: comp.status?.type?.detail ?? comp.status?.type?.shortDetail ?? null,
        clock: comp.status?.displayClock ?? null,
        kickoff_iso: kickoff,
        odds_home,
        odds_draw,
        odds_away,
        payload: {
          name: ev.name ?? null,
          shortName: ev.shortName ?? null,
          venue: comp.venue?.fullName ?? null,
        },
        updated_at: new Date().toISOString(),
      })
    }
    return rows
  } catch {
    return []
  }
}

async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || secret.trim().length < 16) {
    console.error("[cron/live-sync] CRON_SECRET no configurado o demasiado corto — rechazando")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const auth = req.headers.get("authorization")
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // 1 fetch por liga, en paralelo
  const all = await Promise.all(LIVE_LEAGUES.map((l) => fetchScoreboard(l.slug, l.name)))
  const rows = all.flat()

  const sb = createServiceClient()
  let upserted = 0
  if (rows.length) {
    const { error } = await sb.from("live_matches_cache").upsert(rows, { onConflict: "match_id" })
    if (error) {
      console.error("[cron/live-sync] upsert error:", error.message)
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }
    upserted = rows.length
  }

  // Poda: elimina partidos cuyo kickoff fue hace >12h (ya finalizados).
  const pruneBefore = new Date(Date.now() - 12 * 3_600_000).toISOString()
  await sb.from("live_matches_cache").delete().lt("kickoff_iso", pruneBefore)

  const live = rows.filter((r) => r.status_state === "in").length
  return NextResponse.json({ ok: true, leagues: LIVE_LEAGUES.length, upserted, live, ts: new Date().toISOString() })
}

export async function GET(req: NextRequest)  { return handle(req) }
export async function POST(req: NextRequest) { return handle(req) }
