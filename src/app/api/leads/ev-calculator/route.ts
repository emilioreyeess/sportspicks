/**
 * POST /api/leads/ev-calculator
 *
 * Captura de leads del Lead Magnet de la Calculadora EV.
 * Trazabilidad legal RGPD: solo persiste si el consentimiento es estrictamente
 * `true` (art. 6.1.a). Guarda timestamp e IP para prueba de consentimiento.
 *
 * Tabla `leads`:
 *   · email         text  PK/Unique
 *   · source        text  ('ev_calculator')
 *   · consent_gdpr  boolean
 *   · consent_at    timestamptz  (prueba de cuándo se otorgó)
 *   · ip_hash       text         (prueba de origen, hash no reversible)
 */

import { NextRequest, NextResponse } from "next/server"
import { createHash } from "crypto"
import { createServiceClient } from "@/lib/supabase/client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// RFC 5322 simplificado — suficiente y seguro (sin catastrophic backtracking).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_EMAIL_LEN = 254  // límite RFC 3696

/** Hash no reversible de la IP para prueba de origen sin almacenar PII directa. */
function hashIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for") ?? ""
  const ip = fwd.split(",")[0].trim() || "unknown"
  return createHash("sha256").update(ip).digest("hex").slice(0, 32)
}

export async function POST(req: NextRequest) {
  // ── Parse seguro del body ──────────────────────────────────────────────────
  let body: { email?: unknown; consent?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 })
  }

  // ── Validación email ───────────────────────────────────────────────────────
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
  if (!email || email.length > MAX_EMAIL_LEN || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Email no válido." }, { status: 400 })
  }

  // ── Validación consentimiento RGPD (estrictamente true) ────────────────────
  // Cualquier valor distinto del booleano literal `true` → 400. Sin consent
  // explícito no hay base legal para el tratamiento (art. 6.1.a).
  if (body.consent !== true) {
    return NextResponse.json(
      { error: "El consentimiento es obligatorio para registrar el email." },
      { status: 400 },
    )
  }

  // ── Inserción en Supabase ──────────────────────────────────────────────────
  try {
    const sb = createServiceClient()
    const { error } = await sb.from("leads").insert({
      email,
      source: "ev_calculator",
      consent_gdpr: true,
      consent_at: new Date().toISOString(),
      ip_hash: hashIp(req),
    })

    if (error) {
      // 23505 = unique_violation → el email ya está registrado.
      // No es un fallo desde la perspectiva del usuario: ya está suscrito.
      // Devolvemos 200 silencioso para no filtrar qué emails existen en la BD
      // (evita enumeración) ni dar feedback negativo a quien se reinscribe.
      if (error.code === "23505") {
        return NextResponse.json({ ok: true, alreadySubscribed: true }, { status: 200 })
      }
      // CN-026: nunca exponer el error crudo de la BD al cliente.
      console.error("[/api/leads/ev-calculator] insert error:", error.message)
      return NextResponse.json({ error: "No se pudo completar el registro." }, { status: 500 })
    }

    return NextResponse.json({ ok: true, alreadySubscribed: false }, { status: 201 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[/api/leads/ev-calculator] error:", msg)
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 })
  }
}
