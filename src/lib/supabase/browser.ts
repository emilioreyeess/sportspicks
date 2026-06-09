/**
 * Cliente Supabase SSR para el NAVEGADOR (Client Components).
 *
 * Lee/escribe la sesión vía cookies compartidas con el servidor (@supabase/ssr).
 * Singleton por pestaña para no recrear el cliente en cada render.
 */
"use client"
import { createBrowserClient } from "@supabase/ssr"

let _client: ReturnType<typeof createBrowserClient> | null = null

export function createBrowserSupabase() {
  if (_client) return _client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) {
    // Si faltan en el bundle (no inyectadas en build), el OAuth fallaría en
    // silencio. Lo hacemos explícito en consola.
    console.error(
      "[supabase] Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY en el cliente",
    )
  }
  _client = createBrowserClient(url ?? "", anon ?? "")
  return _client
}
