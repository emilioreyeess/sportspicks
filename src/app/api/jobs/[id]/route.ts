/**
 * GET /api/jobs/[id]  — Job status polling (FASE 3)
 * ════════════════════════════════════════════════════════════════════════════
 * Clients poll this endpoint after receiving a jobId from an async endpoint.
 *
 * Response shape:
 *   { status: "queued" | "processing" | "done" | "failed", result?, error? }
 *
 * Rate limit: 60 polls/min per IP — prevents thundering herd on polling loops.
 * ════════════════════════════════════════════════════════════════════════════
 */
import { NextRequest } from "next/server"
import { getJob } from "@/lib/jobs"
import { consume, getClientIp, tooManyRequests } from "@/lib/rate-limit"
import { getServerSession } from "@/lib/auth-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Must be authenticated
  const session = await getServerSession()
  if (!session?.user?.email) {
    return Response.json({ error: "No autorizado" }, { status: 401 })
  }

  // Rate limit: 60 polls/min per IP
  const ip = getClientIp(req)
  if (!consume(`jobs-poll:${ip}`, 60, 60)) return tooManyRequests(5)

  // Validate job ID format (base64url, 16 chars)
  const { id } = await params
  if (!id || !/^[A-Za-z0-9_-]{10,24}$/.test(id)) {
    return Response.json({ error: "ID de trabajo inválido" }, { status: 400 })
  }

  const job = await getJob(id)

  if (!job) {
    return Response.json(
      { status: "not_found", error: "Trabajo no encontrado o expirado." },
      { status: 404 },
    )
  }

  // Return status + result (strip internal fields)
  return Response.json({
    id: job.id,
    type: job.type,
    status: job.status,
    result: job.result ?? null,
    error: job.error ?? null,
    elapsed_ms: Date.now() - job.createdAt,
  })
}
