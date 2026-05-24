import { NextRequest } from "next/server"
import { getStore } from "@/lib/store"
import { ensureWarm, ensureFresh } from "@/lib/pipeline"

export const runtime = "nodejs"
export const maxDuration = 120

/**
 * Retos — lee los retos con pick diario real precomputados a diario.
 */
export async function GET(_req: NextRequest) {
  await ensureWarm()
  ensureFresh()

  const store = getStore()
  return Response.json({
    challenges: store.retos,
    note: store.retos.length === 0 ? store.retosNote : undefined,
    generated_at: store.meta.lastSuccessAt,
  })
}
