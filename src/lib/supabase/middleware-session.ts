/**
 * Refresco de la sesión de Supabase en el middleware — PATRÓN OFICIAL @supabase/ssr.
 *
 * Clave anti-fuga de sesión:
 *   1. La respuesta se crea con NextResponse.next({ request }) para propagar las
 *      cookies actualizadas a los Server Components del mismo render.
 *   2. En setAll se RECREA supabaseResponse con NextResponse.next({ request }) y se
 *      copian las cookies. Si no se recrea, el token refrescado NO persiste y el
 *      usuario "pierde la sesión" en la siguiente petición.
 *   3. NO debe haber lógica entre createServerClient y supabase.auth.getUser().
 *   4. Hay que devolver EXACTAMENTE supabaseResponse (con sus cookies intactas).
 *
 * Los headers de seguridad se aplican sobre esa misma respuesta final.
 */
import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"

function applySecurityHeaders(res: NextResponse) {
  res.headers.set("X-Content-Type-Options", "nosniff")
  res.headers.set("X-Frame-Options", "DENY")
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()")
  res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")
  res.headers.set("X-DNS-Prefetch-Control", "off")
  res.headers.set("X-Permitted-Cross-Domain-Policies", "none")
  // CN-015: el CSP vive solo en next.config.js headers() para evitar duplicados.
}

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let supabaseResponse = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (url && anon) {
    const supabase = createServerClient(url, anon, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    })

    // IMPORTANTE: nada de lógica entre createServerClient y getUser().
    // getUser() revalida/renueva el JWT y dispara setAll si toca refrescar.
    // try/catch: un fallo transitorio hacia Supabase Auth NO debe tumbar la
    // request entera (antes provocaba 500 en cada página → "desconexiones").
    try {
      await supabase.auth.getUser()
    } catch {
      // Error transitorio — devolvemos la respuesta sin romper la navegación.
    }
  }

  applySecurityHeaders(supabaseResponse)
  return supabaseResponse
}
