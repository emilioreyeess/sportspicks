/**
 * GET /api/admin/force-sync-wc — Sobrescritura TOTAL del calendario del Mundial.
 *
 * Consulta a API-Football el calendario oficial COMPLETO (league=1 FIFA World Cup,
 * season=2026) y hace un HARD UPSERT en `fixtures`, sobrescribiendo explícitamente
 * `match_date` (kickoff) y `status` con los datos frescos de la fuente oficial.
 *
 * REGLA DE ZONA HORARIA (FASE 2): `match_date` se guarda TAL CUAL viene de la API
 * (`fixture.date`, ISO 8601 con offset, p.ej. "2026-06-12T15:00:00+00:00"). NUNCA
 * se pasa por new Date().toLocaleString() ni se reformatea → cero mutación de TZ.
 *
 * Seguridad: requiere `Authorization: Bearer ${CRON_SECRET}` (fail-closed).
 */
import { NextRequest } from "next/server"
import { createServiceClient } from "@/lib/supabase/client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const API_BASE = "https://v3.football.api-sports.io"
const WC_LEAGUE_ID = 1
const WC_SEASON = 2026

// Mapea el status.short de API-Football a nuestra etiqueta de columna `status`.
function mapStatus(short: string): string {
  if (["FT", "AET", "PEN"].includes(short)) return "finished"
  if (["1H", "2H", "HT", "ET", "P", "BT", "LIVE"].includes(short)) return "live"
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

  try {
    const res = await fetch(`${API_BASE}/fixtures?league=${WC_LEAGUE_ID}&season=${WC_SEASON}`, {
      headers: { "x-apisports-key": apiKey, "Accept": "application/json" },
      cache: "no-store",
    })
    if (!res.ok) return Response.json({ error: `API-Football ${res.status}` }, { status: 502 })
    const json = await res.json() as any
    const fixtures: any[] = json?.response ?? []
    if (!fixtures.length) return Response.json({ error: "API-Football devolvió 0 fixtures" }, { status: 502 })

    // Filas de upsert: kickoff (match_date) y status SOBRESCRITOS desde la fuente.
    // match_date = fixture.date crudo (ISO 8601 con offset). Sin stats → preserva
    // las cuotas/standings que escribe el cron (onConflict por fixture_id).
    const rows = fixtures.map((f) => ({
      fixture_id: Number(f.fixture.id),
      home_team: f.teams?.home?.name ?? null,
      away_team: f.teams?.away?.name ?? null,
      league: "World Cup",
      match_date: f.fixture.date,                 // ← ISO UTC tal cual, sin tocar TZ
      status: mapStatus(String(f.fixture?.status?.short ?? "")),
      updated_at: new Date().toISOString(),
    }))

    const sb = createServiceClient()
    const { error } = await sb.from("fixtures").upsert(rows, { onConflict: "fixture_id" })
    if (error) return Response.json({ error: error.message }, { status: 500 })

    return Response.json({
      ok: true,
      source: `API-Football league=${WC_LEAGUE_ID} season=${WC_SEASON}`,
      upserted: rows.length,
      sample: rows.slice(0, 3).map((r) => ({ match: `${r.home_team} vs ${r.away_team}`, kickoff: r.match_date, status: r.status })),
    })
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
