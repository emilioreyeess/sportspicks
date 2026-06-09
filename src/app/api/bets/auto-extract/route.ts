/**
 * POST /api/bets/auto-extract
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Pipeline OCR end-to-end: el cliente sube UNA imagen y el servidor
 *   1. la guarda en Supabase Storage (bucket `bet-images`)
 *   2. la procesa con Claude Vision para extraer estructura
 *   3. inserta `bets` + `bet_legs` con flag `needs_review` si la confianza baja
 *   4. devuelve el bet creado (con id) para que la UI navegue al detalle
 *
 * El usuario NO toca el teclado. Si algo no se puede extraer con seguridad,
 * `needs_review = true` y el bet aparece marcado en /historico para revisión
 * visual antes de publicarse.
 *
 * Body (multipart/form-data):
 *   · file       — image/jpeg|png|webp|gif (≤ 5 MB)
 *   · sport?     — football|basketball|… (default 'football')
 *   · publish?   — 'true'|'false' (default false → es_published=false)
 */
import { NextRequest } from "next/server"
import { getServerSession } from "@/lib/auth-server"
import { revalidatePath } from "next/cache"
import Anthropic from "@anthropic-ai/sdk"
import { createServiceClient } from "@/lib/supabase/client"
import { consume, getClientIp, tooManyRequests } from "@/lib/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

const MAX_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]
const VALID_SPORTS = ["football", "basketball", "tennis", "baseball", "hockey", "other"]

// Modelo fijo — golden rule del proyecto: snapshot 20250929 para Claude Sonnet.
// Para Vision usamos haiku (más rápido y barato), snapshot oficial.
const CLAUDE_VISION_MODEL = "claude-haiku-4-5-20251001"

interface ExtractedLeg {
  match: string
  market?: string | null
  selection: string
  odds: number
}
interface ExtractedBet {
  title: string
  sport?: string
  totalStake: number | null
  combinedOdds: number | null
  legs: ExtractedLeg[]
  bookmaker?: string | null
  notes?: string | null
}

/* ────────────────────────────────────────────────────────────────────────────
   Vision prompt
   ──────────────────────────────────────────────────────────────────────────── */

const PROMPT = `Analiza esta captura de un boleto de apuestas deportivas.

Extrae los datos en formato JSON ESTRICTO con esta estructura exacta:
{
  "title": "string corto y descriptivo (Real Madrid vs Barça · 1X2, o '4 selecciones · La Liga')",
  "sport": "football | basketball | tennis | baseball | hockey | other",
  "totalStake": 10.00 | null,
  "combinedOdds": 4.26 | null,
  "bookmaker": "Bet365 | Betfair | Codere | DraftKings | …" | null,
  "legs": [
    {
      "match": "Equipo1 vs Equipo2",
      "market": "1X2 | Hándicap | Over/Under 2.5 | BTTS | Córners | …" | null,
      "selection": "selección exacta (Gana Equipo1, Over 2.5, Hándicap +0.5, Sí, …)",
      "odds": 1.50
    }
  ]
}

REGLAS ANTI-INVENCIÓN:
- Si el stake o la cuota combinada NO son visibles → null. NUNCA inventes.
- Si las cuotas individuales no son legibles → odds = 1.00 (placeholder).
- Si el partido es ambiguo (logo recortado, nombre cortado), pon en "match"
  lo que VEAS literalmente.
- Incluye TODAS las selecciones visibles, en orden.
- Responde SOLO con el JSON, sin markdown ni explicaciones.`

/* ────────────────────────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────────────────────────── */

/** Recorta a un JSON válido desde la respuesta de Claude (anti basura). */
function extractJSON(raw: string): any | null {
  const start = raw.indexOf("{")
  const end = raw.lastIndexOf("}")
  if (start < 0 || end < 0 || end <= start) return null
  try { return JSON.parse(raw.slice(start, end + 1)) } catch { return null }
}

/**
 * Calcula un score de confianza simple a partir de la calidad del extract.
 * 0..1 — sirve para decidir `needs_review` y mostrarlo al usuario.
 */
function scoreExtraction(b: ExtractedBet): { confidence: number; reasons: string[] } {
  const reasons: string[] = []
  let score = 1.0
  if (!b.title || b.title.length < 3)         { score -= 0.20; reasons.push("título vacío o muy corto") }
  if (b.totalStake == null)                    { score -= 0.15; reasons.push("stake no detectado") }
  if (b.combinedOdds == null)                  { score -= 0.10; reasons.push("cuota combinada no detectada") }
  if (!Array.isArray(b.legs) || b.legs.length === 0) {
    score -= 0.40; reasons.push("sin selecciones")
  } else {
    const placeholders = b.legs.filter((l) => Number(l.odds) === 1).length
    if (placeholders > 0) { score -= 0.05 * placeholders; reasons.push(`${placeholders} cuotas como placeholder`) }
    const noSelection = b.legs.filter((l) => !l.selection || l.selection.length < 2).length
    if (noSelection > 0)  { score -= 0.10 * noSelection;  reasons.push(`${noSelection} legs sin selección`) }
  }
  return { confidence: Math.max(0, Math.min(1, Math.round(score * 1000) / 1000)), reasons }
}

/** Producto de cuotas — fallback cuando combinedOdds viene null pero hay legs. */
function productOdds(legs: ExtractedLeg[]): number | null {
  if (!legs.length) return null
  const p = legs.reduce((acc, l) => acc * (Number(l.odds) || 1), 1)
  return p > 1 ? Math.round(p * 100) / 100 : null
}

/* ────────────────────────────────────────────────────────────────────────────
   Handler
   ──────────────────────────────────────────────────────────────────────────── */

export async function POST(req: NextRequest) {
  const session = await getServerSession()
  if (!session?.user?.email) {
    return Response.json({ error: "No autorizado" }, { status: 401 })
  }

  const ip = getClientIp(req)
  // 5 extracciones/min por IP — Claude Vision cuesta dinero, no spameamos.
  if (!consume(`bet-auto-extract:${ip}`, 5, 1)) return tooManyRequests(60)

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return Response.json({ error: "Servicio de extracción no disponible" }, { status: 503 })

  /* ── 1. Parsear FormData ─────────────────────────────────────────────── */
  let formData: FormData
  try { formData = await req.formData() } catch {
    return Response.json({ error: "Cuerpo inválido" }, { status: 400 })
  }
  const file = formData.get("file") as File | null
  if (!file) return Response.json({ error: "No se proporcionó archivo" }, { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type)) {
    return Response.json({ error: "Tipo de archivo no soportado (JPG/PNG/GIF/WebP)" }, { status: 415 })
  }
  if (file.size > MAX_SIZE) {
    return Response.json({ error: "Imagen demasiado grande (máx. 5 MB)" }, { status: 413 })
  }

  const sportInput = (formData.get("sport") as string | null) ?? "football"
  const sport = VALID_SPORTS.includes(sportInput) ? sportInput : "football"
  const publish = String(formData.get("publish") ?? "").toLowerCase() === "true"

  const sb = createServiceClient()

  /* ── 2. Subir a Storage ──────────────────────────────────────────────── */
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const ext = file.type.split("/")[1] ?? "jpg"
  const emailHash = Buffer.from(session.user.email).toString("base64url").slice(0, 12)
  const storagePath = `${emailHash}/${Date.now()}.${ext}`

  const { error: uploadErr } = await sb.storage
    .from("bet-images")
    .upload(storagePath, buffer, { contentType: file.type, upsert: false })
  if (uploadErr) {
    console.error("[/api/bets/auto-extract] storage error:", uploadErr.message)
    return Response.json({ error: "Error al subir la imagen" }, { status: 500 })
  }
  const { data: publicData } = sb.storage.from("bet-images").getPublicUrl(storagePath)
  const imageUrl = publicData.publicUrl

  /* ── 3. Claude Vision → JSON estructurado ───────────────────────────── */
  const client = new Anthropic({ apiKey })
  let extracted: ExtractedBet
  let rawResponse = ""
  try {
    const msg = await client.messages.create({
      model: CLAUDE_VISION_MODEL,
      max_tokens: 1500,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: file.type as any,
              data: buffer.toString("base64"),
            },
          },
          { type: "text", text: PROMPT },
        ],
      }],
    })
    rawResponse = (msg.content[0] as any).text?.trim() ?? ""
    const parsed = extractJSON(rawResponse)
    if (!parsed) {
      console.error("[/api/bets/auto-extract] no JSON in response:", rawResponse.slice(0, 300))
      return Response.json({ error: "No se pudo interpretar el boleto" }, { status: 422 })
    }
    extracted = parsed as ExtractedBet
  } catch (e: any) {
    console.error("[/api/bets/auto-extract] vision error:", e?.message ?? e)
    return Response.json({ error: "Error en el servicio de visión" }, { status: 502 })
  }

  /* ── 4. Saneamiento + scoring ──────────────────────────────────────── */
  const safeLegs: ExtractedLeg[] = (Array.isArray(extracted.legs) ? extracted.legs : [])
    .slice(0, 20)
    .map((l) => ({
      match:     (l.match ?? "").toString().slice(0, 200),
      market:    l.market ? l.market.toString().slice(0, 80) : null,
      selection: (l.selection ?? "").toString().slice(0, 200),
      odds:      Math.max(1, Math.min(10000, Number(l.odds) || 1)),
    }))
    .filter((l) => l.selection.length > 0)

  const combinedOdds =
    extracted.combinedOdds != null && Number(extracted.combinedOdds) > 1
      ? Math.round(Number(extracted.combinedOdds) * 100) / 100
      : productOdds(safeLegs) ?? 1

  // ── REGLA R1 (stake null-safe) ────────────────────────────────────────────
  // Si Vision NO detectó el stake (totalStake == null) o devolvió algo no
  // numérico, `stakeValue` queda `null` — NUNCA 0. Un 0 sería un stake
  // fantasma indistinguible de una apuesta real de 0€. El null fuerza el
  // input manual del usuario en el editor de revisión.
  const stakeValue: number | null =
    extracted.totalStake != null && isFinite(Number(extracted.totalStake)) && Number(extracted.totalStake) >= 0
      ? Math.min(100_000, Math.round(Number(extracted.totalStake) * 100) / 100)
      : null

  const cleanBet: ExtractedBet = {
    title: (extracted.title ?? "").toString().slice(0, 200) || "Apuesta sin título",
    sport: extracted.sport && VALID_SPORTS.includes(extracted.sport) ? extracted.sport : sport,
    totalStake: stakeValue,           // number | null — coherente con ExtractedBet
    combinedOdds,
    legs: safeLegs,
    bookmaker: extracted.bookmaker ? extracted.bookmaker.toString().slice(0, 60) : null,
    notes: extracted.notes ? extracted.notes.toString().slice(0, 500) : null,
  }
  const { confidence, reasons } = scoreExtraction(cleanBet)

  // ── VALIDACIÓN CRUZADA OBLIGATORIA ────────────────────────────────────────
  // needs_review se fuerza a `true` si CUALQUIERA de estas condiciones se cumple:
  //   · confianza global del OCR < 0.7
  //   · stake no detectado (stakeValue === null)   ← regla R1
  //   · cuota combinada no detectada
  // No hay forma de que un bet con stake null llegue a producción sin revisión.
  const needsReview: boolean =
    confidence < 0.70 ||
    stakeValue === null ||
    extracted.combinedOdds == null

  // potential_return solo se calcula si HAY stake; si es null, queda null
  // (no inventamos un retorno sobre un stake fantasma).
  const potentialReturn: number | null =
    stakeValue !== null
      ? Math.round(stakeValue * (cleanBet.combinedOdds ?? 1) * 100) / 100
      : null

  /* ── 5. INSERT bets + bet_legs ────────────────────────────────────── */
  // Payload tipado explícitamente: stake y potential_return admiten null
  // (alineado con la migración bets-stake-nullable-migration.sql que quitó
  // el DEFAULT 0). is_published nunca true mientras needsReview sea true.
  const betPayload: {
    user_email: string
    title: string
    stake: number | null
    combined_odds: number
    potential_return: number | null
    status: string
    is_pre_match: boolean
    is_published: boolean
    ai_analyzed: boolean
    sport: string
    notes: string | null
    image_url: string
    needs_review: boolean
    ai_confidence: number
    ai_extracted_at: string
    created_at: string
  } = {
    user_email:       session.user.email,
    title:            cleanBet.title,
    stake:            stakeValue,                   // number | null — sin fallback a 0
    combined_odds:    cleanBet.combinedOdds ?? 1,
    potential_return: potentialReturn,              // number | null
    status:           "pending",
    is_pre_match:     true,
    is_published:     publish && !needsReview,      // jamás publica si needs_review
    ai_analyzed:      true,
    sport:            cleanBet.sport ?? sport,
    notes:            cleanBet.notes,
    image_url:        imageUrl,
    needs_review:     needsReview,                  // forzado por validación cruzada
    ai_confidence:    confidence,
    ai_extracted_at:  new Date().toISOString(),
    created_at:       new Date().toISOString(),
  }

  const { data: insertedBet, error: betErr } = await sb
    .from("bets")
    .insert(betPayload)
    .select()
    .single()

  if (betErr || !insertedBet) {
    console.error("[/api/bets/auto-extract] bets insert error:", betErr?.message)
    // Limpia la imagen huérfana en Storage si el insert falló
    await sb.storage.from("bet-images").remove([storagePath]).catch(() => {})
    return Response.json({ error: "Error al guardar la apuesta" }, { status: 500 })
  }

  if (cleanBet.legs.length > 0) {
    const legRows = cleanBet.legs.map((l) => ({
      bet_id:    insertedBet.id,
      match:     l.match || "—",
      market:    l.market,
      selection: l.selection,
      odds:      l.odds,
      status:    "pending",
    }))
    const { error: legsErr } = await sb.from("bet_legs").insert(legRows)
    if (legsErr) console.warn("[/api/bets/auto-extract] legs insert warn:", legsErr.message)
  }

  /* ── 6. Revalidación de caché — /historico y /bets ya frescos ──────── */
  try {
    revalidatePath("/historico")
    revalidatePath("/bets")
  } catch { /* fuera de App Router context — no crítico */ }

  /* ── 7. Respuesta ──────────────────────────────────────────────────── */
  return Response.json({
    ok: true,
    bet: {
      id:            insertedBet.id,
      title:         cleanBet.title,
      stake:         cleanBet.totalStake,
      combined_odds: cleanBet.combinedOdds,
      legs:          cleanBet.legs,
      image_url:     imageUrl,
      needs_review:  needsReview,
      ai_confidence: confidence,
      bookmaker:     cleanBet.bookmaker,
    },
    review: {
      needsReview,
      confidence,
      reasons,
    },
  }, { status: 201 })
}
