/**
 * GET  /api/groups/[id]/bets  — list bets shared to this group
 * POST /api/groups/[id]/bets  — share a bet to this group
 *
 * Pre-match validation: only bets with status='pending' can be shared.
 * This guarantees the pick was registered before the result was known.
 */
import { NextRequest } from "next/server"
import { getServerSession } from "@/lib/auth-server"
import { createServiceClient } from "@/lib/supabase/client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// ── Membership guard ──────────────────────────────────────────
async function assertMember(sb: ReturnType<typeof createServiceClient>, groupId: string, email: string) {
  const { data } = await sb
    .from("group_members")
    .select("id, role")
    .eq("group_id", groupId)
    .eq("user_email", email)
    .single()
  return data ?? null
}

// ── FASE 2: resolución partido→fixture (kickoff) ──────────────
const normName = (s: string) =>
  (s ?? "").toLowerCase().normalize("NFD").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim()

/** Separa "Real Madrid vs Barcelona" en [local, visitante]. */
function splitMatch(text: string): [string, string] | null {
  const parts = (text ?? "").replace(/\s+/g, " ").trim().split(/\s+(?:vs?\.?|v|-|–|—|@|contra)\s+/i)
  return parts.length >= 2 && parts[0] && parts[1] ? [parts[0].trim(), parts[1].trim()] : null
}

/** Casa las selecciones de la apuesta con la tabla fixtures → { fixtureId, kickoff }. */
async function resolveFixtureForBet(
  sb: ReturnType<typeof createServiceClient>,
  legs: Array<{ match?: string | null }>,
): Promise<{ fixtureId: number; kickoff: string } | null> {
  const from = new Date(Date.now() - 2 * 86400000).toISOString()
  const { data } = await sb
    .from("fixtures")
    .select("fixture_id, home_team, away_team, match_date")
    .gte("match_date", from)
    .order("match_date", { ascending: true })
    .limit(800)
  const fixtures = data ?? []
  if (!fixtures.length) return null

  for (const leg of (legs ?? []).slice(0, 4)) {
    const pair = splitMatch(leg.match ?? "")
    if (!pair) continue
    const a = normName(pair[0]), b = normName(pair[1])
    if (!a || !b) continue
    const hit = fixtures.find((f: any) => {
      const h = normName(f.home_team ?? ""), aw = normName(f.away_team ?? "")
      const m1 = (h.includes(a) || a.includes(h)) && (aw.includes(b) || b.includes(aw))
      const m2 = (h.includes(b) || b.includes(h)) && (aw.includes(a) || a.includes(aw))
      return m1 || m2
    })
    if (hit?.fixture_id && hit.match_date) return { fixtureId: hit.fixture_id, kickoff: hit.match_date }
  }
  return null
}

// ── GET ───────────────────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession()
  if (!session?.user?.email) return Response.json({ error: "No autorizado" }, { status: 401 })

  const sb = createServiceClient()
  const email = session.user.email

  const member = await assertMember(sb, id, email)
  if (!member) return Response.json({ error: "No eres miembro de este grupo" }, { status: 403 })

  // Fetch group_bets joined with bets + bet_legs + user info
  const { data: groupBets, error } = await sb
    .from("group_bets")
    .select(`
      id,
      shared_at,
      is_pre_match,
      user_email,
      bets (
        id, title, stake, combined_odds, status, sport, notes, image_url, created_at, settled_at,
        bet_legs ( id, match, selection, odds, status )
      )
    `)
    .eq("group_id", id)
    .order("shared_at", { ascending: false })

  if (error) return Response.json({ error: "Error interno del servidor" }, { status: 500 })

  // Enrich with user display names
  const emails = [...new Set((groupBets ?? []).map(gb => gb.user_email))]
  const { data: users } = await sb
    .from("users_log")
    .select("email, name, avatar_url")
    .in("email", emails)

  const userMap = new Map((users ?? []).map(u => [u.email, u]))

  const bets = (groupBets ?? []).map(gb => ({
    sharedId: gb.id,
    sharedAt: gb.shared_at,
    isPreMatch: gb.is_pre_match,
    sharedBy: gb.user_email,
    sharedByName: userMap.get(gb.user_email)?.name ?? gb.user_email.split("@")[0],
    sharedByAvatar: userMap.get(gb.user_email)?.avatar_url ?? null,
    isOwn: gb.user_email === email,
    bet: gb.bets,
  }))

  // Compute isolated ranking from group_bets only
  const allGroupBetRows = (groupBets ?? [])
  const memberEmails = [...new Set(allGroupBetRows.map(gb => gb.user_email))]
  const rankingMap = new Map<string, { picks: number; won: number; staked: number; returned: number }>()

  for (const gb of allGroupBetRows) {
    const bet = (gb as any).bets
    if (!bet || bet.status === "pending" || bet.status === "void") continue
    const e = gb.user_email
    if (!rankingMap.has(e)) rankingMap.set(e, { picks: 0, won: 0, staked: 0, returned: 0 })
    const row = rankingMap.get(e)!
    row.picks++
    row.staked += bet.stake ?? 0
    if (bet.status === "won") {
      row.won++
      row.returned += (bet.stake ?? 0) * (bet.combined_odds ?? 1)
    }
  }

  const ranking = memberEmails.map(e => {
    const stats = rankingMap.get(e) ?? { picks: 0, won: 0, staked: 0, returned: 0 }
    const profit = stats.returned - stats.staked
    const winrate = stats.picks ? (stats.won / stats.picks) * 100 : 0
    const yield_ = stats.staked ? (profit / stats.staked) * 100 : 0
    const u = userMap.get(e)
    return {
      email: e,
      name: u?.name ?? e.split("@")[0],
      avatar_url: u?.avatar_url ?? null,
      picks: stats.picks,
      won: stats.won,
      winrate: Math.round(winrate * 10) / 10,
      yield: Math.round(yield_ * 10) / 10,
      profit: Math.round(profit * 100) / 100,
    }
  }).sort((a, b) => b.yield - a.yield || b.winrate - a.winrate)

  return Response.json({ bets, ranking })
}

// ── POST ──────────────────────────────────────────────────────
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession()
  if (!session?.user?.email) return Response.json({ error: "No autorizado" }, { status: 401 })

  const sb = createServiceClient()
  const email = session.user.email

  const member = await assertMember(sb, id, email)
  if (!member) return Response.json({ error: "No eres miembro de este grupo" }, { status: 403 })

  let body: { bet_id: string }
  try { body = await req.json() } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 })
  }

  if (!body.bet_id || typeof body.bet_id !== "string") {
    return Response.json({ error: "bet_id requerido" }, { status: 400 })
  }

  // Verify the bet belongs to this user
  const { data: bet } = await sb
    .from("bets")
    .select("id, status, title, kickoff, fixture_id, bet_legs(match)")
    .eq("id", body.bet_id)
    .eq("user_email", email)
    .single()

  if (!bet) return Response.json({ error: "Apuesta no encontrada" }, { status: 404 })

  // Pre-match validation: bet must still be pending (not yet settled)
  if (bet.status !== "pending") {
    return Response.json(
      { error: "Solo puedes compartir apuestas pendientes. No se permiten picks post-partido." },
      { status: 422 }
    )
  }

  // ── FASE 2: BLOQUEO ANTI-TRAMPAS ──────────────────────────────
  // Recupera la hora de inicio del partido (kickoff de la apuesta, o resuelta
  // casando el partido de la apuesta con la tabla fixtures). Si ya empezó, no
  // se puede compartir.
  let kickoff: string | null = (bet as any).kickoff ?? null
  let fixtureId: number | null = (bet as any).fixture_id ?? null
  if (!kickoff) {
    const resolved = await resolveFixtureForBet(sb, (bet as any).bet_legs ?? [])
    if (resolved) { kickoff = resolved.kickoff; fixtureId = resolved.fixtureId }
  }
  if (kickoff && Date.now() > new Date(kickoff).getTime()) {
    return Response.json(
      { error: "El partido ya ha empezado. No puedes compartirla al grupo." },
      { status: 422 },
    )
  }
  // Persistir el enlace al fixture (para la auto-resolución de FASE 3).
  if (fixtureId && (!(bet as any).fixture_id || !(bet as any).kickoff)) {
    await sb.from("bets").update({ fixture_id: fixtureId, kickoff }).eq("id", body.bet_id)
  }

  // Insert — the UNIQUE(group_id, bet_id) constraint prevents duplicate shares
  const { error: insertErr } = await sb
    .from("group_bets")
    .insert({
      group_id: id,
      bet_id: body.bet_id,
      user_email: email,
      is_pre_match: true,  // enforced by the pending status check above
    })

  if (insertErr) {
    if (insertErr.code === "23505") {
      return Response.json({ error: "Ya has compartido esta apuesta en este grupo" }, { status: 409 })
    }
    return Response.json({ error: "Error al compartir la apuesta" }, { status: 500 })
  }

  return Response.json({ ok: true, message: `"${bet.title}" compartida en el grupo` }, { status: 201 })
}

// ── DELETE ────────────────────────────────────────────────────
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession()
  if (!session?.user?.email) return Response.json({ error: "No autorizado" }, { status: 401 })

  const sb = createServiceClient()
  const email = session.user.email

  const url = new URL(req.url)
  const sharedId = url.searchParams.get("sharedId")
  if (!sharedId) return Response.json({ error: "sharedId requerido" }, { status: 400 })

  const { error } = await sb
    .from("group_bets")
    .delete()
    .eq("id", sharedId)
    .eq("user_email", email)
    .eq("group_id", id)

  if (error) return Response.json({ error: "No se pudo eliminar" }, { status: 500 })

  return Response.json({ ok: true })
}
