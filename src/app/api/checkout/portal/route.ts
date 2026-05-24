/**
 * POST /api/checkout/portal
 * Crea una sesión del Stripe Customer Portal para gestionar la suscripción.
 *
 * Body: { customer_id: string }
 * Returns: { url: string } — redirigir el navegador a esta URL
 *
 * Nota: requiere que el Billing Portal esté configurado en el dashboard de Stripe:
 * https://dashboard.stripe.com/test/settings/billing/portal
 */
import { NextRequest, NextResponse } from "next/server"
import { getStripe } from "@/lib/stripe"
import { consume, getClientIp, tooManyRequests } from "@/lib/rate-limit"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  if (!consume(`portal:${ip}`, 5, 1)) return tooManyRequests(60)

  try {
    const { customer_id } = (await req.json()) as { customer_id?: string }
    if (!customer_id?.startsWith("cus_")) {
      return NextResponse.json({ error: "customer_id inválido" }, { status: 400 })
    }

    const stripe = getStripe()
    const origin = req.headers.get("origin") ?? "http://localhost:3000"

    const session = await stripe.billingPortal.sessions.create({
      customer: customer_id,
      return_url: `${origin}/account?from=portal`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    console.error("[portal] error:", err)
    return NextResponse.json({ error: err.message ?? "Error interno" }, { status: 500 })
  }
}
