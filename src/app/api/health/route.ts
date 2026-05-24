import { getStore } from "@/lib/store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Liveness + readiness check para load balancers y monitorización. */
export async function GET() {
  const s = getStore()
  const healthy = s.meta.status === "ready" || s.meta.status === "running" || s.meta.status === "cold"
  return Response.json({
    status: healthy ? "ok" : "degraded",
    pipeline_status: s.meta.status,
    last_success_at: s.meta.lastSuccessAt,
    date: s.date,
    uptime_s: Math.round(process.uptime()),
    version: process.env.NEXT_PUBLIC_VERSION ?? "1.0.0",
  }, { status: healthy ? 200 : 503 })
}
