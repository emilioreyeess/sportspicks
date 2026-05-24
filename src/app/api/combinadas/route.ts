import { NextRequest } from "next/server"
import { getStore } from "@/lib/store"
import { ensureWarm, ensureFresh, pickCombinadaFromPool } from "@/lib/pipeline"

export const runtime = "nodejs"
export const maxDuration = 120

/**
 * Combinadas — selecciona del pool precomputado con variedad.
 * Cada llamada da una combinación distinta (muestreo aleatorio del top-K).
 * Markets disponibles desde ESPN: 1X2 (incluido Empate), Over/Under 2.5, Hándicap.
 * Tarjetas y córners no están en la fuente de datos.
 */
export async function GET(req: NextRequest) {
  await ensureWarm()
  ensureFresh()

  const { searchParams } = new URL(req.url)
  const modeRaw = searchParams.get("mode") ?? "balanced"
  const mode = ["safe", "balanced", "dream"].includes(modeRaw) ? modeRaw : "balanced"
  const lidRaw = searchParams.get("league_id") ?? ""
  const leagueId = ["1", "2", "3", "4", "5"].includes(lidRaw) ? lidRaw : ""

  const result = pickCombinadaFromPool(getStore().combinadaPool, mode, leagueId)
  if (result?.error) return Response.json(result, { status: 422 })
  return Response.json(result)
}
