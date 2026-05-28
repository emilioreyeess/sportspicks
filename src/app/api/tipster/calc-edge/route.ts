/**
 * POST /api/tipster/calc-edge
 * Recibe las selecciones del boleto, devuelve probabilidad IA y edge
 * calculados por Claude a partir de las cuotas de mercado.
 *
 * Rate limit: 10 por minuto por IP.
 */
import { NextRequest } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { consume, getClientIp, tooManyRequests } from "@/lib/rate-limit"

export const runtime = "nodejs"

interface Leg { match: string; selection: string; odds: number }

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  if (!consume(`calc-edge:${ip}`, 10, 10 / 60)) return tooManyRequests(60)

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return Response.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 })

  let body: { legs: Leg[] }
  try { body = await req.json() } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const legs: Leg[] = (body.legs ?? [])
    .filter((l) => l.match && l.selection && l.odds >= 1.01)
    .slice(0, 20)

  if (legs.length === 0) {
    return Response.json({ error: "Sin selecciones válidas" }, { status: 400 })
  }

  // Probabilidad implícita del bookmaker para cada leg y combinada
  const impliedPerLeg = legs.map((l) => 1 / l.odds)
  const impliedCombined = impliedPerLeg.reduce((a, b) => a * b, 1)

  const legsText = legs.map((l, i) =>
    `Leg ${i + 1}: ${l.match} → "${l.selection}" @${l.odds} (implícita bookmaker: ${(impliedPerLeg[i] * 100).toFixed(1)}%)`
  ).join("\n")

  const prompt = `Eres un analista estadístico de apuestas deportivas. Analiza estas selecciones y estima la probabilidad REAL de ganancia para cada una, considerando las cuotas de mercado como referencia base.

SELECCIONES:
${legsText}

CUOTA COMBINADA DEL BOLETO: @${legs.reduce((p, l) => p * l.odds, 1).toFixed(2)} (implícita bookmaker: ${(impliedCombined * 100).toFixed(1)}%)

INSTRUCCIONES:
- Para cada leg, estima la probabilidad real (0.01–0.99) teniendo en cuenta:
  • Las cuotas del bookmaker ya incluyen un margen del 5–10%
  • La calidad relativa de cada selección (mercados populares = mayor eficiencia)
  • No inventes información que no tengas; usa las cuotas como guía principal
- El edge = (prob_combinada_estimada - prob_implícita_bookmaker) / prob_implícita_bookmaker × 100

Responde SOLO con JSON, sin markdown ni explicaciones:
{
  "legs": [{"prob": 0.62}, {"prob": 0.48}],
  "combined_prob": 0.30,
  "edge": 8.5
}`

  try {
    const client = new Anthropic({ apiKey })
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      messages: [{ role: "user", content: prompt }],
    })

    const raw = (msg.content[0] as any).text?.trim() ?? ""
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return Response.json({ error: "No JSON in response" }, { status: 422 })

    const data = JSON.parse(match[0])

    // Sanitize values
    const legProbs: number[] = (data.legs ?? []).map((l: any) =>
      Math.min(0.99, Math.max(0.01, parseFloat(l.prob) || 0.5))
    )
    // Recalculate combined from individual probs for consistency
    const combinedProb = legProbs.reduce((a, b) => a * b, 1)
    const edge = ((combinedProb - impliedCombined) / impliedCombined) * 100

    return Response.json({
      ok: true,
      legs: legProbs,
      combined_prob: Math.round(combinedProb * 1000) / 10,   // percentage, 1 decimal
      edge: Math.round(edge * 10) / 10,
    })
  } catch (e: any) {
    console.error("[calc-edge] error:", e?.message)
    return Response.json({ error: "Error al calcular edge", detail: e?.message }, { status: 422 })
  }
}
