import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth-server"
import { createServiceClient } from "@/lib/supabase/client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getServerSession()
  if (!session?.user?.email) return Response.json({ error: "No autorizado" }, { status: 401 })

  const sb = createServiceClient()
  const email = session.user.email

  const { data: bets, error } = await sb
    .from("bets")
    .select("*, bet_legs(*)")
    .eq("user_email", email)
    .order("created_at", { ascending: false })

  // CN-026: Return generic message — do not expose internal DB error details
  if (error) return Response.json({ error: "Error interno del servidor" }, { status: 500 })

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

// ── Validation constants ──────────────────────────────────────────────────────
const MAX_STAKE = 100_000        // €100k max stake
// Entrada MANUAL: el stake lo introduce un humano en un formulario. A diferencia
// del OCR (que puede dejar stake NULL → needs_review como borrador de rescate),
// aquí exigimos un stake real > 0. Sin stake válido → HTTP 400, no borrador.
const MIN_STAKE_MANUAL = 0.01    // mínimo estricto para ingreso manual (> 0)
const MAX_ODDS  = 10_000         // @10000 max odds
const MIN_ODDS  = 1.00           // @1.00 min odds
const MAX_LEGS  = 20             // max combinada legs
const VALID_SPORTS = ["football","basketball","tennis","baseball","hockey","other"]

export async function POST(req: NextRequest) {
  const session = await getServerSession()
  if (!session?.user?.email) return Response.json({ error: "No autorizado" }, { status: 401 })

  let body: {
    title: string
    stake: number
    combined_odds: number
    legs: { match: string; selection: string; odds: number }[]
    sport?: string
    notes?: string
    image_url?: string
  }
  try { body = await req.json() } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 })
  }

  // ── Input validation ──────────────────────────────────────────────────────
  if (!body.title || typeof body.title !== "string") {
    return Response.json({ error: "Título requerido" }, { status: 400 })
  }
  if (body.title.length > 200) {
    return Response.json({ error: "Título demasiado largo (máx. 200 caracteres)" }, { status: 400 })
  }
  // ── HARD VALIDATION del stake (entrada manual) ─────────────────────────────
  // null / undefined / no-numérico / <= 0  → rechazo inmediato 400.
  // NO se crea un borrador con needs_review: ese flag es exclusivo del rescate
  // OCR cuando la IA no puede leer la imagen. Un humano rellenando el form
  // debe aportar un stake real.
  if (body.stake === null || body.stake === undefined) {
    return NextResponse.json(
      { error: "Validation Error: Stake is required and must be greater than 0" },
      { status: 400 },
    )
  }
  const stake = Number(body.stake)
  if (!isFinite(stake) || stake < MIN_STAKE_MANUAL) {
    return NextResponse.json(
      { error: "Validation Error: Stake is required and must be greater than 0" },
      { status: 400 },
    )
  }
  if (stake > MAX_STAKE) {
    return NextResponse.json(
      { error: `Stake demasiado alto (máx. ${MAX_STAKE})` },
      { status: 400 },
    )
  }
  const combinedOdds = Number(body.combined_odds)
  if (!isFinite(combinedOdds) || combinedOdds < MIN_ODDS || combinedOdds > MAX_ODDS) {
    return Response.json({ error: `Cuota inválida (${MIN_ODDS}–${MAX_ODDS})` }, { status: 400 })
  }
  if (body.sport && !VALID_SPORTS.includes(body.sport)) {
    return Response.json({ error: "Deporte inválido" }, { status: 400 })
  }
  if (body.legs && !Array.isArray(body.legs)) {
    return Response.json({ error: "Legs debe ser un array" }, { status: 400 })
  }
  if (body.legs && body.legs.length > MAX_LEGS) {
    return Response.json({ error: `Máximo ${MAX_LEGS} selecciones por apuesta` }, { status: 400 })
  }
  // Validate each leg
  for (const leg of (body.legs ?? [])) {
    if (!leg.match || typeof leg.match !== "string" || leg.match.length > 200) {
      return Response.json({ error: "Nombre de partido inválido en selección" }, { status: 400 })
    }
    if (!leg.selection || typeof leg.selection !== "string" || leg.selection.length > 200) {
      return Response.json({ error: "Selección inválida" }, { status: 400 })
    }
    const legOdds = Number(leg.odds)
    if (!isFinite(legOdds) || legOdds < MIN_ODDS || legOdds > MAX_ODDS) {
      return Response.json({ error: `Cuota de selección inválida (${MIN_ODDS}–${MAX_ODDS})` }, { status: 400 })
    }
  }
  if (body.notes && typeof body.notes === "string" && body.notes.length > 1000) {
    return Response.json({ error: "Notas demasiado largas (máx. 1000 caracteres)" }, { status: 400 })
  }

  const sb = createServiceClient()
  const email = session.user.email

  // Validate image_url if provided
  const imageUrl = typeof body.image_url === "string" && body.image_url.startsWith("https://")
    ? body.image_url
    : null

  const { data: bet, error: betErr } = await sb
    .from("bets")
    .insert({
      user_email: email,
      title: body.title.trim(),
      stake,
      combined_odds: combinedOdds,
      sport: body.sport ?? "football",
      notes: body.notes?.trim() ?? null,
      image_url: imageUrl,
      status: "pending",
    })
    .select()
    .single()

  if (betErr || !bet) return Response.json({ error: betErr?.message ?? "Error al crear apuesta" }, { status: 500 })

  if (body.legs?.length) {
    const legs = body.legs.map((l) => ({
      bet_id: bet.id,
      match: l.match.trim(),
      market: l.selection.trim(),
      selection: l.selection.trim(),
      odds: Number(l.odds),
      status: "pending",
    }))
    const { error: legErr } = await sb.from("bet_legs").insert(legs)
    if (legErr) console.error("[bets] leg insert error:", legErr.message)
  }

  return Response.json({ ok: true, bet }, { status: 201 })
}
