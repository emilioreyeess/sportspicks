/**
 * Cliente Supabase SSR para el SERVIDOR (Server Components y Route Handlers).
 *
 * Usa @supabase/ssr + las cookies de next/headers para leer la sesión nativa de
 * Supabase Auth (auth.users). Sustituye a getServerSession de NextAuth.
 *
 * Nota: en Server Components las cookies son read-only → setAll lanza, por eso
 * va envuelto en try/catch. El refresco real de cookies lo hace el middleware
 * (lib/supabase/middleware-session.ts).
 */
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"

export async function createServerSupabase() {
  const cookieStore = await cookies()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""

  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          )
        } catch {
          // Llamado desde un Server Component (cookies read-only). El middleware
          // se encarga de refrescar la sesión, así que es seguro ignorarlo.
        }
      },
    },
  })
}
