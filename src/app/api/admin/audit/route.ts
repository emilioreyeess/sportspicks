/**
 * GET /api/admin/audit
 * Devuelve los candidatos rechazados por el motor de decisión en el último run.
 * Útil para calibrar umbrales y entender por qué un partido no produjo pick.
 */
import { NextResponse } from "next/server"
import { getStore } from "@/lib/store"

export const runtime = "nodejs"

export async function GET() {
  const store = getStore()
  return NextResponse.json({
    date: store.date,
    pipeline_run_at: store.meta.lastSuccessAt,
    matches_evaluated: store.meta.counts.matches,
    picks_published: store.meta.counts.valuePicks,
    rejected_count: store.lastAuditTrail?.length ?? 0,
    rejected: store.lastAuditTrail ?? [],
  })
}
