import { NextRequest } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { getStore } from "@/lib/store"
import { ensureWarm } from "@/lib/pipeline"
import { consume, getClientIp, tooManyRequests } from "@/lib/rate-limit"

export const runtime = "nodejs"
export const maxDuration = 60

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

/**
 * Combinada IA por prompt — feature PREMIUM+.
 * Usa Claude para elegir patas del POOL real precomputado.
 *
 * Comportamiento ante peticiones ambiguas o sin coincidencia exacta:
 *  → Interpreta la intención, busca lo más cercano y explica qué encontró.
 *  → NUNCA devuelve error si hay alguna selección disponible en el pool.
 *  → Solo falla si el pool está vacío o la petición es imposible de cumplir.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  if (!consume(`ai-combi:${ip}`, 3, 0.4)) return tooManyRequests(180)

  await ensureWarm()

  let body: any
  try { body = await req.json() } catch { return Response.json({ error: "JSON inválido" }, { status: 400 }) }
  const prompt: string = (body?.prompt ?? "").trim()
  if (!prompt) return Response.json({ error: "Describe qué combinada quieres." }, { status: 400 })
  if (prompt.length > 500) return Response.json({ error: "Prompt demasiado largo (máx. 500 caracteres)." }, { status: 400 })

  const pool = getStore().combinadaPool
  if (!pool?.length) return Response.json({ error: "Sin selecciones disponibles en el pool de hoy. Vuelve en unos segundos." }, { status: 422 })

  // Vista compacta del pool para Claude
  const items = pool.map((p: any, i: number) => ({
    i,
    match: p.match,
    league: p.league,
    market: p.market,
    selection: p.selection,
    odd: p.odd,
    prob: Math.round(p.prob * 100),
    reasoning: p.reasoning?.slice(0, 80),
  }))

  const sys = `Eres SportsPicks AI Combinator. Tu misión: construir combinadas a medida desde un POOL de selecciones reales con cuotas reales.

═══════════════════════════════════
REGLAS ABSOLUTAS
═══════════════════════════════════
1. Solo puedes usar índices del POOL. NUNCA inventes partidos, cuotas ni selecciones.
2. Una sola selección por partido (no duplicar "match").
3. Siempre devuelve entre 2 y 5 patas. Nunca 0.

═══════════════════════════════════
CÓMO INTERPRETAR LA PETICIÓN
═══════════════════════════════════
Interpreta SIEMPRE la intención del usuario, aunque sea ambigua o imprecisa:

• "cuota 3" o "cuota 5" → selecciona patas cuya cuota combinada se acerque a ese valor.
• "segura" → prioriza probabilidades ≥ 60%.
• "soñadora" o "dream" → acepta cuotas más altas y probabilidades ≥ 40%.
• "BTTS" → busca selecciones "BTTS" o "Ambos equipos marcan" en el pool.
• "corners" → si no hay corners en el pool, busca Over/Under como alternativa cercana y explícalo.
• Liga o equipo concreto → filtra por esa liga/equipo; si no hay, elige de la liga más similar y explícalo.
• "Segunda División" / "2ª división" → si no existe, ofrece LaLiga o liga equivalente del pool.
• Mercado no disponible (corners, tarjetas, etc.) → si no hay en el pool, elige la selección más alineada con el espíritu (equipos atacantes, partidos con alta intensidad) y explica la alternativa.

NUNCA bloquees la generación por un mercado o liga que no esté en el pool.
Si la petición exacta no existe, ADAPTA y EXPLICA en el campo "reasoning".

═══════════════════════════════════
NÚMERO DE PATAS
═══════════════════════════════════
• El usuario no lo dice → usa 3 patas por defecto.
• "cuota X" → ajusta el número de patas para que la cuota combinada se acerque a X.
• "combinada de N patas" → usa N patas (mínimo 2, máximo 5).

═══════════════════════════════════
RESPUESTA
═══════════════════════════════════
Devuelve ÚNICAMENTE este JSON válido. Sin markdown, sin texto extra:
{
  "selected": [índices del pool],
  "reasoning": "Explica en 1-2 frases qué encontraste y cómo lo adaptaste si fue necesario. Menciona la cuota aproximada lograda.",
  "interpretation": "Cómo interpretaste la petición del usuario (ej: 'Interpreté: combinada Over/Under LaLiga cuota ~3.5')"
}`

  const userMsg = `POOL del día (${items.length} selecciones reales):
${JSON.stringify(items)}

PETICIÓN DEL USUARIO: "${prompt}"

Recuerda: devuelve SIEMPRE entre 2 y 5 patas. Si la petición exacta no existe en el pool, adáptate a lo más cercano y explícalo en "reasoning". NUNCA devuelvas selected vacío.

Devuelve el JSON.`

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 1500,
      system: sys,
      messages: [{ role: "user", content: userMsg }],
    })

    const blocks = response.content as any[]
    const text: string = blocks.find((b) => b.type === "text")?.text ?? "{}"
    const cleaned = text.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim()

    let parsed: { selected?: number[]; reasoning?: string; interpretation?: string } = {}
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      const m = cleaned.match(/\{[\s\S]*\}/)
      if (m) { try { parsed = JSON.parse(m[0]) } catch {} }
    }

    let idx = (parsed.selected ?? []).filter(
      (n): n is number => typeof n === "number" && n >= 0 && n < pool.length
    )

    // Fallback: si Claude devolvió vacío, elegimos las 3 mejores por probabilidad
    if (idx.length === 0) {
      const topByProb = [...items]
        .sort((a, b) => b.prob - a.prob)
        .slice(0, 3)
        .map((x) => x.i)
      idx = topByProb
      parsed.reasoning = `No encontré selecciones exactas para "${prompt}". Aquí tienes las 3 selecciones con mayor probabilidad del pool de hoy como alternativa.`
      parsed.interpretation = `Alternativa automática — petición original: "${prompt}"`
    }

    // Deduplica por partido (una sola selección por match)
    const seen = new Set<string>()
    const chosen: any[] = []
    for (const i of idx) {
      const p = pool[i]
      if (seen.has(p.matchId)) continue
      seen.add(p.matchId)
      chosen.push(p)
    }

    // Segunda seguridad: si elegidos está vacío (todos duplicados), tomamos los top 3
    if (chosen.length === 0) {
      const fallback = pool.slice(0, 3)
      return Response.json({
        mode: "IA a medida",
        prompt,
        interpretation: `Selección alternativa (pool sin duplicados disponibles para: "${prompt}")`,
        ai_reasoning: "Aquí tienes las selecciones más sólidas del pool de hoy.",
        date: new Date().toISOString().split("T")[0],
        legs: fallback.map((l: any) => ({
          match: l.match, league: l.league, selection: l.selection,
          odd: l.odd, prob: Math.round(l.prob * 100), market: l.market,
          reasoning: l.reasoning,
        })),
        combined_odd: Math.round(fallback.reduce((a: number, l: any) => a * l.odd, 1) * 100) / 100,
        combined_prob: Math.round(fallback.reduce((a: number, l: any) => a * l.prob, 1) * 1000) / 10,
      })
    }

    return Response.json({
      mode: "IA a medida",
      prompt,
      interpretation: parsed.interpretation ?? "",
      ai_reasoning: parsed.reasoning ?? "",
      date: new Date().toISOString().split("T")[0],
      legs: chosen.map((l: any) => ({
        match: l.match, league: l.league, selection: l.selection,
        odd: l.odd, prob: Math.round(l.prob * 100), market: l.market,
        reasoning: l.reasoning,
      })),
      combined_odd: Math.round(chosen.reduce((a: number, l: any) => a * l.odd, 1) * 100) / 100,
      combined_prob: Math.round(chosen.reduce((a: number, l: any) => a * l.prob, 1) * 1000) / 10,
    })

  } catch (e: any) {
    console.error("AI combinadas error:", e)
    return Response.json({ error: "Error procesando la petición. Inténtalo de nuevo." }, { status: 500 })
  }
}
