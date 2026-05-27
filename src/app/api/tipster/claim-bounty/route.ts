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

  const twitterUrl = body.twitter_url?.trim() ?? ""
  if (!twitterUrl) return Response.json({ error: "URL de tweet requerida" }, { status: 400 })
  // Basic URL format validation to prevent arbitrary string injection
  if (twitterUrl.length > 500) return Response.json({ error: "URL demasiado larga" }, { status: 400 })
  if (!/^https?:\/\/(twitter\.com|x\.com)\/.+/i.test(twitterUrl)) {
    return Response.json({ error: "URL debe ser de twitter.com o x.com" }, { status: 422 })
  }

  // bet_id must be a valid UUID if provided
  if (body.bet_id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.bet_id)) {
    return Response.json({ error: "bet_id inválido" }, { status: 400 })
  }

  const sb = createServiceClient()
  const email = session.user.email

  // SECURITY FIX: Verificar que el usuario es VIP tipster antes de permitir reclamación
  const { data: userLog } = await sb
    .from("users_log")
    .select("is_vip_tipster")
    .eq("email", email)
    .single()

  if (!userLog?.is_vip_tipster) {
    return Response.json({ error: "Solo los tipsters VIP pueden reclamar bounties" }, { status: 403 })
  }

  // SECURITY FIX: bet_id es OBLIGATORIO para reclamar (no puede ser null)
  if (!body.bet_id) {
    return Response.json({ error: "Debes vincular una apuesta ganadora para reclamar el bounty" }, { status: 400 })
  }

  // Verify bet belongs to user, odds > 3.00 and is won
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

  // Check for duplicate twitter URL
  const { data: existing } = await sb
    .from("tipster_bounties")
    .select("id")
    .eq("twitter_url", twitterUrl)
    .single()

  if (existing) return Response.json({ error: "Este tweet ya fue reclamado" }, { status: 409 })

  // Check for duplicate bet_id claim (one claim per winning bet)
  const { data: dupBet } = await sb
    .from("tipster_bounties")
    .select("id")
    .eq("bet_id", body.bet_id)
    .single()

  if (dupBet) return Response.json({ error: "Esta apuesta ya tiene un bounty reclamado" }, { status: 409 })

  const { data, error } = await sb
    .from("tipster_bounties")
    .insert({
      tipster_email: email,
      bet_id: body.bet_id,
      twitter_url: twitterUrl,
      status: "pending",
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, bounty: data }, { status: 201 })
}
