/**
 * POST /api/checkout
 * Crea una sesión de Stripe Checkout para el plan elegido.
 *
 * Body: { plan: "premium" | "pro", email?: string }
 * Returns: { url: string } — redirigir el navegador a esta URL
 */
import { NextRequest, NextResponse } from "next/server"
import { getStripe, PRICE_IDS } from "@/lib/stripe"
import { consume, getClientIp, tooManyRequests } from "@/lib/rate-limit"

export const runtime = "nodejs"

// Email regex: cumple RFC 5322 (versión práctica). Bloquea inputs malformados.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ALLOWED_PLANS = new Set([
  "premium", "pro",
  "premium_monthly", "premium_annual",
  "pro_monthly", "pro_annual",
])

export async function POST(req: NextRequest) {
  try {
    // Rate limit primero — barato y rechaza abuso antes de parsear JSON
    const ip = getClientIp(req)
    if (!consume(`checkout:${ip}`, 5, 1)) return tooManyRequests(120)

    // Input validation
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
    }
    const { plan, email, billing } = body
    if (!plan || typeof plan !== "string" || !ALLOWED_PLANS.has(plan)) {
      return NextResponse.json({ error: "Plan inválido" }, { status: 400 })
    }
    if (email !== undefined && (typeof email !== "string" || email.length > 255 || !EMAIL_REGEX.test(email))) {
      return NextResponse.json({ error: "Email inválido" }, { status: 400 })
    }
    if (billing !== undefined && !["monthly", "annual"].includes(billing)) {
      return NextResponse.json({ error: "Periodo de facturación inválido" }, { status: 400 })
    }

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

    // Prueba gratuita SOLO para el plan Pro. Premium va a pago inmediato.
    const subscriptionData: { metadata: { plan: string }; trial_period_days?: number } = {
      metadata: { plan },
    }
    if (plan === "pro") {
      subscriptionData.trial_period_days = 3
    }

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
      subscription_data: subscriptionData,
    })

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    console.error("[checkout] error:", err)
    return NextResponse.json({ error: "Error al crear la sesión de pago" }, { status: 500 })
  }
}
