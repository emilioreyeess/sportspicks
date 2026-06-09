/**
 * GET /auth/callback
 * ───────────────────────────────────────────────────────────────────────────
 * Endpoint de retorno de Supabase Auth (Google OAuth y confirmación de email).
 * Intercambia el `code` por una sesión y fija las cookies (@supabase/ssr).
 * Luego sincroniza users_log (igual que hacía NextAuth) para no romper los
 * checks de admin ni los plan-grants, que están keyed por email.
 *
 * CLAVE: las cookies de sesión se escriben sobre la MISMA NextResponse que
 * devolvemos (la redirección). Si se escriben en el store de next/headers y
 * luego devolvemos un NextResponse.redirect() nuevo, las cookies NO viajan y
 * la sesión se pierde silenciosamente.
 */
import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { createServiceClient } from "@/lib/supabase/client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Sincroniza users_log por email (best-effort, no bloquea el login). */
async function syncUsersLog(user: {
  email?: string | null
  user_metadata?: Record<string, any> | null
  app_metadata?: Record<string, any> | null
}) {
  if (!user.email) return
  try {
    const sb = createServiceClient()
    const meta = user.user_metadata ?? {}
    await sb.from("users_log").upsert(
      {
        email: user.email,
        name: meta.full_name ?? meta.name ?? null,
        avatar_url: meta.avatar_url ?? meta.picture ?? null,
        provider: user.app_metadata?.provider ?? "google",
        last_sign_in: new Date().toISOString(),
      },
      { onConflict: "email", ignoreDuplicates: false },
    )
  } catch (e) {
    console.error("[auth/callback] users_log sync falló:", e instanceof Error ? e.message : e)
  }
}

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url)
  const code = searchParams.get("code")
  const oauthError = searchParams.get("error")
  const oauthErrorDesc = searchParams.get("error_description")
  const next = searchParams.get("next") ?? "/"
  const safeNext = next.startsWith("/") ? next : "/" // evita open-redirect

  const fail = (reason: string, desc?: string | null) => {
    const u = new URL(`${origin}/auth/signin`)
    u.searchParams.set("error", "callback_failed")
    u.searchParams.set("reason", reason)
    if (desc) u.searchParams.set("desc", desc)
    return NextResponse.redirect(u.toString())
  }

  // 1. ¿Supabase/Google devolvió un error en la propia URL? (p.ej. server_error
  //    "Unable to exchange external code" → Client Secret de Google mal en Supabase)
  if (oauthError) {
    console.error("[auth/callback] proveedor devolvió error:", oauthError, "—", oauthErrorDesc)
    return fail("provider", `${oauthError}: ${oauthErrorDesc ?? ""}`.trim())
  }

  // 2. Sin code no hay nada que intercambiar.
  if (!code) {
    console.error("[auth/callback] falta el parámetro `code` en el retorno")
    return fail("missing_code")
  }

  // 3. Env del cliente SSR (en Preview deben existir en runtime de servidor).
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) {
    console.error(
      "[auth/callback] FALTAN env del servidor — NEXT_PUBLIC_SUPABASE_URL:",
      !!url,
      "ANON_KEY:",
      !!anon,
    )
    return fail("missing_env")
  }

  // 4. Respuesta de éxito (redirección). Las cookies de sesión se fijan AQUÍ.
  const successRes = NextResponse.redirect(`${origin}${safeNext}`)

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return req.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          successRes.cookies.set(name, value, options),
        )
      },
    },
  })

  // Diagnóstico: ¿llegó la cookie del code_verifier (PKCE)? Su ausencia es la
  // causa #1 de "both auth code and code verifier should be non-empty".
  const hasVerifier = req.cookies
    .getAll()
    .some((c) => c.name.includes("code-verifier") || c.name.includes("auth-token-code-verifier"))
  console.log(
    "[auth/callback] code recibido; cookie code_verifier presente:",
    hasVerifier,
    "| cookies:",
    req.cookies.getAll().map((c) => c.name).join(","),
  )

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error("[auth/callback] exchangeCodeForSession FALLÓ:", {
      message: error.message,
      status: (error as any).status,
      name: error.name,
      hasVerifier,
    })
    return fail("exchange")
  }

  console.log("[auth/callback] exchange OK — usuario:", data?.user?.email ?? "(sin email)")
  if (data?.user) await syncUsersLog(data.user as any)

  return successRes // ← lleva las cookies de sesión
}
