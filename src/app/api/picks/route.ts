import { NextRequest } from "next/server"
import { getStore } from "@/lib/store"
import { ensureWarm, ensureFresh, runPipeline } from "@/lib/pipeline"
import { consume, getClientIp, tooManyRequests } from "@/lib/rate-limit"

export const runtime = "nodejs"
export const maxDuration = 120

/**
 * Value Picks — lee los resultados precomputados por el pipeline diario.
 * Respuesta instantánea. Si el store está frío, calienta una vez (cold start).
 *
 * Garantía de frescura:
 *  - Si store.date != today → regenera (evita servir picks de ayer como si fueran de hoy)
 *  - Filtra picks cuyo kickoff_utc sea anterior a hoy (doble seguridad)
 */
export async function GET(req: NextRequest) {
  await ensureWarm()
  const ip = getClientIp(req)
  if (!consume(ip, 30, 6)) return tooManyRequests(60)
  ensureFresh()

  const store = getStore()
  const today = new Date().toISOString().split("T")[0]

  // Si el store tiene datos de otro día, forzar regeneración y devolver vacío
  if (store.date && store.date !== today) {
    runPipeline("date-mismatch").catch(() => {})
    return Response.json({
      picks: [],
      total: 0,
      date: today,
      note: "Generando los picks del día, vuelve en unos segundos…",
      generated_at: null,
    })
  }

  const tier = new URL(req.url).searchParams.get("tier") ?? ""
  // Filtro de seguridad: solo picks cuyo kickoff sea de hoy en adelante
  let picks = (store.valuePicks ?? []).filter((p: any) => {
    if (!p.kickoff_utc) return true
    const kickoffDate = p.kickoff_utc.slice(0, 10) // YYYY-MM-DD
    return kickoffDate >= today
  })
  if (tier) picks = picks.filter((p: any) => p.confidence_tier === tier)

  return Response.json({
    picks,
    total: picks.length,
    date: store.date ?? today,
    note: picks.length === 0 ? (store.picksNote ?? undefined) : undefined,
    generated_at: store.meta.lastSuccessAt,
  })
}
