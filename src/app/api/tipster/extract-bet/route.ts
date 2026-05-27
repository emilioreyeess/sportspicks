/**
 * POST /api/tipster/extract-bet
 * Receives a base64 bet-slip image, returns structured bet data via Claude Vision.
 */
import { NextRequest } from "next/server"
import Anthropic from "@anthropic-ai/sdk"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return Response.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 })

  let body: { imageBase64: string; mimeType?: string }
  try { body = await req.json() } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }
  if (!body.imageBase64) return Response.json({ error: "imageBase64 required" }, { status: 400 })

  const client = new Anthropic({ apiKey })

  const prompt = `Analiza esta captura de pantalla de un boleto de apuestas deportivas.
Extrae los datos en formato JSON con esta estructura exacta:
{
  "title": "nombre descriptivo de la apuesta",
  "legs": [
    { "match": "equipo1 vs equipo2 o nombre del mercado", "selection": "selección exacta", "odds": 1.50 }
  ],
  "combinedOdds": 4.26,
  "totalStake": 10.00
}

Reglas:
- Si el boleto tiene cuota combinada visible, úsala en combinedOdds. Si no, multiplica las cuotas individuales.
- Si las cuotas individuales no están visibles, estímalas en 1.00 (no inventes).
- El campo "match" puede ser el partido (Mallorca vs Betis) o el mercado si no hay partido claro.
- Incluye TODAS las selecciones que veas.
- Responde SOLO con el JSON, sin explicaciones ni markdown.`

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: (body.mimeType as any) ?? "image/jpeg",
              data: body.imageBase64,
            },
          },
          { type: "text", text: prompt },
        ],
      }],
    })

    const raw = (msg.content[0] as any).text?.trim() ?? ""
    // Strip markdown code fences if present
    const json = raw.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim()
    const data = JSON.parse(json)

    return Response.json({ ok: true, bet: data })
  } catch (e: any) {
    console.error("[extract-bet]", e?.message)
    return Response.json({ error: "No se pudo leer el boleto", detail: e?.message }, { status: 422 })
  }
}
