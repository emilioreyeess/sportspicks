/**
 * Refresco de la sesión de Supabase en el middleware (@supabase/ssr).
 *
 * Llama a getUser() para revalidar/renovar el JWT y reescribe las cookies de
 * sesión en la respuesta. Se integra con la respuesta que ya lleva los headers
 * de seguridad: fija las cookies sobre ESE mismo objeto y lo devuelve.
 */
import { type NextRequest, type NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"

export async function updateSession(
  request: NextRequest,
  response: NextResponse,
): Promise<NextResponse> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) return response

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        )
      },
    },
  })

  // Revalida el JWT y dispara el refresco de cookies si procede.
  await supabase.auth.getUser()
  return response
}
