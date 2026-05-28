import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { createServiceClient } from "@/lib/supabase/client"
import { scryptSync, randomBytes, timingSafeEqual } from "crypto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function hashPassword(password: string): { hash: string; salt: string } {
  const salt = randomBytes(16).toString("hex")
  const hash = scryptSync(password, salt, 64).toString("hex")
  return { hash, salt }
}

function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const derived = scryptSync(password, salt, 64)
    return timingSafeEqual(derived, Buffer.from(hash, "hex"))
  } catch { return false }
}

/** GET /api/account/profile — returns stored display name */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return Response.json({ error: "No autorizado" }, { status: 401 })

  const sb = createServiceClient()
  const { data } = await sb
    .from("users_log")
    .select("name, avatar_url, created_at")
    .eq("email", session.user.email)
    .single()

  return Response.json({ name: data?.name ?? null, avatar_url: data?.avatar_url ?? null, created_at: data?.created_at ?? null })
}

/** PATCH /api/account/profile — update display name */
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return Response.json({ error: "No autorizado" }, { status: 401 })

  let body: { name?: string; currentPassword?: string; newPassword?: string }
  try { body = await req.json() } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 })
  }

  const sb = createServiceClient()
  const email = session.user.email

  // ── Change name ─────────────────────────────────────────────────────────
  if (body.name !== undefined) {
    const name = body.name.trim()
    if (!name || name.length > 50) {
      return Response.json({ error: "Nombre inválido (máx. 50 caracteres)" }, { status: 400 })
    }
    const { error } = await sb
      .from("users_log")
      .update({ name })
      .eq("email", email)
    if (error) return Response.json({ error: "Error al guardar el nombre" }, { status: 500 })
    return Response.json({ ok: true })
  }

  // ── Change password ──────────────────────────────────────────────────────
  if (body.currentPassword !== undefined && body.newPassword !== undefined) {
    if (!body.newPassword || body.newPassword.length < 8) {
      return Response.json({ error: "La nueva contraseña debe tener al menos 8 caracteres" }, { status: 400 })
    }

    const { data: user } = await sb
      .from("users_log")
      .select("password_hash, password_salt, provider")
      .eq("email", email)
      .single()

    if (!user) return Response.json({ error: "Usuario no encontrado" }, { status: 404 })

    // Users authenticated via Google cannot set a password this way
    if (user.provider !== "credentials") {
      return Response.json({ error: "Tu cuenta usa inicio de sesión con Google. Cambia la contraseña desde tu cuenta Google." }, { status: 400 })
    }

    if (!user.password_hash || !user.password_salt) {
      return Response.json({ error: "No hay contraseña configurada en esta cuenta" }, { status: 400 })
    }

    if (!verifyPassword(body.currentPassword, user.password_hash, user.password_salt)) {
      return Response.json({ error: "Contraseña actual incorrecta" }, { status: 401 })
    }

    const { hash, salt } = hashPassword(body.newPassword)
    const { error } = await sb
      .from("users_log")
      .update({ password_hash: hash, password_salt: salt })
      .eq("email", email)

    if (error) return Response.json({ error: "Error al actualizar la contraseña" }, { status: 500 })
    return Response.json({ ok: true })
  }

  return Response.json({ error: "Nada que actualizar" }, { status: 400 })
}
