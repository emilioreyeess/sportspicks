/**
 * GET /api/admin/users  — Admin Dashboard data source (STEP 2)
 *
 * Devuelve la lista de usuarios (users_log) con:
 *   email, display name, registration date (first_sign_in),
 *   last login (last_sign_in), subscription tier (plan), total bets logged.
 *
 * Protegido por RBAC: solo admins (is_admin o ADMIN_EMAILS). Soporta ?q= para
 * filtrar por email y ?limit=.
 */
import { NextRequest } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { createServiceClient } from "@/lib/supabase/client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) {
    return Response.json({ error: "Forbidden" }, { status: gate.email ? 403 : 401 })
  }

  const url = new URL(req.url)
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase()
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") ?? "200") || 200, 1), 500)

  const sb = createServiceClient()

  let query = sb
    .from("users_log")
    .select("email, name, avatar_url, provider, plan, first_sign_in, last_sign_in, sign_in_count, is_admin")
    .order("last_sign_in", { ascending: false, nullsFirst: false })
    .limit(limit)

  if (q.length >= 1) {
    // Filtro por email (escape de comodines para evitar inyección de patrones)
    const safe = q.replace(/[%_]/g, (m) => `\\${m}`)
    query = query.ilike("email", `%${safe}%`)
  }

  const { data: users, error } = await query
  if (error) {
    console.error("[admin/users] query error:", error.message)
    return Response.json({ error: "DB error" }, { status: 500 })
  }

  const emails = (users ?? []).map((u) => u.email).filter(Boolean) as string[]

  // Conteo de apuestas por usuario (1 query para los emails de la página)
  const betCounts = new Map<string, number>()
  if (emails.length) {
    const { data: bets } = await sb
      .from("bets")
      .select("user_email")
      .in("user_email", emails)
    for (const b of bets ?? []) {
      const e = (b as any).user_email as string
      if (!e) continue
      betCounts.set(e, (betCounts.get(e) ?? 0) + 1)
    }
  }

  const rows = (users ?? []).map((u) => ({
    email: u.email,
    name: u.name ?? null,
    avatar_url: u.avatar_url ?? null,
    provider: u.provider ?? null,
    plan: (u.plan ?? "free") as string,
    registered_at: u.first_sign_in ?? null,
    last_login_at: u.last_sign_in ?? null,
    sign_in_count: u.sign_in_count ?? 0,
    is_admin: u.is_admin === true,
    total_bets: betCounts.get(u.email) ?? 0,
  }))

  return Response.json({ users: rows, count: rows.length })
}
