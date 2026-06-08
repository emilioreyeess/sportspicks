/**
 * GET /auth/callback
 * ───────────────────────────────────────────────────────────────────────────
 * Endpoint de retorno de Supabase Auth (Google OAuth y confirmación de email).
 * Intercambia el `code` por una sesión y fija las cookies (@supabase/ssr).
 * Luego sincroniza users_log (igual que hacía NextAuth) para no romper los
 * checks de admin ni los plan-grants, que están keyed por email.
 */
import { NextRequest, NextResponse } from "next/server"
import { createServerSupabase } from "@/lib/supabase/server"
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
  const next = searchParams.get("next") ?? "/"
  // Solo rutas internas (evita open-redirect).
  const safeNext = next.startsWith("/") ? next : "/"

  if (!code) {
    return NextResponse.redirect(`${origin}/?auth_error=missing_code`)
  }

  const supabase = await createServerSupabase()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error("[auth/callback] exchange falló:", error.message)
    return NextResponse.redirect(`${origin}/?auth_error=exchange`)
  }

  if (data?.user) await syncUsersLog(data.user as any)

  return NextResponse.redirect(`${origin}${safeNext}`)
}
