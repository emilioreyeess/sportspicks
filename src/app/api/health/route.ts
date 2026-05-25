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
      uptime_s: Math.round(process.uptime()),
      version: process.env.NEXT_PUBLIC_VERSION ?? "1.0.0",
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
      env: process.env.NODE_ENV,
    },
    { status: healthy ? 200 : 503 },
  )
}
