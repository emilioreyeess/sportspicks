import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { createServiceClient } from "@/lib/supabase/client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// ── Constantes de validación ──────────────────────────────────────────────────
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_STAKE = 100_000
const MIN_STAKE = 0.01
const MIN_ODDS  = 1.01
const MAX_ODDS  = 10_000

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return Response.json({ error: "No autorizado" }, { status: 401 })

  if (!UUID_RE.test(id)) return Response.json({ error: "ID inválido" }, { status: 400 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 })
  }

  const sb = createServiceClient()

  // ── Rama A: liquidación (status) — flujo existente ──────────────────────────
  if ("status" in body) {
    const validStatuses = ["won", "lost", "void"]
    if (typeof body.status !== "string" || !validStatuses.includes(body.status)) {
      return Response.json({ error: "Estado inválido" }, { status: 400 })
    }
    const status = body.status as "won" | "lost" | "void"

    // Atomic update: ownership + still-pending check en una sola query.
    const { data, error } = await sb
      .from("bets")
      .update({ status, settled_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_email", session.user.email)
      .eq("status", "pending")
      .select()
      .single()

    if (error || !data) {
      const { data: ex } = await sb.from("bets").select("id, user_email, status").eq("id", id).single()
      if (!ex || ex.user_email !== session.user.email) return Response.json({ error: "No encontrado" }, { status: 404 })
      if (ex.status !== "pending") return Response.json({ error: "Esta apuesta ya fue liquidada" }, { status: 409 })
      return Response.json({ error: "Error al actualizar" }, { status: 500 })
    }

    await sb.from("bet_legs").update({ status }).eq("bet_id", id)
    return Response.json({ ok: true, bet: data })
  }

  // ── Rama B: rescate OCR (stake + combined_odds) — E2 ────────────────────────
  // Valida propiedad antes de tocar nada.
  const { data: existing } = await sb
    .from("bets")
    .select("id, user_email, needs_review")
    .eq("id", id)
    .single()
  if (!existing || existing.user_email !== session.user.email) {
    return Response.json({ error: "No encontrado" }, { status: 404 })
  }

  // Validar stake
  const stakeRaw = Number(body.stake)
  if (!Number.isFinite(stakeRaw) || stakeRaw < MIN_STAKE || stakeRaw > MAX_STAKE) {
    return Response.json({ error: `Stake inválido. Rango: ${MIN_STAKE}–${MAX_STAKE}€` }, { status: 400 })
  }

  // Validar combined_odds
  const oddsRaw = Number(body.combined_odds)
  if (!Number.isFinite(oddsRaw) || oddsRaw < MIN_ODDS || oddsRaw > MAX_ODDS) {
    return Response.json({ error: `Cuota inválida. Rango: ${MIN_ODDS}–${MAX_ODDS}` }, { status: 400 })
  }

  const wantsPublish = body.publish === true
  const potentialReturn = Math.round(stakeRaw * oddsRaw * 100) / 100

  const { data: updated, error: upErr } = await sb
    .from("bets")
    .update({
      stake:            stakeRaw,
      combined_odds:    oddsRaw,
      potential_return: potentialReturn,
      needs_review:     false,
      is_published:     wantsPublish,
    })
    .eq("id", id)
    .eq("user_email", session.user.email)
    .select()
    .single()

  if (upErr || !updated) return Response.json({ error: "Error al guardar" }, { status: 500 })

  return Response.json({ ok: true, bet: updated })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return Response.json({ error: "No autorizado" }, { status: 401 })

  const sb = createServiceClient()

  const { data: existing } = await sb
    .from("bets")
    .select("id, user_email")
    .eq("id", id)
    .single()

  if (!existing || existing.user_email !== session.user.email) {
    return Response.json({ error: "No encontrado" }, { status: 404 })
  }

  await sb.from("bet_legs").delete().eq("bet_id", id)
  await sb.from("bets").delete().eq("id", id)

  return Response.json({ ok: true })
}
