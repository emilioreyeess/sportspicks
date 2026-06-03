/**
 * GET/POST /api/cron/ml-settle
 *
 * Ciclo de aprendizaje continuo (STEP 1). Vercel Cron lo dispara a las
 * 00:00 y 12:00 UTC (schedule "0 0,12 * * *" en vercel.json):
 *
 *   1. settleGroundTruth()      — busca el resultado FINAL real de las
 *                                 predicciones pendientes (ESPN) y las liquida.
 *   2. computeBrierAndAccuracy()— recalcula Brier Score + Accuracy reales.
 *   3. adjustTeamFormWeights()  — ajusta los multiplicadores de calibración
 *                                 si el modelo pierde sistemáticamente.
 *
 * Seguridad: requiere `Authorization: Bearer ${CRON_SECRET}` (≥16 chars).
 */
import { NextRequest, NextResponse } from "next/server"
import { revalidatePath, revalidateTag } from "next/cache"
import { runMlCycle } from "@/lib/learning/supabase-ml"
import { refreshYesterdayPicks } from "@/lib/yesterday-refresh"

export const runtime = "nodejs"
export const maxDuration = 120          // liquidar muchos partidos puede tardar
export const dynamic = "force-dynamic"

async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || secret.trim().length < 16) {
    console.error("[cron/ml-settle] CRON_SECRET no configurado o demasiado corto — rechazando")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const auth = req.headers.get("authorization")
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(req.url)
  const asOfDate = url.searchParams.get("date") ?? undefined

  try {
    const result = await runMlCycle(asOfDate)
    // Además del ciclo ML (Supabase predictions_log), re-verificamos el snapshot
    // de "ayer" que ven los usuarios: si quedaron picks PENDING en KV porque el
    // pipeline diario corrió antes de los finales, los liquidamos aquí.
    let yesterdayRefresh: any = null
    try {
      yesterdayRefresh = await refreshYesterdayPicks({ force: true })
    } catch (e: any) {
      yesterdayRefresh = { ran: false, reason: `error: ${e?.message ?? e}` }
    }

    // ── Invalidación de caché ────────────────────────────────────────────
    // El backend acaba de cambiar el estado de N picks: forzamos a Next.js
    // a regenerar las rutas/ tags que los leen. Sin esto, los users podían
    // seguir viendo "pendiente" hasta que la página caducara naturalmente.
    // Trabajamos sobre TODOS los frontends afectados.
    const revalidated: string[] = []
    try {
      for (const path of ["/historico", "/value", "/"]) {
        revalidatePath(path); revalidated.push(path)
      }
      for (const tag of ["picks-history", "picks-stats", "picks-yesterday"]) {
        revalidateTag(tag)
      }
    } catch (e: any) {
      // revalidatePath puede fallar fuera de App Router context — no crítico
      console.warn("[cron/ml-settle] revalidate warn:", e?.message ?? e)
    }

    return NextResponse.json({ ok: true, ...result, yesterdayRefresh, revalidated })
  } catch (e: any) {
    console.error("[cron/ml-settle] error:", e?.message ?? e)
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 })
  }
}

export async function GET(req: NextRequest)  { return handle(req) }
export async function POST(req: NextRequest) { return handle(req) }
