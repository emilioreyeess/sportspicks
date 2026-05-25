/**
 * POST /api/webhooks/stripe
 * Webhook de Stripe — procesa eventos de suscripción.
 *
 * Eventos manejados:
 *   - checkout.session.completed → activación inicial del plan
 *   - customer.subscription.deleted → cancelación / baja del plan
 *   - invoice.payment_failed → fallo de renovación
 *
 * Sin DB por ahora: solo log + headers de respuesta.
 * Cuando se integre auth, aquí se actualiza el plan del usuario en la DB.
 */
import { NextRequest, NextResponse } from "next/server"
import { getStripe } from "@/lib/stripe"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  // Sin secret configurado: rechazar todo — nunca procesar sin verificar firma
  if (!webhookSecret) {
    console.error("[webhook] STRIPE_WEBHOOK_SECRET no configurado — rechazando petición")
    return NextResponse.json({ error: "Webhook no configurado" }, { status: 500 })
  }

  const rawBody = await req.text()
  const sig = req.headers.get("stripe-signature") ?? ""

  if (!sig) {
    return NextResponse.json({ error: "Firma ausente" }, { status: 400 })
  }

  let event: import("stripe").Stripe.Event

  try {
    const stripe = getStripe()
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
  } catch (err: any) {
    console.error("[webhook] firma inválida:", err.message)
    // No revelar detalles del error de firma
    return NextResponse.json({ error: "Firma inválida" }, { status: 400 })
  }

  // Stripe events handled — no logging de PII (email, customerId) en producción.
  // Cuando haya DB con auth, aquí se persisten los cambios de plan.
  switch (event.type) {
    case "checkout.session.completed":
      // TODO: actualizar plan en DB usando session.metadata?.plan + email
      break
    case "customer.subscription.deleted":
      // TODO: degradar plan a "free" en DB usando sub.customer
      break
    case "invoice.payment_failed":
      // TODO: notificar al usuario sin loggear email en stdout
      break
    default:
      break
  }

  return NextResponse.json({ received: true })
}
