/**
 * GET /api/cron/update
 *
 * Motor de actualización de fixtures: consulta API-Football y hace upsert en la
 * tabla `fixtures` de Supabase. Refresca SOLO la fecha de HOY (próximas 24h) para
 * mantener el payload mínimo (standings deduplicados por liga).
 *
 * Seguridad: requiere `Authorization: Bearer ${CRON_SECRET}` (≥16 chars).
 * Fail-closed si CRON_SECRET no está configurado (CN-031).
 *
 * DESACOPLE (cron-job.org corta a los 30s): tras validar el secret, respondemos
 * 200 de INMEDIATO y ejecutamos la tarea pesada en segundo plano con `after()`
 * de next/server. Vercel lo respalda con waitUntil → la función NO se mata al
 * enviar la respuesta HTTP; sigue viva hasta completar (dentro de maxDuration).
 * Así cron-job.org ve un 200 rápido y no acumula 'fallos' que lo auto-deshabiliten.
 */
import { NextRequest, NextResponse, after } from "next/server"
import { fetchFixturesEnrichedForDates, upsertFixtures } from "@/lib/infrastructure/footballApi"

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

/** Tarea pesada: refresca fixtures de HOY (próximas 24h). Se ejecuta en segundo plano. */
async function runUpdate(): Promise<void> {
  // HOY + MAÑANA: el pipeline de value picks acepta kickoffs de hoy y mañana
  // (ventana UTC en fetchDailyData), así que la ingesta debe cubrir ambos días o
  // los partidos de mañana se descartan por falta de fixture_id → sin cuotas.
  const dates = [dateOffset(0), dateOffset(1)]
  try {
    // Fetch de fixtures + standings 1×/liga (dedupe global).
    const groups = await fetchFixturesEnrichedForDates(dates)

    // Upserts independientes por fecha → en paralelo (Supabase).
    const result = await Promise.all(
      groups.map(async ({ date, fixtures }) => {
        try {
          await upsertFixtures(fixtures, { includeStats: true })
          return { date, upserted: fixtures.length }
        } catch (e) {
          console.error(`[cron/update] upsert ${date} falló:`, e instanceof Error ? e.message : e)
          return { date, upserted: 0, error: "upsert_failed" }
        }
      }),
    )

    const total = result.reduce((s, r) => s + r.upserted, 0)
    console.log("[cron/update] completado en segundo plano:", JSON.stringify({ total, days: result }))
  } catch (e) {
    console.error("[cron/update] fallo en segundo plano:", e instanceof Error ? e.message : e)
  }
}

export async function GET(req: NextRequest) {
  // ── Auth: Bearer CRON_SECRET, fail-closed (retorno temprano 401) ────────────
  const secret = process.env.CRON_SECRET
  if (!secret || secret.length < 16) {
    console.error("[cron/update] CRON_SECRET no configurado o demasiado corto — rechazando")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const auth = req.headers.get("authorization")
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // ── Desacople: la tarea pesada corre en segundo plano (after → waitUntil) ────
  // y respondemos 200 al instante para que cron-job.org no corte a los 30s.
  after(runUpdate())

  return NextResponse.json({ status: "Processing in background" }, { status: 200 })
}
