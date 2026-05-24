/**
 * GET /api/checkout/status?customer_id=cus_xxx
 * Verifica el estado actual de la suscripción del cliente en Stripe.
 *
 * Returns: { plan: "free"|"premium"|"pro", active: boolean, period_end?: number }
 *
 * Usado por la cuenta para re-verificar tras volver del portal de cancelación.
 */
import { NextRequest, NextResponse } from "next/server"
import { getStripe, PRICE_IDS } from "@/lib/stripe"
import { consume, getClientIp, tooManyRequests } from "@/lib/rate-limit"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const ip = getClientIp(req)
  if (!consume(`sub-status:${ip}`, 5, 1)) return tooManyRequests(60)

  const customerId = req.nextUrl.searchParams.get("customer_id")
  if (!customerId?.startsWith("cus_")) {
    return NextResponse.json({ error: "customer_id inválido" }, { status: 400 })
  }

  try {
    const stripe = getStripe()

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 3,
      expand: ["data.items.data.price"],
    })

    if (subscriptions.data.length === 0) {
      return NextResponse.json({ plan: "free", active: false })
    }

    const sub = subscriptions.data[0]
    const priceId = sub.items.data[0]?.price?.id ?? ""

    // Map Stripe price → plan id
    let plan: "premium" | "pro" | "free" = "free"
    if (priceId && priceId === PRICE_IDS.pro)     plan = "pro"
    else if (priceId && priceId === PRICE_IDS.premium) plan = "premium"
    else if (priceId) {
      // Fallback: check metadata on subscription
      plan = (sub.metadata?.plan as "premium" | "pro") ?? "premium"
    }

    return NextResponse.json({
      plan,
      active: true,
      period_end: sub.current_period_end,  // Unix timestamp
      cancel_at_period_end: sub.cancel_at_period_end,
    })
  } catch (err: any) {
    console.error("[status] error:", err)
    return NextResponse.json({ error: err.message ?? "Error interno" }, { status: 500 })
  }
}
