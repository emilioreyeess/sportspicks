/**
 * GET /api/cron/update
 *
 * Motor de actualización de fixtures: consulta API-Football y hace upsert en la
 * tabla `fixtures` de Supabase. Diseñado para ahorrar cuota de API-Football
 * (límite ~100 llamadas/día): refresca hoy + los próximos 2 días en una pasada.
 *
 * Seguridad: requiere `Authorization: Bearer ${CRON_SECRET}` (≥16 chars).
 * Fail-closed si CRON_SECRET no está configurado (CN-031).
 *
 * Plan Hobby: agendado 1×/día en vercel.json. Disparos adicionales se hacen
 * desde un servicio externo con el mismo header Bearer.
 */
import { NextRequest, NextResponse } from "next/server"
import { fetchFixturesFromApi, upsertFixtures } from "@/lib/infrastructure/footballApi"

export const runtime = "nodejs"
export const maxDuration = 60
export const dynamic = "force-dynamic"

/** Fecha YYYY-MM-DD desplazada `offset` días respecto a hoy (Europe/Madrid). */
function dateOffset(offset: number): string {
  const now = new Date()
  now.setUTCDate(now.getUTCDate() + offset)
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Europe/Madrid",
  }).format(now)
}

export async function GET(req: NextRequest) {
  // ── Auth: Bearer CRON_SECRET, fail-closed ──────────────────────────────────
  const secret = process.env.CRON_SECRET
  if (!secret || secret.length < 16) {
    console.error("[cron/update] CRON_SECRET no configurado o demasiado corto — rechazando")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const auth = req.headers.get("authorization")
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // ── Refrescar hoy + 2 días (3 fechas → bien dentro del límite diario) ───────
  const dates = [dateOffset(0), dateOffset(1), dateOffset(2)]
  const result: { date: string; upserted: number; error?: string }[] = []

  for (const date of dates) {
    try {
      const fixtures = await fetchFixturesFromApi(date)   // amistosos ya filtrados
      await upsertFixtures(fixtures)                       // upsert por fixture_id
      result.push({ date, upserted: fixtures.length })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`[cron/update] fallo en ${date}:`, msg)
      result.push({ date, upserted: 0, error: "fetch_failed" })
    }
  }

  const total = result.reduce((s, r) => s + r.upserted, 0)
  return NextResponse.json({ ok: true, total, days: result })
}
