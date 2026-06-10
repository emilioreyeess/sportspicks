/**
 * GET /api/bets/settle  (FASE 3 — auto-resolución con IA árbitro)
 *
 * Llamado por cron. Busca apuestas pending cuyo partido (fixture_id) ya esté
 * FINALIZADO (FT) en nuestra tabla `fixtures`, y pide a un LLM que actúe de
 * árbitro: recibe (A) el texto de la apuesta y (B) el resultado oficial, y
 * devuelve EXCLUSIVAMENTE {"status":"Ganada"|"Perdida"}. Actualiza la apuesta.
 *
 * Para apuestas sin fixture_id (OCR), intenta resolverlo casando las selecciones
 * con la tabla fixtures (y lo persiste).
 *
 * Seguridad: Authorization: Bearer ${CRON_SECRET} (fail-closed, ≥16 chars).
 */
import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { createServiceClient } from "@/lib/supabase/client"

export const runtime = "nodejs"
export const maxDuration = 60
export const dynamic = "force-dynamic"

const REFEREE_MODEL = "claude-sonnet-4-5-20250929"   // snapshot validado
const FINISHED = new Set(["FT", "AET", "PEN"])
const MAX_PER_RUN = 15   // límite de llamadas al LLM por ejecución (timeout-safe)

const norm = (s: string) =>
  (s ?? "").toLowerCase().normalize("NFD").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim()

function splitMatch(text: string): [string, string] | null {
  const p = (text ?? "").replace(/\s+/g, " ").trim().split(/\s+(?:vs?\.?|v|-|–|—|@|contra)\s+/i)
  return p.length >= 2 && p[0] && p[1] ? [p[0].trim(), p[1].trim()] : null
}

/** Resuelve el fixture de una apuesta casando sus selecciones con `fixtures`. */
function matchFixture(legs: Array<{ match?: string | null }>, fixtures: any[]): any | null {
  for (const leg of (legs ?? []).slice(0, 4)) {
    const pair = splitMatch(leg.match ?? "")
    if (!pair) continue
    const a = norm(pair[0]), b = norm(pair[1])
    if (!a || !b) continue
    const hit = fixtures.find((f) => {
      const h = norm(f.home_team ?? ""), aw = norm(f.away_team ?? "")
      return ((h.includes(a) || a.includes(h)) && (aw.includes(b) || b.includes(aw))) ||
             ((h.includes(b) || b.includes(h)) && (aw.includes(a) || a.includes(aw)))
    })
    if (hit) return hit
  }
  return null
}

/** Pide al LLM-árbitro el veredicto Ganada/Perdida. null si no se puede decidir. */
async function refereeVerdict(client: Anthropic, betText: string, resultText: string): Promise<"won" | "lost" | null> {
  try {
    const res = await client.messages.create({
      model: REFEREE_MODEL,
      max_tokens: 30,
      system:
        "Eres un árbitro de apuestas deportivas. Recibes la apuesta de un usuario (texto libre, posible OCR) y el resultado OFICIAL del partido. Decide si la apuesta es Ganada o Perdida. Una combinada solo es Ganada si TODAS sus selecciones aciertan. Responde EXCLUSIVAMENTE con JSON, sin texto extra: {\"status\":\"Ganada\"} o {\"status\":\"Perdida\"}.",
      messages: [{
        role: "user",
        content: `APUESTA DEL USUARIO:\n${betText}\n\nRESULTADO OFICIAL:\n${resultText}\n\nDevuelve solo el JSON con el veredicto.`,
      }],
    })
    const txt = res.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("")
    const m = txt.match(/\{[^}]*\}/)
    if (!m) return null
    const parsed = JSON.parse(m[0]) as { status?: string }
    const s = (parsed.status ?? "").toLowerCase()
    if (s === "ganada") return "won"
    if (s === "perdida") return "lost"
    return null
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || secret.length < 16) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY no configurada" }, { status: 500 })
  }

  const out = { scanned: 0, resolved: 0, finished: 0, settled: 0, won: 0, lost: 0, errors: 0 }

  try {
    const sb = createServiceClient()
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    // 1. Apuestas pendientes (con selecciones).
    const { data: pending, error } = await sb
      .from("bets")
      .select("id, title, fixture_id, bet_legs(match, selection, odds)")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(120)
    if (error) return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
    out.scanned = pending?.length ?? 0
    if (!pending?.length) return NextResponse.json({ ok: true, ...out })

    // 2. Universo de fixtures recientes para resolver/leer resultados.
    const from = new Date(Date.now() - 14 * 86400000).toISOString()
    const { data: fxAll } = await sb
      .from("fixtures")
      .select("fixture_id, home_team, away_team, status, match_date, stats")
      .gte("match_date", from)
      .limit(2000)
    const fixtures = fxAll ?? []
    const byId = new Map<number, any>(fixtures.map((f: any) => [Number(f.fixture_id), f]))

    let llmCalls = 0
    for (const bet of pending) {
      try {
        // Resolver fixture (por id guardado o casando selecciones).
        let fx = bet.fixture_id != null ? byId.get(Number(bet.fixture_id)) : null
        if (!fx) {
          fx = matchFixture((bet as any).bet_legs ?? [], fixtures)
          if (fx?.fixture_id) {
            out.resolved++
            await sb.from("bets").update({ fixture_id: fx.fixture_id, kickoff: fx.match_date }).eq("id", bet.id)
          }
        }
        if (!fx) continue

        // Solo si el partido está FINALIZADO.
        if (!FINISHED.has(String(fx.status ?? "").toUpperCase())) continue
        out.finished++

        const gh = fx.stats?.goals?.home, ga = fx.stats?.goals?.away
        if (gh == null || ga == null) continue   // sin marcador fiable → no inventamos

        if (llmCalls >= MAX_PER_RUN) break
        llmCalls++

        const betText = [
          (bet as any).title ? `Título: ${(bet as any).title}` : "",
          ...((bet as any).bet_legs ?? []).map((l: any) => `- ${l.match ?? "?"} → ${l.selection ?? "?"} @${l.odds ?? "?"}`),
        ].filter(Boolean).join("\n")
        const resultText = `${fx.home_team} ${gh} - ${ga} ${fx.away_team} (FINALIZADO).`

        const verdict = await refereeVerdict(client, betText, resultText)
        if (!verdict) { out.errors++; continue }

        await sb.from("bets").update({ status: verdict, settled_at: new Date().toISOString() }).eq("id", bet.id)
        out.settled++
        verdict === "won" ? out.won++ : out.lost++
      } catch {
        out.errors++
      }
    }

    return NextResponse.json({ ok: true, ...out })
  } catch (e) {
    console.error("[bets/settle] error:", e instanceof Error ? e.message : e)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
