/**
 * POST /api/checkout
 * Crea una sesión de Stripe Checkout para el plan elegido.
 *
 * Body: { plan: "premium" | "pro", email?: string }
 * Returns: { url: string } — redirigir el navegador a esta URL
 */
import { NextRequest, NextResponse } from "next/server"
import { getStripe, PRICE_IDS } from "@/lib/stripe"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  try {
    const { plan, email, billing } = (await req.json()) as { plan: string; email?: string; billing?: string }

    // Prefer billing-specific price ID (e.g. premium_annual), fallback to base plan price
    const billingKey = billing === "annual" || billing === "monthly" ? `${plan}_${billing}` : plan
    const priceId = PRICE_IDS[billingKey] ?? PRICE_IDS[plan]
    if (!priceId) {
      return NextResponse.json(
        { error: `Plan desconocido o sin precio configurado: ${plan}` },
        { status: 400 },
      )
    }

    const stripe = getStripe()
    const origin = req.headers.get("origin") ?? "http://localhost:3000"

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      ...(email ? { customer_email: email } : {}),
      metadata: { plan },
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${origin}/checkout/cancel`,
      // Localización española
      locale: "es",
      billing_address_collection: "required",
      // Pruebas: test clock override si fuera necesario
      subscription_data: {
        metadata: { plan },
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    console.error("[checkout] error:", err)
    return NextResponse.json({ error: "Error al crear la sesión de pago" }, { status: 500 })
  }
}
