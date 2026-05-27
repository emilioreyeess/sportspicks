import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { createServiceClient } from "@/lib/supabase/client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return Response.json({ error: "No autorizado" }, { status: 401 })

  let body: { status: "won" | "lost" | "void" }
  try { body = await req.json() } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 })
  }

  const validStatuses = ["won", "lost", "void"]
  if (!validStatuses.includes(body.status)) {
    return Response.json({ error: "Estado inválido" }, { status: 400 })
  }

  // Validate UUID format for params.id
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id)) {
    return Response.json({ error: "ID inválido" }, { status: 400 })
  }

  const sb = createServiceClient()

  // SECURITY + RACE CONDITION FIX: atomic update with ownership + status check in one query
  // Only update if user_email matches AND status is still "pending" (prevent double-settlement)
  const { data, error } = await sb
    .from("bets")
    .update({ status: body.status, settled_at: new Date().toISOString() })
    .eq("id", params.id)
    .eq("user_email", session.user.email)
    .eq("status", "pending")   // ← prevents re-settling already settled bets
    .select()
    .single()

  if (error || !data) {
    // Could be not found OR already settled — check which
    const { data: existing } = await sb
      .from("bets")
      .select("id, user_email, status")
      .eq("id", params.id)
      .single()
    if (!existing || existing.user_email !== session.user.email) {
      return Response.json({ error: "No encontrado" }, { status: 404 })
    }
    if (existing.status !== "pending") {
      return Response.json({ error: "Esta apuesta ya fue liquidada" }, { status: 409 })
    }
    return Response.json({ error: error?.message ?? "Error al actualizar" }, { status: 500 })
  }

  // Also settle all legs with the same status
  await sb.from("bet_legs").update({ status: body.status }).eq("bet_id", params.id)

  return Response.json({ ok: true, bet: data })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return Response.json({ error: "No autorizado" }, { status: 401 })

  const sb = createServiceClient()

  const { data: existing } = await sb
    .from("bets")
    .select("id, user_email")
    .eq("id", params.id)
    .single()

  if (!existing || existing.user_email !== session.user.email) {
    return Response.json({ error: "No encontrado" }, { status: 404 })
  }

  await sb.from("bet_legs").delete().eq("bet_id", params.id)
  await sb.from("bets").delete().eq("id", params.id)

  return Response.json({ ok: true })
}
