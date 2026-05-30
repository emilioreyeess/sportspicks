import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { createServiceClient } from "@/lib/supabase/client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return Response.json({ error: "No autorizado" }, { status: 401 })

  const sb = createServiceClient()

  // Verify requester is a member of this group
  const { data: membership } = await sb
    .from("group_members")
    .select("id")
    .eq("group_id", id)
    .eq("user_email", session.user.email)
    .single()

  if (!membership) return Response.json({ error: "No eres miembro" }, { status: 403 })

  // Get all members
  const { data: members, error } = await sb
    .from("group_members")
    .select("user_email, role, joined_at")
    .eq("group_id", id)
    .order("joined_at", { ascending: true })

  if (error) return Response.json({ error: "Error interno" }, { status: 500 })
  if (!members?.length) return Response.json({ members: [] })

  const emails = members.map((m) => m.user_email)

  // Enrich with user profile data
  const { data: users } = await sb
    .from("users_log")
    .select("email, name, avatar_url")
    .in("email", emails)

  const userMap = new Map((users ?? []).map((u) => [u.email, u]))

  const enriched = members.map((m) => {
    const u = userMap.get(m.user_email)
    return {
      email: m.user_email,
      name: u?.name ?? m.user_email.split("@")[0],
      avatar_url: u?.avatar_url ?? null,
      role: m.role,
      joined_at: m.joined_at,
    }
  })

  return Response.json({ members: enriched })
}
