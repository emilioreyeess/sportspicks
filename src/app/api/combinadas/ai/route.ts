import { NextRequest } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { getStore } from "@/lib/store"
import { ensureWarm } from "@/lib/pipeline"
import { consume, getClientIp, tooManyRequests } from "@/lib/rate-limit"

export const runtime = "nodejs"
export const maxDuration = 60

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

/**
 * Combinada IA — Motor Inteligente de Decisión de Mercado.
 *
 * El motor:
 * 1. Detecta server-side la intención del usuario (mercado, liga, cuota, patas)
 * 2. Verifica qué mercados existen en el pool real de hoy
 * 3. Si el mercado pedido no está disponible → responde honestamente y sugiere alternativas
 * 4. Si está disponible → filtra el pool y usa Claude para elegir la mejor combinación
 *
 * PROHIBIDO: sustituciones automáticas sin avisar al usuario.
 * PROHIBIDO: picks inventados o fuera del pool real.
 */
export async function POST(req: NextRequest) {
  // SECURITY FIX: require authenticated session — Claude Opus is expensive
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return Response.json({ error: "No autorizado" }, { status: 401 })

  // Per-IP + per-user rate limit to prevent token abuse
  const ip = getClientIp(req)
  if (!consume(`ai-combi:${ip}`, 3, 0.4)) return tooManyRequests(180)
  if (!consume(`ai-combi-user:${session.user.email}`, 5, 1)) return tooManyRequests(120)

  await ensureWarm()

  let body: any
  try { body = await req.json() } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 })
  }
  const prompt: string = (body?.prompt ?? "").trim()
  if (!prompt) return Response.json({ error: "Describe qué combinada quieres." }, { status: 400 })
  if (prompt.length > 500) return Response.json({ error: "Prompt demasiado largo (máx. 500 caracteres)." }, { status: 400 })

  const pool = getStore().combinadaPool
  if (!pool?.length) {
    return Response.json({
      error: "Sin selecciones disponibles en el pool de hoy.",
      hint: "El motor está cargando datos. Vuelve en unos segundos.",
    }, { status: 422 })
  }

  // ── 1. Detección de intención (server-side, sin coste de API) ─────────────

  const intent = detectIntent(prompt)

  // ── 2. Auditoría del pool: ¿qué mercados y ligas hay disponibles? ──────────

  const poolMarkets = [...new Set(pool.map((p: any) => p.market as string))]
  const poolLeagues = [...new Set(pool.map((p: any) => p.league as string))]

  // ── 3. Verificar disponibilidad del mercado pedido ─────────────────────────

  if (intent.market) {
    const available = isMarketInPool(intent.market, poolMarkets)
    if (!available) {
      return Response.json({
        no_match: true,
        requested_market: intent.market,
        message: `No hay picks de ${humanMarket(intent.market)} disponibles en el pool de hoy.`,
        explanation: MARKET_EXPLANATION[intent.market] ??
          `El mercado "${intent.market}" no está disponible en los datos de hoy.`,
        available_markets: poolMarkets,
        available_leagues: poolLeagues.slice(0, 8),
        suggestion: buildAlternativeSuggestion(intent.market, poolMarkets),
      })
    }
  }

  // ── 4. Verificar disponibilidad de la liga pedida ──────────────────────────

  if (intent.league) {
    const leagueInPool = poolLeagues.some((l) =>
      l.toLowerCase().includes(intent.league!.toLowerCase()) ||
      intent.league!.toLowerCase().includes(l.toLowerCase().split(" ")[0])
    )
    if (!leagueInPool) {
      return Response.json({
        no_match: true,
        requested_league: intent.league,
        message: `No hay partidos de ${intent.league} en el pool de hoy.`,
        explanation: `Solo hay datos para las ligas que juegan hoy. Las ligas disponibles son: ${poolLeagues.slice(0, 6).join(", ")}.`,
        available_leagues: poolLeagues,
        available_markets: poolMarkets,
        suggestion: `Prueba sin especificar liga: "${buildExampleWithoutLeague(prompt)}"`,
      })
    }
  }

  // ── 5. Construir vista del pool para Claude (compacta, solo datos reales) ──

  const items = pool.map((p: any, i: number) => ({
    i,
    match: p.match,
    league: p.league,
    market: p.market,
    selection: p.selection,
    odd: Number(p.odd.toFixed(2)),
    prob: Math.round(p.prob * 100),
    reasoning: p.reasoning?.slice(0, 100),
  }))

  // ── 6. Prompt para Claude — analista profesional, no rellena ──────────────

  const availableMarketsStr = poolMarkets.join(", ")
  const leagueInfo = intent.league ? `Liga solicitada: ${intent.league}` : "Sin restricción de liga"
  const marketInfo = intent.market ? `Mercado solicitado: ${humanMarket(intent.market)}` : "Sin restricción de mercado"
  const legsInfo = intent.numLegs ? `Patas solicitadas: ${intent.numLegs}` : "Por defecto: 3 patas"
  const oddInfo = intent.targetOdd ? `Cuota combinada objetivo: ~${intent.targetOdd}` : ""

  const sys = `Eres SportsPicks AI Combinator, un analista cuantitativo y trader deportivo experto.

Tu misión: construir combinadas de alta calidad desde un POOL de selecciones reales. Cada selección tiene probabilidad del modelo, cuota real y razonamiento estadístico.

═══════════════════════════════════
REGLAS ABSOLUTAS — NUNCA VIOLAR
═══════════════════════════════════
1. SOLO puedes usar índices del POOL. NUNCA inventes partidos, cuotas ni selecciones.
2. Una sola selección por partido (campo "match"). No duplicar partidos.
3. Devuelve entre 2 y 5 patas. Nunca 0. Nunca más de 5.
4. Mercados disponibles en el pool de hoy: ${availableMarketsStr}
5. Si el usuario pidió un mercado que NO está disponible, el servidor ya lo habrá bloqueado antes. Si llegaste aquí, el mercado existe.
6. NUNCA cambies el mercado solicitado por otro sin informar.

═══════════════════════════════════
CÓMO ELEGIR LAS PATAS
═══════════════════════════════════
Como analista profesional:

• Prioriza selecciones con EDGE POSITIVO (prob > implícita de la cuota).
• Busca coherencia estadística: no mezcles Over 2.5 con Under 2.5 del mismo partido.
• Si piden cuota objetivo: ajusta el número de patas para aproximarte a esa cuota combinada. Cuota combinada = producto de las cuotas individuales.
• Si piden liga específica: filtra por esa liga. Si hay pocas opciones, elige las mejores disponibles.
• Si piden mercado específico (Over, Ganador, Hándicap): filtra por ese market.
• La probabilidad combinada = producto de las probabilidades individuales.

Contexto de la petición:
- ${marketInfo}
- ${leagueInfo}
- ${legsInfo}
${oddInfo ? `- ${oddInfo}` : ""}

═══════════════════════════════════
RAZONAMIENTO OBLIGATORIO
═══════════════════════════════════
Para cada pata seleccionada, explica en 1 línea por qué la elegiste (edge, forma, contexto).

═══════════════════════════════════
FORMATO DE RESPUESTA
═══════════════════════════════════
Devuelve ÚNICAMENTE este JSON válido. Sin markdown, sin texto extra:
{
  "selected": [índices del pool],
  "leg_reasons": ["razón pata 0", "razón pata 1", ...],
  "overall_reasoning": "Resumen de 1-2 frases: qué encontraste y por qué esta combinada tiene sentido estadístico.",
  "interpretation": "Cómo interpretaste la petición (ej: 'Over 2.5, Premier League, 3 patas, cuota ~4.0')"
}`

  const userMsg = `POOL del día (${items.length} selecciones reales con cuotas y probabilidades de modelo):
${JSON.stringify(items, null, 0)}

PETICIÓN: "${prompt}"

Elige la mejor combinación. Recuerda: devuelve siempre entre 2 y 5 índices en "selected". Analiza el edge y el razonamiento estadístico de cada pata antes de seleccionarla.

Devuelve el JSON.`

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1500,
      system: sys,
      messages: [{ role: "user", content: userMsg }],
    })

    const blocks = response.content as any[]
    const text: string = blocks.find((b) => b.type === "text")?.text ?? "{}"
    const cleaned = text.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim()

    let parsed: {
      selected?: number[]
      leg_reasons?: string[]
      overall_reasoning?: string
      interpretation?: string
    } = {}
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      const m = cleaned.match(/\{[\s\S]*\}/)
      if (m) { try { parsed = JSON.parse(m[0]) } catch {} }
    }

    let idx = (parsed.selected ?? []).filter(
      (n): n is number => typeof n === "number" && n >= 0 && n < pool.length
    )

    // Fallback: si Claude devolvió vacío, top-3 por probabilidad del filtro relevante
    if (idx.length === 0) {
      const filtered = filterPoolByIntent(items, intent)
      const top3 = filtered.sort((a: any, b: any) => b.prob - a.prob).slice(0, 3).map((x: any) => x.i)
      idx = top3.length > 0 ? top3 : [0, 1, 2].filter((i) => i < pool.length)
      parsed.overall_reasoning = `No encontré selecciones exactas para "${prompt}". Aquí están las selecciones con mejor probabilidad del pool de hoy.`
      parsed.interpretation = `Selección automática — petición original: "${prompt}"`
    }

    // Deduplicar por partido
    const seen = new Set<string>()
    const chosen: any[] = []
    const legReasons: string[] = []
    for (let k = 0; k < idx.length; k++) {
      const i = idx[k]
      const p = pool[i]
      if (seen.has(p.matchId ?? p.match)) continue
      seen.add(p.matchId ?? p.match)
      chosen.push(p)
      legReasons.push(parsed.leg_reasons?.[k] ?? `Edge positivo: modelo ${Math.round(p.prob * 100)}% vs implícita de cuota ${p.odd.toFixed(2)}`)
    }

    // Si tras deduplicar quedamos sin nada (edge case extremo)
    if (chosen.length === 0) {
      const fallback = pool.slice(0, 3)
      return Response.json(buildResponse(prompt, fallback, [],
        "Aquí tienes las selecciones más sólidas del pool de hoy.",
        `Selección alternativa para: "${prompt}"`))
    }

    return Response.json(buildResponse(
      prompt, chosen, legReasons,
      parsed.overall_reasoning ?? "",
      parsed.interpretation ?? "",
    ))

  } catch (e: any) {
    console.error("AI combinadas error:", e)
    return Response.json({ error: "Error procesando la petición. Inténtalo de nuevo." }, { status: 500 })
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

interface Intent {
  market: string | null
  league: string | null
  targetOdd: number | null
  numLegs: number | null
}

function detectIntent(prompt: string): Intent {
  const lower = prompt.toLowerCase()

  // Market detection
  let market: string | null = null
  if (/corner|córner|rincón|esquina/i.test(lower)) market = "corners"
  else if (/tarjeta|amarilla|rojas?\b|card/i.test(lower)) market = "tarjetas"
  else if (/btts|ambos.*marc|both.*score|\bgg\b/i.test(lower)) market = "btts"
  else if (/over\s*\d|más de \d|mas de \d|over gol/i.test(lower)) market = "over"
  else if (/under\s*\d|menos de \d|under gol/i.test(lower)) market = "under"
  else if (/hándicap|handicap|spread/i.test(lower)) market = "handicap"
  else if (/ganador|victoria|ganar|1x2|moneyline/i.test(lower)) market = "ganador"

  // League detection
  let league: string | null = null
  if (/premier|england|inglesa/i.test(lower)) league = "Premier League"
  else if (/laliga|la liga|española|spain|españa(?!.*liga)/i.test(lower)) league = "LaLiga"
  else if (/bundesliga|alemana|germany/i.test(lower)) league = "Bundesliga"
  else if (/serie a|italiana|italy/i.test(lower)) league = "Serie A"
  else if (/ligue 1|francesa|france/i.test(lower)) league = "Ligue 1"
  else if (/champions/i.test(lower)) league = "Champions League"
  else if (/europa league|uel/i.test(lower)) league = "Europa League"
  else if (/mls|estados unidos|major league/i.test(lower)) league = "MLS"
  else if (/argentina|arg\b/i.test(lower)) league = "Liga Argentina"
  else if (/brasil|brasileirão|bra\b/i.test(lower)) league = "Brasileirão"
  else if (/eredivisie|holanda|netherlands/i.test(lower)) league = "Eredivisie"
  else if (/turquía|turkey|süper lig/i.test(lower)) league = "Süper Lig"
  else if (/saudi|arabia/i.test(lower)) league = "Saudi Pro League"

  // Target odd
  const oddMatch = lower.match(/cuota\s+([0-9]+(?:[.,][0-9]+)?)/i)
  const targetOdd = oddMatch ? parseFloat(oddMatch[1].replace(",", ".")) : null

  // Num legs
  const legsMatch = lower.match(/(\d)\s*patas?|(\d)\s*picks?|combinada\s+de\s+(\d)/i)
  const numLegs = legsMatch
    ? parseInt(legsMatch[1] ?? legsMatch[2] ?? legsMatch[3])
    : null

  return { market, league, targetOdd, numLegs }
}

// Markets that map to pool market strings
const MARKET_ALIASES: Record<string, string[]> = {
  "ganador":   ["1X2", "Ganador"],
  "over":      ["Over/Under 2.5", "Over", "O/U"],
  "under":     ["Over/Under 2.5", "Under", "O/U"],
  "handicap":  ["Hándicap", "Handicap", "Spread"],
}

// Markets that are structurally unavailable (not in ESPN data feed)
const UNAVAILABLE_MARKETS = ["corners", "tarjetas", "btts"]

const MARKET_EXPLANATION: Record<string, string> = {
  corners: "El mercado de córners requiere estadísticas de tiros, centros y presión ofensiva por partido. La fuente de datos actual (ESPN scoreboard) no expone estos valores. Generamos picks solo con datos que podemos verificar.",
  tarjetas: "El mercado de tarjetas requiere datos de árbitro asignado, faltas por partido y agresividad histórica de los equipos. Estos datos no están disponibles en la fuente actual.",
  btts: "BTTS (ambos equipos marcan) es un mercado que podemos analizar parcialmente, pero no está en el pool de hoy porque la fuente no tiene xG ni xGA actualizados para todos los partidos.",
}

function isMarketInPool(market: string, poolMarkets: string[]): boolean {
  if (UNAVAILABLE_MARKETS.includes(market)) return false
  const aliases = MARKET_ALIASES[market] ?? [market]
  return aliases.some((alias) =>
    poolMarkets.some((pm) => pm.toLowerCase().includes(alias.toLowerCase()))
  )
}

function humanMarket(market: string): string {
  const map: Record<string, string> = {
    corners: "córners", tarjetas: "tarjetas",
    btts: "BTTS (ambos marcan)", over: "Over 2.5",
    under: "Under 2.5", handicap: "hándicap", ganador: "ganador (1X2)",
  }
  return map[market] ?? market
}

function buildAlternativeSuggestion(market: string, poolMarkets: string[]): string {
  const base = `Los mercados disponibles en el pool de hoy son: ${poolMarkets.join(", ")}.`
  if (market === "corners") {
    return `${base} Si te interesa el ataque, puedes pedir un Over 2.5 en partidos con alta presión ofensiva.`
  }
  if (market === "tarjetas") {
    return `${base} Para partidos con alta intensidad, considera Hándicap o 1X2 en derbis o eliminatorias.`
  }
  if (market === "btts") {
    return `${base} Puedes pedir Over 2.5 como alternativa cercana en partidos abiertos.`
  }
  return base
}

function buildExampleWithoutLeague(prompt: string): string {
  return prompt
    .replace(/premier|england|inglesa|laliga|la liga|españa|bundesliga|serie a|ligue 1|champions|mls|argentina|brasil|eredivisie|türkiye|saudi/gi, "")
    .replace(/\s+/g, " ").trim() || "combinada 3 patas cuota 4"
}

function filterPoolByIntent(items: any[], intent: Intent): any[] {
  let filtered = [...items]
  if (intent.league) {
    const leagueFiltered = filtered.filter((x) =>
      x.league.toLowerCase().includes(intent.league!.toLowerCase())
    )
    if (leagueFiltered.length >= 2) filtered = leagueFiltered
  }
  if (intent.market) {
    const aliases = MARKET_ALIASES[intent.market] ?? []
    const marketFiltered = filtered.filter((x) =>
      aliases.some((a) => x.market.toLowerCase().includes(a.toLowerCase()))
    )
    if (marketFiltered.length >= 2) filtered = marketFiltered
  }
  return filtered
}

function buildResponse(
  prompt: string,
  chosen: any[],
  legReasons: string[],
  overallReasoning: string,
  interpretation: string,
) {
  const combinedOdd = Math.round(chosen.reduce((a: number, l: any) => a * l.odd, 1) * 100) / 100
  const combinedProb = Math.round(chosen.reduce((a: number, l: any) => a * l.prob, 1) * 1000) / 10
  return {
    mode: "IA a medida",
    prompt,
    interpretation,
    ai_reasoning: overallReasoning,
    date: new Date().toISOString().split("T")[0],
    legs: chosen.map((l: any, i: number) => ({
      match: l.match,
      league: l.league,
      selection: l.selection,
      odd: l.odd,
      prob: Math.round(l.prob * 100),
      market: l.market,
      reasoning: legReasons[i] ?? l.reasoning,
    })),
    combined_odd: combinedOdd,
    combined_prob: combinedProb,
  }
}
