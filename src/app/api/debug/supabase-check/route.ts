/**
 * GET /api/debug/supabase-check
 * Diagnóstico temporal — eliminar después de confirmar que users_log funciona
 */
export const runtime = "nodejs"

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    return Response.json({
      ok: false,
      error: "Missing env vars",
      hasUrl: !!url,
      hasKey: !!key,
    }, { status: 500 })
  }

  try {
    const { createClient } = await import("@supabase/supabase-js")
    const sb = createClient(url, key, { auth: { persistSession: false } })

    const { error } = await sb.from("users_log").upsert({
      email: "debug@test.com",
      name: "Debug Test",
      avatar_url: null,
      provider: "debug",
      last_sign_in: new Date().toISOString(),
    }, { onConflict: "email", ignoreDuplicates: false })

    if (error) {
      return Response.json({ ok: false, error: error.message, code: error.code }, { status: 500 })
    }

    return Response.json({ ok: true, message: "Upsert OK — check users_log for debug@test.com" })
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 })
  }
}
