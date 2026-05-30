import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { createServiceClient } from "@/lib/supabase/client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function assertMember(sb: ReturnType<typeof import("@/lib/supabase/client").createServiceClient>, groupId: string, email: string) {
  const { data } = await sb
    .from("group_members")
    .select("id")
    .eq("group_id", groupId)
    .eq("user_email", email)
    .single()
  return !!data
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return Response.json({ error: "No autorizado" }, { status: 401 })

  const sb = createServiceClient()
  const isMember = await assertMember(sb, id, session.user.email)
  if (!isMember) return Response.json({ error: "No eres miembro" }, { status: 403 })

  const { data: messages, error } = await sb
    .from("group_messages")
    .select("*")
    .eq("group_id", id)
    .order("created_at", { ascending: true })
    .limit(100)

  // CN-026: Return generic message — do not expose internal DB error details
  if (error) return Response.json({ error: "Error interno del servidor" }, { status: 500 })
  return Response.json({ messages: messages ?? [] })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return Response.json({ error: "No autorizado" }, { status: 401 })

  let body: { content: string; bet_id?: string }
  try { body = await req.json() } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 })
  }
  if (!body.content?.trim()) return Response.json({ error: "Mensaje vacío" }, { status: 400 })

  const sb = createServiceClient()
  const email = session.user.email

  const isMember = await assertMember(sb, id, email)
  if (!isMember) return Response.json({ error: "No eres miembro" }, { status: 403 })

  const { data: message, error } = await sb
    .from("group_messages")
    .insert({
      group_id: id,
      user_email: email,
      content: body.content.trim(),
      bet_id: body.bet_id ?? null,
      sender_name: session.user.name ?? email,
      sender_avatar: session.user.image ?? null,
    })
    .select()
    .single()

  // CN-026: Return generic message — do not expose internal DB error details
  if (error) return Response.json({ error: "Error interno del servidor" }, { status: 500 })
  return Response.json({ ok: true, message }, { status: 201 })
}
