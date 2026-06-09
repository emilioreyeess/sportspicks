import { NextRequest } from "next/server"
import { getServerSession } from "@/lib/auth-server"
import { createServiceClient } from "@/lib/supabase/client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession()
  if (!session?.user?.email) return Response.json({ error: "No autorizado" }, { status: 401 })

  const sb = createServiceClient()

  // Verify membership
  const { data: membership } = await sb
    .from("group_members")
    .select("id")
    .eq("group_id", id)
    .eq("user_email", session.user.email)
    .single()

  if (!membership) return Response.json({ error: "No eres miembro" }, { status: 403 })

  // Get all members
  const { data: members } = await sb
    .from("group_members")
    .select("user_email, role, joined_at")
    .eq("group_id", id)

  if (!members?.length) return Response.json({ ranking: [] })

  const emails = members.map((m) => m.user_email)

  // PUNTO 3: el ranking cuenta SOLO los picks COMPARTIDOS A ESTE GRUPO
  // (group_bets, filtrado estricto por group_id). El historial global del
  // usuario NO se filtra hacia el grupo → un grupo nace en blanco.
  const { data: shared } = await sb
    .from("group_bets")
    .select(`user_email, bets ( stake, combined_odds, status )`)
    .eq("group_id", id)

  const bets: Array<{ user_email: string; stake: number | null; combined_odds: number | null; status: string }> =
    (shared ?? [])
      .map((gb: any) => {
        const b = Array.isArray(gb.bets) ? gb.bets[0] : gb.bets
        return {
          user_email: gb.user_email as string,
          stake: b?.stake ?? null,
          combined_odds: b?.combined_odds ?? null,
          status: String(b?.status ?? ""),
        }
      })
      .filter((b) => b.status === "won" || b.status === "lost")

  // Get user display names from users_log
  const { data: users } = await sb
    .from("users_log")
    .select("email, name, avatar_url")
    .in("email", emails)

  const userMap = new Map((users ?? []).map((u) => [u.email, u]))

  // Compute per-member stats
  const ranking = members.map((member) => {
    const memberBets = (bets ?? []).filter((b) => b.user_email === member.user_email)
    const won = memberBets.filter((b) => b.status === "won")
    const totalStaked = memberBets.reduce((s, b) => s + (b.stake ?? 0), 0)
    const totalReturn = won.reduce((s, b) => s + (b.stake ?? 0) * (b.combined_odds ?? 1), 0)
    const profit = totalReturn - totalStaked
    const winrate = memberBets.length ? (won.length / memberBets.length) * 100 : 0
    const yield_ = totalStaked ? (profit / totalStaked) * 100 : 0
    const u = userMap.get(member.user_email)
    return {
      email: member.user_email,
      name: u?.name ?? member.user_email.split("@")[0],
      avatar_url: u?.avatar_url ?? null,
      role: member.role,
      picks: memberBets.length,
      won: won.length,
      winrate: Math.round(winrate * 10) / 10,
      yield: Math.round(yield_ * 10) / 10,
      profit: Math.round(profit * 100) / 100,
    }
  })

  // Sort by yield descending, then by winrate
  ranking.sort((a, b) => b.yield - a.yield || b.winrate - a.winrate)

  return Response.json({ ranking })
}
