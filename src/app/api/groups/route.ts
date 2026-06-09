import { NextRequest } from "next/server"
import { getServerSession } from "@/lib/auth-server"
import { createServiceClient } from "@/lib/supabase/client"
// CN-013: Use cryptographically secure PRNG for invite codes
import { randomBytes } from "crypto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function randomCode(len = 8): string {
  return randomBytes(len).toString("base64url").slice(0, len).toUpperCase()
}

export async function GET() {
  const session = await getServerSession()
  if (!session?.user?.email) return Response.json({ error: "No autorizado" }, { status: 401 })

  const sb = createServiceClient()
  const email = session.user.email

  // Single aggregated RPC: replaces 3+N queries (memberships + groups + N×count) with 1 JOIN.
  // RPC: get_user_groups — see phase1-indexes-migration.sql
  const { data: groups, error } = await sb
    .rpc("get_user_groups", { p_email: email })

  // CN-026: Return generic message — do not expose internal DB error details
  if (error) return Response.json({ error: "Error interno del servidor" }, { status: 500 })

  if (!groups?.length) return Response.json({ groups: [] })

  return Response.json({ groups })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession()
  if (!session?.user?.email) return Response.json({ error: "No autorizado" }, { status: 401 })

  let body: { name: string; emoji?: string }
  try { body = await req.json() } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 })
  }
  if (!body.name?.trim()) return Response.json({ error: "Nombre requerido" }, { status: 400 })

  const sb = createServiceClient()
  const email = session.user.email

  const inviteCode = randomCode(6)

  const { data: group, error } = await sb
    .from("friend_groups")
    .insert({
      name: body.name.trim(),
      emoji: body.emoji ?? "⚽",
      created_by: email,
      invite_code: inviteCode,
    })
    .select()
    .single()

  if (error || !group) return Response.json({ error: "Error al crear el grupo" }, { status: 500 })

  // Add creator as admin member
  await sb.from("group_members").insert({
    group_id: group.id,
    user_email: email,
    role: "admin",
  })

  return Response.json({ ok: true, group }, { status: 201 })
}
