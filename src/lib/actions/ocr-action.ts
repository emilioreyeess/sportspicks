"use server"

/**
 * Server Action — OCR REAL del ticket de apuesta con Claude Vision.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Reemplaza el mock `extractBetData`. Recibe la imagen vía FormData, la pasa a
 * Claude (Vision) y devuelve { match_text, odds, stake }.
 *
 * NOTA DE MODELO: el prompt original pedía `claude-3-5-sonnet-20240620`, pero
 * la regla de oro del proyecto fija el snapshot válido (otras fechas → 500
 * silencioso en prod). Usamos `claude-haiku-4-5-20251001`, el modelo de visión
 * ya validado en las rutas OCR existentes (auto-extract / extract-bet): más
 * rápido y barato para OCR, y sin riesgo de snapshot inválido.
 *
 * Nunca lanza al cliente: ante cualquier fallo devuelve nulls para que el modal
 * se abra vacío y el usuario rellene a mano.
 */

import Anthropic from "@anthropic-ai/sdk"

const VISION_MODEL = "claude-haiku-4-5-20251001"
const ALLOWED_MEDIA = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"])
const MAX_BYTES = 5 * 1024 * 1024

interface OcrResult {
  match_text: string | null
  odds: number | null
  stake: number | null
}

const EMPTY: OcrResult = { match_text: null, odds: null, stake: null }

const SYSTEM_PROMPT =
  "Eres un sistema OCR de apuestas. Extrae del ticket: 1. Nombres de los equipos " +
  "que juegan (ej: 'Real Madrid vs FC Barcelona'), 2. Cuota (odds, número decimal), " +
  "3. Importe apostado (stake, número). Devuelve ÚNICAMENTE un objeto JSON con esta " +
  'estructura exacta: { "match_text": string | null, "odds": number | null, ' +
  '"stake": number | null }. No uses bloques de código (```json), no añadas saludos, ' +
  "SOLO el JSON crudo."

export async function extractBetDataReal(formData: FormData): Promise<OcrResult> {
  try {
    const file = formData.get("image")
    if (!(file instanceof File)) return EMPTY

    const mediaType = ALLOWED_MEDIA.has(file.type) ? file.type : "image/jpeg"
    if (file.size === 0 || file.size > MAX_BYTES) return EMPTY

    // ArrayBuffer → Buffer → base64
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64")

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      console.error("[ocr-action] ANTHROPIC_API_KEY no configurada")
      return EMPTY
    }

    const client = new Anthropic({ apiKey })
    const msg = await client.messages.create({
      model: VISION_MODEL,
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType as any, data: base64 } },
            { type: "text", text: "Extrae los datos de este ticket de apuesta." },
          ],
        },
      ],
    })

    const raw = (msg.content[0] as any)?.text?.trim() ?? ""
    // Defensa: si el modelo devolviera ```json pese a la instrucción, lo limpiamos.
    const cleaned = raw.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim()
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (!match) return EMPTY

    const parsed = JSON.parse(match[0]) as Partial<OcrResult>
    const num = (v: unknown): number | null => {
      const n = typeof v === "number" ? v : parseFloat(String(v))
      return Number.isFinite(n) ? n : null
    }
    return {
      match_text: typeof parsed.match_text === "string" && parsed.match_text.trim() ? parsed.match_text.trim() : null,
      odds: num(parsed.odds),
      stake: num(parsed.stake),
    }
  } catch (e) {
    // Cero crash en el cliente: nulls → modal vacío para relleno manual.
    console.error("[ocr-action] fallo OCR:", e instanceof Error ? e.message : e)
    return EMPTY
  }
}
