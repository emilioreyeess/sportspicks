/**
 * GET/POST /api/cron/daily-learning
 *
 * Endpoint llamado por Vercel Cron a las 00:05 UTC (configurado en vercel.json).
 *
 * Seguridad: Vercel Cron envía el header `Authorization: Bearer ${CRON_SECRET}`.
 * Si CRON_SECRET no está configurado, el endpoint funciona pero loggea warning
 * (útil en dev local). En producción se requiere obligatoriamente.
 */
import { NextRequest, NextResponse } from "next/server"
import { runDailyLearning } from "@/lib/learning"

export const runtime = "nodejs"
export const maxDuration = 60   // hasta 60s para procesar todas las ligas

async function handle(req: NextRequest) {
  // CN-005: CRON_SECRET required and must be ≥ 16 chars; reject if missing in any env
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get("authorization")
  if (!secret || secret.length < 16) {
    console.error("[cron] CRON_SECRET no configurado o demasiado corto — rechazando petición")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Permite ?date=YYYY-MM-DD para re-procesar manualmente un día concreto
  const url = new URL(req.url)
  const targetDate = url.searchParams.get("date") ?? undefined

  const result = await runDailyLearning(targetDate)
  return NextResponse.json(result)
}

export async function GET(req: NextRequest)  { return handle(req) }
export async function POST(req: NextRequest) { return handle(req) }
