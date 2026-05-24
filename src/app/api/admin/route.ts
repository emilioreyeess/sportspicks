import { NextRequest } from "next/server"
import { getStore } from "@/lib/store"
import { runPipeline, startScheduler } from "@/lib/pipeline"
import { consume, getClientIp, tooManyRequests } from "@/lib/rate-limit"

export const runtime = "nodejs"
export const maxDuration = 180

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || ""

function isAuthorized(req: NextRequest | Request): boolean {
  if (!ADMIN_TOKEN) return false // sin token configurado → endpoint cerrado
  const t = req.headers.get("x-admin-token") || new URL(req.url).searchParams.get("token") || ""
  // Comparación de tiempo constante para evitar timing attacks
  if (t.length !== ADMIN_TOKEN.length) return false
  let diff = 0
  for (let i = 0; i < t.length; i++) diff |= t.charCodeAt(i) ^ ADMIN_TOKEN.charCodeAt(i)
  return diff === 0
}

/** Estado del pipeline diario — protegido con ADMIN_TOKEN. */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return Response.json({ error: "No autorizado" }, { status: 401 })
  startScheduler()
  const s = getStore()
  return Response.json({
    date: s.date,
    meta: s.meta,
    sample: {
      valuePicks: s.valuePicks.slice(0, 8).map((p: any) => ({
        selection: p.selection, market: p.market,
        quality: p.quality_score, edge: p.value_edge, odd: p.best_odd, risk: p.risk_tier,
      })),
      retos: s.retos.map((r: any) => ({
        title: r.title, daily_pick: r.daily_pick?.selection ?? null,
        odd: r.daily_pick?.odd ?? null,
      })),
    },
  })
}

/** Refresco manual del pipeline. Protegido por token + rate limit. */
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return Response.json({ error: "No autorizado" }, { status: 401 })
  const ip = getClientIp(req)
  if (!consume(`admin-refresh:${ip}`, 3, 1)) return tooManyRequests(60)
  await runPipeline("admin-manual")
  return Response.json({ ok: true, meta: getStore().meta })
}
