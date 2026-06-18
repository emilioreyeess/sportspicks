/**
 * GET /api/cron/sync-football — Mantiene la BD del Mundial VIVA (sin intervención).
 *
 * Cron automático: llama a API-Football por el calendario oficial completo del
 * Mundial (league=1 FIFA World Cup, season=2026) y hace HARD UPSERT en `fixtures`
 * actualizando en cada partido:
 *   · match_date  (kickoff)  ← ISO 8601 con offset, TAL CUAL de la API (sin tocar TZ)
 *   · status                 ← scheduled | live | finished (mapeado de status.short)
 *   · stats.result.{home,away}  ← marcador real cuando hay goles
 *
 * Programado en vercel.json (cada hora). Seguridad: Bearer CRON_SECRET (fail-closed).
 */
import { NextRequest } from "next/server"
import { createServiceClient } from "@/lib/supabase/client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const API_BASE = "https://v3.football.api-sports.io"
const WC_LEAGUE_ID = 1
const WC_SEASON = 2026
const FINISHED = new Set(["FT", "AET", "PEN"])
const LIVE = new Set(["1H", "2H", "HT", "ET", "P", "BT", "LIVE"])

function mapStatus(short: string): string {
  if (FINISHED.has(short)) return "finished"
  if (LIVE.has(short)) return "live"
  return "scheduled"
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || cronSecret.trim().length < 16) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }
  const apiKey = process.env.FOOTBALL_API_KEY
  if (!apiKey) return Response.json({ error: "FOOTBALL_API_KEY no configurada" }, { status: 500 })

  const out = { fetched: 0, upserted: 0, finished: 0, live: 0, errors: 0 }
  try {
    const res = await fetch(`${API_BASE}/fixtures?league=${WC_LEAGUE_ID}&season=${WC_SEASON}`, {
      headers: { "x-apisports-key": apiKey, "Accept": "application/json" },
      cache: "no-store",
    })
    if (!res.ok) return Response.json({ error: `API-Football ${res.status}` }, { status: 502 })
    const fixtures: any[] = (await res.json())?.response ?? []
    out.fetched = fixtures.length
    if (!fixtures.length) return Response.json({ error: "API devolvió 0 fixtures" }, { status: 502 })

    const sb = createServiceClient()
    // Lee los stats existentes en bloque para no pisar odds/standings al fusionar el marcador.
    const ids = fixtures.map((f) => Number(f.fixture.id))
    const { data: existing } = await sb.from("fixtures").select("fixture_id, stats").in("fixture_id", ids)
    const statsById = new Map((existing ?? []).map((r: any) => [r.fixture_id, r.stats ?? {}]))

    const rows = fixtures.map((f) => {
      const fid = Number(f.fixture.id)
      const short = String(f.fixture?.status?.short ?? "")
      const status = mapStatus(short)
      if (status === "finished") out.finished++
      else if (status === "live") out.live++
      const base = statsById.get(fid) ?? {}
      const stats =
        f.goals?.home != null && f.goals?.away != null
          ? { ...base, result: { home: Number(f.goals.home), away: Number(f.goals.away), status: short, settled_at: new Date().toISOString() } }
          : base
      return {
        fixture_id: fid,
        home_team: f.teams?.home?.name ?? null,
        away_team: f.teams?.away?.name ?? null,
        league: "World Cup",
        match_date: f.fixture.date,        // ← ISO UTC crudo, sin new Date().toLocaleString()
        status,
        stats,
        updated_at: new Date().toISOString(),
      }
    })

    const { error } = await sb.from("fixtures").upsert(rows, { onConflict: "fixture_id" })
    if (error) { out.errors++; return Response.json({ ok: false, error: error.message, ...out }, { status: 500 }) }
    out.upserted = rows.length

    return Response.json({
      ok: true,
      source: `API-Football league=${WC_LEAGUE_ID} season=${WC_SEASON}`,
      ...out,
      sample: rows.slice(0, 3).map((r) => ({ match: `${r.home_team} vs ${r.away_team}`, match_date: r.match_date, status: r.status })),
    })
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e), ...out }, { status: 500 })
  }
}
