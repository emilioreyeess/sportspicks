/**
 * POST /api/picks/second-opinion
 *
 * Body: {
 *   match_id: string,
 *   original_market: string,
 *   original_selection: string,
 *   original_quality: number,
 *   exclude_selections?: string[]   // selecciones ya rechazadas por el usuario
 * }
 *
 * Devuelve un pick alternativo del MISMO partido, en otro mercado,
 * solo si iguala o mejora la calidad del original. Aplica el motor
 * de decisión completo.
 *
 * NO devuelve picks inventados ni de menor calidad — esa es la regla absoluta.
 */
import { NextRequest, NextResponse } from "next/server"
import { getStore } from "@/lib/store"
import { findAlternativePick, ensureWarm } from "@/lib/pipeline"
import { consume, getClientIp, tooManyRequests } from "@/lib/rate-limit"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  if (!consume(`second-opinion:${ip}`, 10, 2)) return tooManyRequests(30)

  await ensureWarm()

  let body: {
    match_id?: string
    original_market?: string
    original_selection?: string
    original_quality?: number
    exclude_selections?: string[]
  }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }) }

  const { match_id, original_market, original_selection, original_quality, exclude_selections = [] } = body
  if (!match_id || !original_market || !original_selection || typeof original_quality !== "number") {
    return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 })
  }

  const store = getStore()
  const data = store.dailyData
  if (!data) {
    return NextResponse.json({
      found: false,
      reason: "Los datos del día aún no están disponibles. Inténtalo de nuevo en unos segundos.",
    })
  }

  const result = findAlternativePick(
    data,
    match_id,
    original_selection,
    original_market,
    original_quality,
    exclude_selections,
  )

  return NextResponse.json(result)
}
