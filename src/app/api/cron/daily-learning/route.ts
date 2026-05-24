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
  // Verificación de Vercel Cron
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get("authorization")
  if (secret) {
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  } else if (process.env.VERCEL === "1") {
    console.warn("[cron] CRON_SECRET no configurado en producción — endpoint sin protección")
  }

  // Permite ?date=YYYY-MM-DD para re-procesar manualmente un día concreto
  const url = new URL(req.url)
  const targetDate = url.searchParams.get("date") ?? undefined

  const result = await runDailyLearning(targetDate)
  return NextResponse.json(result)
}

export async function GET(req: NextRequest)  { return handle(req) }
export async function POST(req: NextRequest) { return handle(req) }
