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

    // Check active subscriptions (includes cancel_at_period_end ones)
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 3,
      expand: ["data.items.data.price"],
    })

    // Also check subscriptions recently cancelled but still within paid period
    const cancelled = await stripe.subscriptions.list({
      customer: customerId,
      status: "canceled",
      limit: 3,
      expand: ["data.items.data.price"],
    })

    const now = Math.floor(Date.now() / 1000)
    // Include cancelled subs where cancel_at (period end) is still in the future
    const stillValid = cancelled.data.filter(s => {
      const ends = (s as any).cancel_at ?? (s as any).ended_at ?? 0
      return ends > now
    })

    const allSubs = [...subscriptions.data, ...stillValid]

    if (allSubs.length === 0) {
      return NextResponse.json({ plan: "free", active: false })
    }

    const sub = allSubs[0]
    const priceId = sub.items.data[0]?.price?.id ?? ""

    // Build a flat set of all known price IDs for quick lookup
    const proPrices = new Set([PRICE_IDS.pro, PRICE_IDS.pro_monthly, PRICE_IDS.pro_annual].filter(Boolean))
    const premiumPrices = new Set([PRICE_IDS.premium, PRICE_IDS.premium_monthly, PRICE_IDS.premium_annual].filter(Boolean))

    // Map Stripe price → plan id
    let plan: "premium" | "pro" | "free" = "free"
    if (priceId && proPrices.has(priceId))     plan = "pro"
    else if (priceId && premiumPrices.has(priceId)) plan = "premium"
    else if (priceId) {
      // Fallback: read plan from subscription metadata
      plan = (sub.metadata?.plan as "premium" | "pro") ?? "premium"
    }

    // period_end: prefer cancel_at (set when cancel_at_period_end=true), then current_period_end
    const period_end = (sub as any).cancel_at ?? (sub as any).current_period_end ?? null
    const isActive = sub.status === "active"

    return NextResponse.json({
      plan,
      active: isActive,
      period_end,
      cancel_at_period_end: sub.cancel_at_period_end,
    })
  } catch (err: any) {
    console.error("[status] error:", err)
    return NextResponse.json({ error: "Error al verificar la suscripción" }, { status: 500 })
  }
}
