import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { createServiceClient } from "@/lib/supabase/client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return Response.json({ error: "No autorizado" }, { status: 401 })

  const sb = createServiceClient()
  const email = session.user.email

  const { data: bets, error } = await sb
    .from("bets")
    .select("*, bet_legs(*)")
    .eq("user_email", email)
    .order("created_at", { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Compute stats
  const settled = (bets ?? []).filter((b) => b.status === "won" || b.status === "lost")
  const won = settled.filter((b) => b.status === "won")
  const totalStaked = settled.reduce((s, b) => s + (b.stake ?? 0), 0)
  const totalReturn = won.reduce((s, b) => s + (b.stake ?? 0) * (b.combined_odds ?? 1), 0)
  const profit = totalReturn - totalStaked
  const winrate = settled.length ? (won.length / settled.length) * 100 : 0
  const yield_ = totalStaked ? (profit / totalStaked) * 100 : 0

  return Response.json({
    bets: bets ?? [],
    stats: {
      total: bets?.length ?? 0,
      settled: settled.length,
      won: won.length,
      winrate: Math.round(winrate * 10) / 10,
      yield: Math.round(yield_ * 10) / 10,
      profit: Math.round(profit * 100) / 100,
    },
  })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return Response.json({ error: "No autorizado" }, { status: 401 })

  let body: {
    title: string
    stake: number
    combined_odds: number
    legs: { match: string; selection: string; odds: number }[]
    sport?: string
    notes?: string
  }
  try { body = await req.json() } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 })
  }

  const sb = createServiceClient()
  const email = session.user.email

  const { data: bet, error: betErr } = await sb
    .from("bets")
    .insert({
      user_email: email,
      title: body.title,
      stake: body.stake,
      combined_odds: body.combined_odds,
      sport: body.sport ?? "football",
      notes: body.notes ?? null,
      status: "pending",
    })
    .select()
    .single()

  if (betErr || !bet) return Response.json({ error: betErr?.message ?? "Error al crear apuesta" }, { status: 500 })

  if (body.legs?.length) {
    const legs = body.legs.map((l) => ({
      bet_id: bet.id,
      match: l.match,
      selection: l.selection,
      odds: l.odds,
      status: "pending",
    }))
    const { error: legErr } = await sb.from("bet_legs").insert(legs)
    if (legErr) console.error("[bets] leg insert error:", legErr.message)
  }

  return Response.json({ ok: true, bet }, { status: 201 })
}
