/**
 * GET /api/checkout/verify?session_id=cs_xxx
 * Verifica con Stripe que el pago fue completado y devuelve el plan activado.
 *
 * Returns: { plan: "premium" | "pro", email: string | null }
 */
import { NextRequest, NextResponse } from "next/server"
import { getStripe } from "@/lib/stripe"
import { consume, getClientIp, tooManyRequests } from "@/lib/rate-limit"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  // Rate limit: 10 intentos por IP por minuto (evita fuerza bruta de session_ids)
  const ip = getClientIp(req)
  if (!consume(`verify:${ip}`, 10, 1)) return tooManyRequests(60)

  const sessionId = req.nextUrl.searchParams.get("session_id")
  // session_ids de Stripe siempre empiezan por "cs_"
  if (!sessionId?.startsWith("cs_")) {
    return NextResponse.json({ error: "session_id inválido" }, { status: 400 })
  }

  try {
    const stripe = getStripe()
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    })

    if (session.payment_status !== "paid" && session.status !== "complete") {
      return NextResponse.json({ error: "Pago no completado" }, { status: 402 })
    }

    const plan = (session.metadata?.plan ?? "premium") as "premium" | "pro"
    const email = session.customer_email ?? session.customer_details?.email ?? null
    const customer_id = typeof session.customer === "string" ? session.customer : null

    return NextResponse.json({ plan, email, customer_id, verified: true })
  } catch (err: any) {
    console.error("[checkout/verify] error:", err)
    // No exponer detalles internos de Stripe al cliente
    return NextResponse.json({ error: "Error al verificar el pago" }, { status: 500 })
  }
}
