import { NextRequest } from "next/server"
import { getStore } from "@/lib/store"
import { ensureWarm, ensureFresh, pickCombinadaFromPool } from "@/lib/pipeline"
import { consume, getClientIp, tooManyRequests } from "@/lib/rate-limit"

export const runtime = "nodejs"
export const maxDuration = 120
// Anti-zombie: jamás servir esta respuesta desde la caché de Next/Vercel.
export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * Combinadas — selecciona del pool precomputado con variedad.
 * Cada llamada da una combinación distinta (muestreo aleatorio del top-K).
 * FUENTE ÚNICA del pool: pipeline con cuotas de API-Football (fetchFixtureOddsAF)
 * + fallback de favoritos de mercado (prob. implícita de cuotas reales).
 */
export async function GET(req: NextRequest) {
  await ensureWarm()
  const ip = getClientIp(req)
  if (!consume(ip, 20, 4)) return tooManyRequests(60)
  ensureFresh()

  const { searchParams } = new URL(req.url)
  const modeRaw = searchParams.get("mode") ?? "balanced"
  const mode = ["safe", "balanced", "dream"].includes(modeRaw) ? modeRaw : "balanced"
  const lidRaw = searchParams.get("league_id") ?? ""
  const leagueId = ["1", "2", "3", "4", "5"].includes(lidRaw) ? lidRaw : ""

  // Trazabilidad: imprime la fuente y la edad del pool en cada request.
  const store = getStore()
  console.log(
    `[combinadas] FUENTE DE DATOS: pipeline API-Football (fetchFixtureOddsAF) · pool=${store.combinadaPool?.length ?? 0} selecciones · generado=${store.dailyData?.fetchedAt ?? "(sin datos)"}`,
  )

  const result = pickCombinadaFromPool(store.combinadaPool, mode, leagueId)
  if (result?.error) return Response.json(result, { status: 422 })
  return Response.json(result)
}
