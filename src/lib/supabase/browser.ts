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
  _client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  )
  return _client
}
