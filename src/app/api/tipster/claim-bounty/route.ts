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
  const { data: bounties, error } = await sb
    .from("tipster_bounties")
    .select("*, bets(title, combined_odds, status)")
    .eq("tipster_email", session.user.email)
    .order("submitted_at", { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ bounties: bounties ?? [] })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return Response.json({ error: "No autorizado" }, { status: 401 })

  let body: { twitter_url: string; bet_id?: string }
  try { body = await req.json() } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 })
  }
  if (!body.twitter_url?.trim()) return Response.json({ error: "URL de tweet requerida" }, { status: 400 })

  const sb = createServiceClient()
  const email = session.user.email

  // If a bet_id provided, verify it belongs to user and odds > 3.00
  if (body.bet_id) {
    const { data: bet } = await sb
      .from("bets")
      .select("id, user_email, combined_odds, status")
      .eq("id", body.bet_id)
      .single()

    if (!bet || bet.user_email !== email) {
      return Response.json({ error: "Apuesta no encontrada" }, { status: 404 })
    }
    if ((bet.combined_odds ?? 0) < 3) {
      return Response.json({ error: "La cuota debe ser mayor de @3.00" }, { status: 422 })
    }
    if (bet.status !== "won") {
      return Response.json({ error: "Solo se pueden reclamar apuestas ganadas" }, { status: 422 })
    }
  }

  // Check for duplicate twitter URL
  const { data: existing } = await sb
    .from("tipster_bounties")
    .select("id")
    .eq("twitter_url", body.twitter_url.trim())
    .single()

  if (existing) return Response.json({ error: "Este tweet ya fue reclamado" }, { status: 409 })

  const { data, error } = await sb
    .from("tipster_bounties")
    .insert({
      tipster_email: email,
      bet_id: body.bet_id ?? null,
      twitter_url: body.twitter_url.trim(),
      status: "pending",
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, bounty: data }, { status: 201 })
}
