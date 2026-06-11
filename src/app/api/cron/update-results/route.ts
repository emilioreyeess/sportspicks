/**
 * GET /api/cron/update-results — Bucle de aprendizaje (ingesta de resultados).
 *
 * 1. Golpea API-Football para los fixtures de HOY y AYER (UTC).
 * 2. Selecciona los FINALIZADOS (status.short ∈ FT/AET/PEN).
 * 3. Guarda el marcador real (goals.home/away) y el estado en la tabla `fixtures`:
 *      - columna `status` = 'finished'
 *      - `stats.result` = { home, away, status, settled_at }
 * 4. Los resultados quedan disponibles para que el motor (Value Picks / combinadas)
 *    ajuste la forma/probabilidad implícita de esos equipos en próximos partidos.
 *
 * Seguridad: requiere `Authorization: Bearer ${CRON_SECRET}` (fail-closed).
 */
import { NextRequest } from "next/server"
import { createServiceClient } from "@/lib/supabase/client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const API_BASE = "https://v3.football.api-sports.io"
const FINISHED = new Set(["FT", "AET", "PEN"])

async function fetchFixturesByDate(date: string, apiKey: string): Promise<any[]> {
  const res = await fetch(`${API_BASE}/fixtures?date=${date}`, {
    headers: { "x-apisports-key": apiKey, "Accept": "application/json" },
    cache: "no-store",
  })
  if (!res.ok) return []
  const json = await res.json() as any
  return json?.response ?? []
}

export async function GET(req: NextRequest) {
  // ── Auth: Bearer CRON_SECRET, fail-closed ──
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || cronSecret.trim().length < 16) {
    console.error("[update-results] CRON_SECRET no configurado — rechazando")
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const apiKey = process.env.FOOTBALL_API_KEY
  if (!apiKey) return Response.json({ error: "FOOTBALL_API_KEY no configurada" }, { status: 500 })

  const out = { scanned: 0, finished: 0, updated: 0, errors: 0, days: [] as string[] }
  try {
    const sb = createServiceClient()
    const today = new Date().toISOString().slice(0, 10)
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    out.days = [yesterday, today]

    for (const date of out.days) {
      const fixtures = await fetchFixturesByDate(date, apiKey)
      out.scanned += fixtures.length

      for (const f of fixtures) {
        const short = String(f?.fixture?.status?.short ?? "")
        if (!FINISHED.has(short)) continue
        out.finished++
        const fid = Number(f?.fixture?.id)
        const homeGoals = f?.goals?.home
        const awayGoals = f?.goals?.away
        if (!Number.isFinite(fid) || homeGoals == null || awayGoals == null) continue

        // Lee el stats existente para no pisar odds/standings al fusionar el resultado.
        const { data: row } = await sb.from("fixtures").select("stats").eq("fixture_id", fid).maybeSingle()
        if (!row) continue   // solo actualizamos fixtures que ya tenemos en la BD

        const stats = {
          ...((row as any).stats ?? {}),
          result: {
            home: Number(homeGoals),
            away: Number(awayGoals),
            status: short,
            settled_at: new Date().toISOString(),
          },
        }
        const { error } = await sb
          .from("fixtures")
          .update({ status: "finished", stats, updated_at: new Date().toISOString() })
          .eq("fixture_id", fid)
        if (error) out.errors++; else out.updated++
      }
    }
    return Response.json({ ok: true, ...out })
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e), ...out }, { status: 500 })
  }
}
