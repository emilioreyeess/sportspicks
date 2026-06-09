/**
 * POST /api/bets/analysis
 * PRO/PREMIUM: Análisis IA personalizado del historial de apuestas.
 *
 * Lee todas las apuestas resueltas del usuario y genera:
 * - Identificación de patrones perdedores
 * - Mercados con mejor/peor rendimiento
 * - Recomendaciones de mejora basadas en datos reales
 * - Yield por deporte y mercado
 *
 * Requiere plan: premium o pro
 */
import { getServerSession } from "@/lib/auth-server"
import { createServiceClient } from "@/lib/supabase/client"
import { getGrantedPlan } from "@/lib/plan-grants"
import Anthropic from "@anthropic-ai/sdk"
import { consume, getClientIp, tooManyRequests } from "@/lib/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(req: Request) {
  const session = await getServerSession()
  if (!session?.user?.email) {
    return Response.json({ error: "No autorizado" }, { status: 401 })
  }

  // Rate limit: 1 análisis por 30 minutos por usuario
  const ip = getClientIp(req)
  if (!consume(`analysis:${session.user.email}:${ip}`, 1, 1 / 30)) {
    return tooManyRequests(1800)
  }

  const sb = createServiceClient()

  // Verificar plan: grants manuales primero, luego DB, luego fallback free
  // Nota: el plan NO se persiste en users_log para usuarios de grant — se resuelve aquí.
  const email = session.user.email
  const grant = getGrantedPlan(email)
  let plan: string = grant ?? "free"

  if (!grant) {
    // Sin grant manual → consultar DB (usuarios de Stripe)
    const { data: userLog } = await sb
      .from("users_log")
      .select("plan")
      .eq("email", email)
      .single()
    plan = userLog?.plan ?? "free"
  }

  if (plan !== "premium" && plan !== "pro") {
    return Response.json(
      { error: "Esta función requiere plan Premium o PRO." },
      { status: 403 }
    )
  }

  // Obtener todas las apuestas resueltas con sus piernas
  const { data: bets, error: betsErr } = await sb
    .from("bets")
    .select("id, title, stake, combined_odds, status, sport, notes, created_at, settled_at, bet_legs(match, selection, odds, status)")
    .eq("user_email", session.user.email)
    .in("status", ["won", "lost", "void"])
    .order("created_at", { ascending: false })
    .limit(100)

  if (betsErr) {
    return Response.json({ error: "Error al cargar historial" }, { status: 500 })
  }

  if (!bets || bets.length < 3) {
    return Response.json({
      error: "Necesitas al menos 3 apuestas resueltas para recibir un análisis.",
    }, { status: 422 })
  }

  // ── Cálculo de estadísticas locales ──────────────────────────────────────────
  const settled = bets.filter(b => b.status === "won" || b.status === "lost")
  const won = settled.filter(b => b.status === "won")
  const lost = settled.filter(b => b.status === "lost")

  const totalStaked = settled.reduce((s, b) => s + Number(b.stake || 0), 0)
  const totalReturn = won.reduce((s, b) => s + Number(b.stake || 0) * Number(b.combined_odds || 1), 0)
  const profit = totalReturn - totalStaked
  const winrate = settled.length ? (won.length / settled.length) * 100 : 0
  const yield_ = totalStaked ? (profit / totalStaked) * 100 : 0

  // Por deporte
  const bySport: Record<string, { won: number; lost: number; staked: number; returned: number }> = {}
  for (const b of settled) {
    const s = b.sport ?? "other"
    if (!bySport[s]) bySport[s] = { won: 0, lost: 0, staked: 0, returned: 0 }
    bySport[s][b.status === "won" ? "won" : "lost"]++
    bySport[s].staked += Number(b.stake || 0)
    if (b.status === "won") bySport[s].returned += Number(b.stake || 0) * Number(b.combined_odds || 1)
  }

  // Por rango de cuota
  const byOddsRange: Record<string, { won: number; lost: number }> = {
    "1.00-1.50": { won: 0, lost: 0 },
    "1.51-2.00": { won: 0, lost: 0 },
    "2.01-3.00": { won: 0, lost: 0 },
    "3.01+":     { won: 0, lost: 0 },
  }
  for (const b of settled) {
    const o = Number(b.combined_odds || 1)
    const range = o <= 1.5 ? "1.00-1.50" : o <= 2 ? "1.51-2.00" : o <= 3 ? "2.01-3.00" : "3.01+"
    byOddsRange[range][b.status === "won" ? "won" : "lost"]++
  }

  // Selecciones más usadas (de las piernas perdidas)
  const lostLegs = lost.flatMap(b => ((b as any).bet_legs ?? []).filter((l: any) => l.status === "lost"))
  const selectionCount: Record<string, number> = {}
  for (const leg of lostLegs) {
    const sel = leg.selection ?? ""
    selectionCount[sel] = (selectionCount[sel] ?? 0) + 1
  }
  const topLostSelections = Object.entries(selectionCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([s, c]) => `"${s}" (${c}x)`)

  // ── Construir datos para Claude ───────────────────────────────────────────────
  const sportStats = Object.entries(bySport).map(([sport, s]) => {
    const totalS = s.won + s.lost
    const wr = totalS ? Math.round((s.won / totalS) * 100) : 0
    const prof = s.returned - s.staked
    const yld = s.staked ? Math.round((prof / s.staked) * 100) : 0
    return `${sport}: ${s.won}W/${s.lost}L (${wr}% winrate, yield ${yld > 0 ? "+" : ""}${yld}%, €${prof.toFixed(2)} profit)`
  }).join("\n")

  const oddsStats = Object.entries(byOddsRange).map(([range, s]) => {
    const total = s.won + s.lost
    const wr = total ? Math.round((s.won / total) * 100) : 0
    return `Cuota ${range}: ${s.won}W/${s.lost}L (${wr}% winrate)`
  }).join("\n")

  // Últimas 5 apuestas perdidas con sus notas
  const recentLosses = lost.slice(0, 5).map(b => {
    const legs = ((b as any).bet_legs ?? []).map((l: any) => `  • ${l.match ?? "?"} → ${l.selection ?? "?"} @${l.odds ?? "?"}`).join("\n")
    return `"${b.title}" @${b.combined_odds} (€${b.stake})\n${legs}${b.notes ? `\n  Nota: ${b.notes}` : ""}`
  }).join("\n\n")

  const dataForAnalysis = `
HISTORIAL COMPLETO (${settled.length} apuestas resueltas):
- Ganadas: ${won.length} | Perdidas: ${lost.length}
- Winrate: ${Math.round(winrate)}%
- Yield global: ${yield_ > 0 ? "+" : ""}${yield_.toFixed(1)}%
- Profit total: €${profit.toFixed(2)}
- Stake total apostado: €${totalStaked.toFixed(2)}

POR DEPORTE:
${sportStats || "Sin datos por deporte"}

POR RANGO DE CUOTA:
${oddsStats}

SELECCIONES MÁS FALLADAS:
${topLostSelections.length ? topLostSelections.join(", ") : "Sin datos"}

ÚLTIMAS APUESTAS PERDIDAS (para identificar patrones):
${recentLosses || "Sin pérdidas recientes"}
`.trim()

  // ── Llamada a Claude ──────────────────────────────────────────────────────────
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "Servicio de análisis no configurado" }, { status: 503 })
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      const send = (text: string) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
      try {
        const stream = await client.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1200,
          stream: true,
          messages: [{
            role: "user",
            content: `Eres un coach de apuestas deportivas. Analiza el historial de este usuario y da un informe concreto y accionable en español.

${dataForAnalysis}

FORMATO OBLIGATORIO (usa exactamente estas secciones con emojis):
📊 **RESUMEN EJECUTIVO** (2-3 líneas con los números clave)
🔍 **PATRONES DETECTADOS** (qué está fallando y por qué, con datos concretos)
💡 **MERCADOS QUE FUNCIONAN** (donde tiene mejor rendimiento — cita cifras)
⚠️ **ERRORES RECURRENTES** (selecciones o mercados que dragan el yield)
🎯 **RECOMENDACIONES CONCRETAS** (máx 4 puntos, muy específicas y aplicables)

Sé directo, usa los números del historial, no inventes datos. Si el historial es pequeño, dilo. Máximo 350 palabras.`,
          }],
          system: "Eres un analista de apuestas con 10 años de experiencia. Hablas en español. Eres directo, usas datos concretos del historial, no das generalidades. Nunca animas a apostar más — solo a apostar mejor.",
        })

        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            send(event.delta.text)
          }
        }
      } catch (err: any) {
        send(`\n\n❌ Error al generar análisis: ${err?.message ?? "desconocido"}`)
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"))
      controller.close()
    },
  })

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
