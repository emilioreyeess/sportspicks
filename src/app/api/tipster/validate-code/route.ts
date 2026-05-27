import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { createServiceClient } from "@/lib/supabase/client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return Response.json({ error: "No autorizado" }, { status: 401 })

  let body: { code: string }
  try { body = await req.json() } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 })
  }
  const code = body.code?.trim().toUpperCase()
  if (!code) return Response.json({ error: "Código requerido" }, { status: 400 })

  const sb = createServiceClient()
  const email = session.user.email

  const { data: vip } = await sb
    .from("vip_access_codes")
    .select("id, granted_to, used_at, expires_at, is_active")
    .eq("code", code)
    .single()

  if (!vip) return Response.json({ error: "Código inválido" }, { status: 404 })
  if (!vip.is_active) return Response.json({ error: "Código desactivado" }, { status: 403 })
  if (vip.expires_at && new Date(vip.expires_at) < new Date()) {
    return Response.json({ error: "Código expirado" }, { status: 403 })
  }
  // Allow re-use by the same email that already claimed it
  if (vip.used_at && vip.granted_to && vip.granted_to !== email) {
    return Response.json({ error: "Código ya utilizado por otra cuenta" }, { status: 409 })
  }

  // Mark as used if not already
  if (!vip.used_at) {
    await sb.from("vip_access_codes").update({
      granted_to: email,
      used_at: new Date().toISOString(),
    }).eq("id", vip.id)

    // Also set is_vip_tipster on the user
    await sb.from("users_log").update({ is_vip_tipster: true }).eq("email", email)
  }

  return Response.json({ ok: true })
}
