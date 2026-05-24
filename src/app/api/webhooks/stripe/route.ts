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
  if (!webhookSecret) {
    console.warn("[webhook] STRIPE_WEBHOOK_SECRET not set — skipping signature verification")
  }

  const rawBody = await req.text()
  const sig = req.headers.get("stripe-signature") ?? ""

  let event: import("stripe").Stripe.Event

  try {
    const stripe = getStripe()
    if (webhookSecret && sig) {
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
    } else {
      event = JSON.parse(rawBody)
    }
  } catch (err: any) {
    console.error("[webhook] signature verification failed:", err.message)
    return NextResponse.json({ error: "Webhook Error: " + err.message }, { status: 400 })
  }

  console.log("[webhook] received event:", event.type)

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as import("stripe").Stripe.Checkout.Session
      const plan  = session.metadata?.plan ?? "premium"
      const email = session.customer_email ?? session.customer_details?.email
      console.log(`[webhook] ✅ Plan activado: ${plan} para ${email ?? "desconocido"}`)
      // TODO cuando haya auth: actualizar plan en DB del usuario con email
      break
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as import("stripe").Stripe.Subscription
      const customerId = sub.customer as string
      console.log(`[webhook] ❌ Suscripción cancelada para customer ${customerId}`)
      // TODO cuando haya auth: degradar plan a "free" en DB
      break
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as import("stripe").Stripe.Invoice
      console.log(`[webhook] ⚠️ Pago fallido para ${invoice.customer_email ?? invoice.customer}`)
      // TODO cuando haya auth: notificar al usuario
      break
    }

    default:
      // Ignorar eventos no manejados
      break
  }

  return NextResponse.json({ received: true })
}
