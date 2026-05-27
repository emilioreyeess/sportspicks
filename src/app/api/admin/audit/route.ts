/**
 * GET /api/admin/audit
 * Devuelve los candidatos rechazados por el motor de decisión en el último run.
 * Útil para calibrar umbrales y entender por qué un partido no produjo pick.
 * PROTEGIDO: requiere x-admin-token igual a ADMIN_TOKEN.
 */
import { NextRequest, NextResponse } from "next/server"
import { getStore } from "@/lib/store"

export const runtime = "nodejs"

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || ""

function isAuthorized(req: NextRequest): boolean {
  if (!ADMIN_TOKEN) return false
  const t = req.headers.get("x-admin-token") ?? ""
  if (t.length !== ADMIN_TOKEN.length) return false
  let diff = 0
  for (let i = 0; i < t.length; i++) diff |= t.charCodeAt(i) ^ ADMIN_TOKEN.charCodeAt(i)
  return diff === 0
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
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
