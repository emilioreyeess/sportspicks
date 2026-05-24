import { NextRequest } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { consume, getClientIp, tooManyRequests } from "@/lib/rate-limit"

export const runtime = "nodejs"
export const maxDuration = 60

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

/**
 * POST /api/stats/analyze
 * Análisis scout de un equipo basado exclusivamente en sus stats reales de ESPN.
 * Feature PREMIUM+. Responde en streaming SSE.
 *
 * Regla absoluta: Claude solo puede razonar sobre los datos recibidos.
 * Nada se inventa. Si un dato es null, no se menciona.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  // 2 análisis en ráfaga · 1 cada 3 min sostenido — llama a Anthropic, cuesta dinero
  if (!consume(`stats-analyze:${ip}`, 2, 0.33)) return tooManyRequests(180)

  let stats: any
  try { stats = await req.json() } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400 })
  }

  if (!stats?.name) {
    return new Response(JSON.stringify({ error: "Faltan datos del equipo." }), { status: 400 })
  }

  // ── Construir contexto de datos para Claude ─────────────────────────────────

  const played      = stats.played ?? 0
  const wins        = stats.wins ?? 0
  const draws       = stats.draws ?? 0
  const losses      = stats.losses ?? 0
  const gf          = stats.goals_for ?? 0
  const ga          = stats.goals_against ?? 0
  const gfPG        = played ? (gf / played).toFixed(2) : null
  const gaPG        = played ? (ga / played).toFixed(2) : null

  const home        = stats.home ?? {}
  const away        = stats.away ?? {}
  const homeGfPG    = home.played ? (home.goals_for / home.played).toFixed(2) : null
  const awayGfPG    = away.played ? (away.goals_for / away.played).toFixed(2) : null
  const homeGaPG    = home.played ? (home.goals_against / home.played).toFixed(2) : null
  const awayGaPG    = away.played ? (away.goals_against / away.played).toFixed(2) : null
  const homeWpct    = home.played ? Math.round((home.wins / home.played) * 100) : null
  const awayWpct    = away.played ? Math.round((away.wins / away.played) * 100) : null
  const homePoints  = home.wins * 3 + home.draws
  const awayPoints  = away.wins * 3 + away.draws

  const form        = (stats.form ?? []).join("")
  const recentWins  = (stats.form ?? []).filter((r: string) => r === "W").length
  const recentLoss  = (stats.form ?? []).filter((r: string) => r === "L").length

  const cleanSheetPct = played ? Math.round((stats.clean_sheets / played) * 100) : 0

  // Construir líneas de datos disponibles (solo los que no son null)
  const lines: string[] = [
    `Equipo: ${stats.name}`,
    `Liga: ${stats.league} · Temporada ${stats.season}`,
    `Partidos: ${played} PJ · ${wins}V-${draws}E-${losses}D`,
    `Goles: ${gf} a favor / ${ga} en contra${gfPG ? ` (${gfPG}/PJ a favor, ${gaPG}/PJ en contra)` : ""}`,
    `BTTS: ${stats.btts_pct}% · Over 2.5: ${stats.over25_pct}% · Portería a cero: ${cleanSheetPct}%`,
    `Forma reciente (${form.length} partidos): ${form} → ${recentWins} victorias, ${recentLoss} derrotas`,
  ]

  if (home.played) {
    lines.push(`LOCAL: ${home.wins}V-${home.draws}E-${home.losses}D · ${home.goals_for} goles marcados / ${home.goals_against} encajados${homeGfPG ? ` (${homeGfPG}/PJ marcados, ${homeGaPG}/PJ encajados)` : ""} · ${homePoints} pts · tasa victoria ${homeWpct}%`)
  }
  if (away.played) {
    lines.push(`VISITANTE: ${away.wins}V-${away.draws}E-${away.losses}D · ${away.goals_for} goles marcados / ${away.goals_against} encajados${awayGfPG ? ` (${awayGfPG}/PJ marcados, ${awayGaPG}/PJ encajados)` : ""} · ${awayPoints} pts · tasa victoria ${awayWpct}%`)
  }

  const adv = stats.advanced_samples > 0
  if (adv) {
    if (stats.avg_shots != null)           lines.push(`Tiros/PJ: ${stats.avg_shots.toFixed(1)}`)
    if (stats.avg_shots_on_target != null) lines.push(`Tiros a puerta/PJ: ${stats.avg_shots_on_target.toFixed(1)}`)
    if (stats.avg_possession != null)      lines.push(`Posesión media: ${stats.avg_possession}%`)
    if (stats.avg_corners_for != null)     lines.push(`Córners generados/PJ: ${stats.avg_corners_for.toFixed(1)}`)
    if (stats.avg_corners_against != null) lines.push(`Córners concedidos/PJ: ${stats.avg_corners_against.toFixed(1)}`)
    if (stats.avg_yellows != null)         lines.push(`Amarillas/PJ: ${stats.avg_yellows.toFixed(1)}`)
    if (stats.avg_reds != null)            lines.push(`Rojas/PJ: ${stats.avg_reds.toFixed(2)}`)
    if (stats.avg_fouls != null)           lines.push(`Faltas/PJ: ${stats.avg_fouls.toFixed(1)}`)
    lines.push(`(Stats avanzadas de ${stats.advanced_samples} partidos recientes)`)
  }

  const dataBlock = lines.join("\n")

  // ── Prompt ─────────────────────────────────────────────────────────────────

  const system = `Eres un analista scout de fútbol experto. Tu función: generar informes de equipo profundos, precisos y útiles basados EXCLUSIVAMENTE en los datos estadísticos reales proporcionados.

REGLA ABSOLUTA: Solo puedes razonar sobre lo que está en los datos. NUNCA inventes jugadores, estilos de juego, lesiones, tácticas, posiciones de tabla ni ningún dato que no esté en el bloque de estadísticas.

Si un dato no está disponible (null/ausente), omítelo o señala que no hay datos suficientes para esa dimensión. No lo rellenes con suposiciones.

FORMATO DE RESPUESTA:
Escribe en español. Usa el siguiente formato (con emojis y negrita para los títulos de sección):

**📊 Perfil general**
Breve descripción del rendimiento global basada en victorias, goles, puntos. Menciona si es un equipo sólido, irregular, defensivo u ofensivo según los números.

**🏟️ Comportamiento local vs visitante**
Compara los dos contextos con datos reales. ¿Es mucho mejor en casa? ¿Sufre fuera? ¿Cuánto cambia el aporte goleador?

**⚽ Patrón goleador**
Analiza si marca mucho o poco, si encaja frecuentemente, si los partidos suelen ser abiertos (BTTS, Over 2.5) o cerrados. Cita los porcentajes reales.

**⛳ Córners y set pieces** (solo si hay datos avanzados)
¿Genera muchos córners? ¿Concede muchos? ¿Es relevante para apuestas de corners?

**🟨 Disciplina e intensidad** (solo si hay datos avanzados)
Amarillas, rojas y faltas por partido. ¿Es un equipo físico? ¿Propenso a sanciones?

**🎯 Creación de juego** (solo si hay datos de tiros/posesión)
Tiros totales vs a puerta. Eficiencia goleadora. ¿Posesión dominante o reactiva?

**💡 Oportunidades de mercado**
Basado ÚNICAMENTE en los números, señala qué mercados tienen más fundamento estadístico para este equipo: BTTS, Over/Under 2.5, draw no bet local, córners, tarjetas, etc. Explica con las cifras.

**⚠️ Limitaciones del análisis**
Qué datos faltan (xG, alineaciones, lesiones, calendario rival, rachas de árbitros) que limitarían un análisis más completo. Sé honesto y breve.

Longitud total: 350-500 palabras. Directo, útil, sin relleno.`

  const userMsg = `Genera el informe scout completo de este equipo con los datos disponibles:

${dataBlock}

Recuerda: solo razona sobre estos números. Nada fuera de ellos.`

  // ── Streaming SSE ──────────────────────────────────────────────────────────

  const encoder = new TextEncoder()

  const readable = new ReadableStream({
    async start(controller) {
      const send = (text: string) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))

      try {
        const stream = await client.messages.stream({
          model: "claude-opus-4-5",
          max_tokens: 1200,
          system,
          messages: [{ role: "user", content: userMsg }],
        })

        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            send(event.delta.text)
          }
        }
      } catch (err: any) {
        send(`\n\n❌ Error al generar el análisis: ${err.message}`)
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
