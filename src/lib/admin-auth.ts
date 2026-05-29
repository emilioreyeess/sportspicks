/**
 * RBAC de administración — SportsPicks Analytics (STEP 2)
 *
 * Una cuenta es admin si:
 *   1. `users_log.is_admin = true` para su email (fuente de verdad en DB), o
 *   2. su email está en la env allowlist `ADMIN_EMAILS` (bootstrap / fallback).
 *
 * La comprobación SIEMPRE se hace en el servidor con el service-role client.
 * Nunca confiar en un flag de cliente.
 */
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { createServiceClient } from "@/lib/supabase/client"

/** Allowlist de emails admin desde env (separados por coma). */
function envAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

/** ¿Este email es admin? Comprueba env allowlist y luego la columna is_admin. */
export async function isAdminEmail(email: string | null | undefined): Promise<boolean> {
  if (!email) return false
  const lower = email.toLowerCase().trim()

  if (envAdminEmails().includes(lower)) return true

  try {
    const sb = createServiceClient()
    const { data, error } = await sb
      .from("users_log")
      .select("is_admin")
      .eq("email", lower)
      .maybeSingle()
    if (error) {
      console.warn("[admin-auth] is_admin lookup error:", error.message)
      return false
    }
    return data?.is_admin === true
  } catch (e: any) {
    console.warn("[admin-auth] isAdminEmail failed:", e?.message ?? e)
    return false
  }
}

export interface AdminGate {
  ok: boolean
  email: string | null
}

/**
 * Resuelve la sesión y comprueba admin. Para uso en route handlers
 * (`/api/admin/*`). No redirige; devuelve {ok,email} para que la ruta
 * decida el status code.
 */
export async function requireAdmin(): Promise<AdminGate> {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email ?? null
  if (!email) return { ok: false, email: null }
  const ok = await isAdminEmail(email)
  return { ok, email }
}
