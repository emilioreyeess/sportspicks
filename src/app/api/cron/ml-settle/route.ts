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
import { runMlCycle } from "@/lib/learning/supabase-ml"

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
    return NextResponse.json({ ok: true, ...result })
  } catch (e: any) {
    console.error("[cron/ml-settle] error:", e?.message ?? e)
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 })
  }
}

export async function GET(req: NextRequest)  { return handle(req) }
export async function POST(req: NextRequest) { return handle(req) }
