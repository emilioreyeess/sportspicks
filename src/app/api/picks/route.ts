import { NextRequest } from "next/server"
import { getStore } from "@/lib/store"
import { ensureWarm, ensureFresh } from "@/lib/pipeline"

export const runtime = "nodejs"
export const maxDuration = 120

/**
 * Value Picks — lee los resultados precomputados por el pipeline diario.
 * Respuesta instantánea. Si el store está frío, calienta una vez (cold start).
 */
export async function GET(req: NextRequest) {
  await ensureWarm()
  ensureFresh()

  const tier = new URL(req.url).searchParams.get("tier") ?? ""
  const store = getStore()
  let picks = store.valuePicks
  if (tier) picks = picks.filter((p: any) => p.confidence_tier === tier)

  return Response.json({
    picks,
    total: picks.length,
    date: store.date ?? new Date().toISOString().split("T")[0],
    note: picks.length === 0 ? store.picksNote : undefined,
    generated_at: store.meta.lastSuccessAt,
  })
}
