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

  const sb = createServiceClient()

  // Ensure the bet belongs to the requesting user
  const { data: existing } = await sb
    .from("bets")
    .select("id, user_email")
    .eq("id", params.id)
    .single()

  if (!existing || existing.user_email !== session.user.email) {
    return Response.json({ error: "No encontrado" }, { status: 404 })
  }

  const { data, error } = await sb
    .from("bets")
    .update({ status: body.status, settled_at: new Date().toISOString() })
    .eq("id", params.id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

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
