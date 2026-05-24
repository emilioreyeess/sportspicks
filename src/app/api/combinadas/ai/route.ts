import { NextRequest } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { getStore } from "@/lib/store"
import { ensureWarm } from "@/lib/pipeline"
import { consume, getClientIp, tooManyRequests } from "@/lib/rate-limit"

export const runtime = "nodejs"
export const maxDuration = 60

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

/**
 * Combinada IA por prompt — feature PRO.
 * Usa Claude para elegir patas del POOL real precomputado en función de la petición
 * del usuario (ej. "cuota 3", "solo LaLiga", "BTTS y Premier", "combinada Madrid-Barça").
 * NUNCA inventa selecciones: solo escoge del pool real con cuotas reales DraftKings.
 */
export async function POST(req: NextRequest) {
  // Rate limit estricto — endpoint cuesta dinero por llamada a Anthropic
  // 2 ráfaga · 1 cada 5 min sostenido. Protege el saldo de la API key.
  const ip = getClientIp(req)
  if (!consume(`ai-combi:${ip}`, 2, 0.2)) return tooManyRequests(300)

  await ensureWarm()

  let body: any
  try { body = await req.json() } catch { return Response.json({ error: "JSON inválido" }, { status: 400 }) }
  const prompt: string = (body?.prompt ?? "").trim()
  if (!prompt) return Response.json({ error: "Falta el prompt." }, { status: 400 })
  if (prompt.length > 400) return Response.json({ error: "Prompt demasiado largo (máx. 400 caracteres)." }, { status: 400 })

  const pool = getStore().combinadaPool
  if (!pool?.length) return Response.json({ error: "Sin selecciones disponibles. Vuelve en unos segundos." }, { status: 422 })

  // Vista compacta del pool para Claude
  const items = pool.map((p: any, i: number) => ({
    i, match: p.match, league: p.league,
    market: p.market, selection: p.selection,
    odd: p.odd, prob: Math.round(p.prob * 100),
  }))

  const sys = `Eres SportsPicks AI Combinator. Construyes combinadas a medida desde un POOL REAL de selecciones del día con cuotas reales DraftKings y probabilidades del modelo Poisson.

REGLAS ESTRICTAS:
- Solo puedes elegir índices del POOL proporcionado. NUNCA inventes selecciones, partidos ni cuotas.
- Una pata por partido (no duplicar match).
- N legs según lo que pida el usuario; por defecto 3 si no lo dice.
- Si pide "cuota X", elige patas cuyo producto se acerque a X.
- Si pide "segura": prioriza probabilidades altas (≥55%).
- Si pide "soñadora": permite cuotas más altas (1.8+).
- Si pide un equipo/liga/mercado concreto, filtra por eso.

RESPUESTA: devuelve ÚNICAMENTE JSON válido con esta forma exacta. Nada de markdown ni texto extra:
{"selected": [índices del pool], "reasoning": "explicación breve en español"}`

  const userMsg = `POOL del día (${items.length} selecciones reales):\n${JSON.stringify(items)}\n\nPETICIÓN: "${prompt}"\n\nDevuelve el JSON.`

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 1200,
      system: sys,
      messages: [{ role: "user", content: userMsg }],
    })
    const blocks = response.content as any[]
    const text: string = blocks.find((b) => b.type === "text")?.text ?? "{}"
    // Limpia posibles fences markdown
    const cleaned = text.replace(/```(?:json)?/gi, "").trim()
    let parsed: { selected?: number[]; reasoning?: string } = {}
    try { parsed = JSON.parse(cleaned) } catch {
      const m = cleaned.match(/\{[\s\S]*\}/)
      if (m) { try { parsed = JSON.parse(m[0]) } catch {} }
    }

    const idx = (parsed.selected ?? []).filter((n): n is number => typeof n === "number" && n >= 0 && n < pool.length)
    if (idx.length === 0) {
      return Response.json({ error: "La IA no devolvió selecciones válidas. Reformula el prompt." }, { status: 422 })
    }

    const seen = new Set<string>()
    const chosen: any[] = []
    for (const i of idx) {
      const p = pool[i]
      if (seen.has(p.matchId)) continue
      seen.add(p.matchId)
      chosen.push(p)
    }
    if (chosen.length === 0) {
      return Response.json({ error: "Selecciones duplicadas — prueba otro prompt." }, { status: 422 })
    }

    return Response.json({
      mode: "IA a medida",
      prompt,
      ai_reasoning: parsed.reasoning ?? "",
      date: new Date().toISOString().split("T")[0],
      legs: chosen.map((l: any) => ({
        match: l.match, league: l.league, selection: l.selection,
        odd: l.odd, prob: Math.round(l.prob * 100), market: l.market,
        reasoning: l.reasoning,
      })),
      combined_odd: Math.round(chosen.reduce((a, l) => a * l.odd, 1) * 100) / 100,
      combined_prob: Math.round(chosen.reduce((a, l) => a * l.prob, 1) * 1000) / 10,
    })
  } catch (e: any) {
    // No filtrar detalles internos al cliente
    console.error("AI combinadas error:", e)
    return Response.json({ error: "La IA no pudo procesar la petición. Inténtalo de nuevo en un momento." }, { status: 500 })
  }
}
