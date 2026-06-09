/**
 * Shim de compatibilidad servidor: getServerSession()
 * ───────────────────────────────────────────────────────────────────────────
 * Reemplaza a `getServerSession(authOptions)` de NextAuth con la sesión nativa
 * de Supabase Auth, devolviendo EXACTAMENTE la misma forma que consumían las
 * rutas: `{ user: { email, name, image } } | null`.
 *
 * Así el cuerpo de cada ruta (`session?.user?.email`) NO cambia — solo el motor.
 *
 * Usa getUser() (no getSession()) porque getUser() revalida el JWT contra el
 * servidor de Auth: es la fuente fiable en el servidor.
 */
import { createServerSupabase } from "@/lib/supabase/server"

export interface CompatSession {
  user: {
    email: string
    name: string | null
    image: string | null
  }
}

export async function getServerSession(): Promise<CompatSession | null> {
  try {
    const sb = await createServerSupabase()
    const { data, error } = await sb.auth.getUser()
    const user = data?.user
    if (error || !user?.email) return null
    const meta = (user.user_metadata ?? {}) as Record<string, any>
    return {
      user: {
        email: user.email,
        name: meta.full_name ?? meta.name ?? null,
        image: meta.avatar_url ?? meta.picture ?? null,
      },
    }
  } catch {
    return null
  }
}
