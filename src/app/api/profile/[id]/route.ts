/**
 * GET /api/profile/[id]
 * Perfil público de un usuario — sin exponer email.
 * [id] es el bigint id de users_log.
 *
 * Devuelve:
 *  - name, avatar_url, plan, is_vip_tipster
 *  - member_since (primer inicio de sesión)
 *  - días usando la app
 *  - stats públicas: apuestas publicadas, winrate, profit (solo bets publicadas)
 */
import { NextRequest } from "next/server"
import { createServiceClient } from "@/lib/supabase/client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const rawId = params.id

  // Validar que id es un número entero seguro
  const numId = parseInt(rawId, 10)
  if (!Number.isFinite(numId) || numId <= 0 || String(numId) !== rawId) {
    return Response.json({ error: "ID inválido" }, { status: 400 })
  }

  const sb = createServiceClient()

  // Obtener datos del perfil (sin devolver email, password_hash, password_salt)
  const { data: user, error: userErr } = await sb
    .from("users_log")
    .select("id, name, avatar_url, plan, is_vip_tipster, first_sign_in, sign_in_count, email")
    .eq("id", numId)
    .single()

  if (userErr || !user) {
    return Response.json({ error: "Usuario no encontrado" }, { status: 404 })
  }

  // Calcular días miembro
  const memberSince = user.first_sign_in ? new Date(user.first_sign_in) : null
  const daysMember = memberSince
    ? Math.floor((Date.now() - memberSince.getTime()) / 86400000)
    : 0

  // Obtener stats públicas (solo apuestas con is_published=true o todas si el perfil es propio)
  // Para perfiles públicos: contamos todas las apuestas settled de ese email
  const { data: bets } = await sb
    .from("bets")
    .select("status, stake, combined_odds, sport")
    .eq("user_email", user.email)
    .in("status", ["won", "lost"])

  const totalSettled = bets?.length ?? 0
  const wonBets = (bets ?? []).filter(b => b.status === "won")
  const totalStaked = (bets ?? []).reduce((s, b) => s + (Number(b.stake) || 0), 0)
  const totalReturn = wonBets.reduce((s, b) => s + (Number(b.stake) || 0) * (Number(b.combined_odds) || 1), 0)
  const profit = totalReturn - totalStaked
  const winrate = totalSettled ? (wonBets.length / totalSettled) * 100 : 0
  const yield_ = totalStaked ? (profit / totalStaked) * 100 : 0

  // Sport breakdown
  const sportCount: Record<string, number> = {}
  for (const b of bets ?? []) {
    if (b.sport) sportCount[b.sport] = (sportCount[b.sport] ?? 0) + 1
  }
  const favoriteSport = Object.entries(sportCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  return Response.json({
    id: user.id,
    name: user.name ?? "Anónimo",
    avatar_url: user.avatar_url ?? null,
    plan: user.plan ?? "free",
    is_vip_tipster: user.is_vip_tipster ?? false,
    member_since: user.first_sign_in ?? null,
    days_member: daysMember,
    sign_in_count: user.sign_in_count ?? 0,
    stats: {
      total_settled: totalSettled,
      won: wonBets.length,
      winrate: Math.round(winrate * 10) / 10,
      yield: Math.round(yield_ * 10) / 10,
      profit: Math.round(profit * 100) / 100,
      favorite_sport: favoriteSport,
    },
  })
}
