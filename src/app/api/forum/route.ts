import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { createServiceClient } from "@/lib/supabase/client"
import { consume, getClientIp, tooManyRequests } from "@/lib/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return Response.json({ error: "No autorizado" }, { status: 401 })

  const sb = createServiceClient()
  const cursor = req.nextUrl.searchParams.get("cursor")
  const limit = 40

  let query = sb
    .from("forum_messages")
    .select("id, content, image_url, user_email, sender_name, sender_avatar, plan, is_verified_tipster, created_at")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (cursor) query = query.lt("created_at", cursor)

  const { data, error } = await query
  if (error) return Response.json({ error: "Error interno" }, { status: 500 })

  return Response.json({ messages: (data ?? []).reverse(), hasMore: (data?.length ?? 0) === limit })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return Response.json({ error: "No autorizado" }, { status: 401 })

  const ip = getClientIp(req)
  if (!consume(`forum:${ip}`, 10, 10)) return tooManyRequests(30)

  let body: { content?: string; image_url?: string }
  try { body = await req.json() } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 })
  }

  const content = body.content?.trim() ?? ""
  const imageUrl = body.image_url ?? null

  if (!content && !imageUrl) return Response.json({ error: "Mensaje vacío" }, { status: 400 })
  if (content.length > 1000) return Response.json({ error: "Mensaje demasiado largo (máx. 1000 caracteres)" }, { status: 400 })

  const sb = createServiceClient()
  const email = session.user.email

  // Get user profile
  const { data: user } = await sb
    .from("users_log")
    .select("name, avatar_url, is_vip_tipster")
    .eq("email", email)
    .single()

  // Get user plan from JWT
  const plan = (session.user as any)?.plan ?? "free"

  const { data: msg, error } = await sb
    .from("forum_messages")
    .insert({
      content: content || null,
      image_url: imageUrl,
      user_email: email,
      sender_name: user?.name ?? email.split("@")[0],
      sender_avatar: user?.avatar_url ?? null,
      plan,
      is_verified_tipster: user?.is_vip_tipster ?? false,
    })
    .select()
    .single()

  if (error) return Response.json({ error: "Error al publicar" }, { status: 500 })
  return Response.json({ ok: true, message: msg }, { status: 201 })
}
