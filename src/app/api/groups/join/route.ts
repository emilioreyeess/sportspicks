import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { createServiceClient } from "@/lib/supabase/client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return Response.json({ error: "No autorizado" }, { status: 401 })

  let body: { invite_code: string }
  try { body = await req.json() } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 })
  }
  if (!body.invite_code?.trim()) return Response.json({ error: "Código requerido" }, { status: 400 })

  const sb = createServiceClient()
  const email = session.user.email

  const { data: group } = await sb
    .from("friend_groups")
    .select("id, name, emoji")
    .eq("invite_code", body.invite_code.trim().toUpperCase())
    .single()

  if (!group) return Response.json({ error: "Código no válido" }, { status: 404 })

  // Check already a member
  const { data: existing } = await sb
    .from("group_members")
    .select("id")
    .eq("group_id", group.id)
    .eq("user_email", email)
    .single()

  if (existing) return Response.json({ error: "Ya eres miembro de este grupo" }, { status: 409 })

  const { error } = await sb.from("group_members").insert({
    group_id: group.id,
    user_email: email,
    role: "member",
  })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true, group })
}
