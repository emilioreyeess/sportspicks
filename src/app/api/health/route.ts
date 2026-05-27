import { getStore } from "@/lib/store"
import { kv } from "@vercel/kv"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Liveness + readiness check para BetterStack y load balancers.
 *
 * BetterStack: configurar en https://betterstack.com/uptime
 *   · URL: https://sportspicks.app/api/health
 *   · Interval: 3 minutos
 *   · Expected status: 200
 *   · Alert: email + webhook (Slack/Discord) si devuelve !200
 */
export async function GET() {
  const s = getStore()
  const pipelineHealthy =
    s.meta.status === "ready" || s.meta.status === "running" || s.meta.status === "cold"

  // ─── Comprobación rápida de KV ──────────────────────────────────────────
  let kvOk = false
  try {
    await kv.set("health:ping", "1", { ex: 10 })
    kvOk = true
  } catch {
    kvOk = false
  }

  const healthy = pipelineHealthy // KV degradado no es crítico para servir picks

  // CN-030: Omit version/commit/env from unauthenticated response to reduce fingerprinting
  return Response.json(
    {
      status: healthy ? "ok" : "degraded",
      checks: {
        pipeline: pipelineHealthy ? "ok" : "degraded",
        kv: kvOk ? "ok" : "degraded",
      },
      pipeline_status: s.meta.status,
      last_success_at: s.meta.lastSuccessAt,
      date: s.date,
    },
    { status: healthy ? 200 : 503 },
  )
}
