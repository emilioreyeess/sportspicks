/**
 * GET /api/auth/plan
 *
 * Devuelve el plan real del usuario autenticado.
 * Orden de prioridad:
 *   1. Grant manual (plan-grants.ts) — equipo fundador / beta testers
 *   2. Suscripción activa en Stripe
 *   3. "free" (fallback)
 *
 * Respuesta: { plan: "free" | "premium" | "pro", source: "grant" | "stripe" | "free" }
 *
 * El PlanProvider del cliente llama este endpoint al montar si hay sesión activa,
 * y sincroniza localStorage con el plan real del servidor.
 */

import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth-server"
import { getGrantedPlan } from "@/lib/plan-grants"
import { getStripe, PRICE_IDS } from "@/lib/stripe"
import { consume, getClientIp, tooManyRequests } from "@/lib/rate-limit"
import { createServiceClient } from "@/lib/supabase/client"
import type { NextRequest } from "next/server"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  // Rate limit: 20 checks por IP por minuto
  const ip = getClientIp(req)
  if (!consume(`plan-check:${ip}`, 20, 1)) return tooManyRequests(60)

  // Requiere sesión activa
  const session = await getServerSession()
  const email = session?.user?.email
  if (!email) {
    return NextResponse.json({ plan: "free", source: "unauthenticated" })
  }

  const normalizedEmail = email.trim().toLowerCase()

  // ─── 0. VIP tipster status (always from DB) ──────────────────────────────
  let is_vip_tipster = false
  try {
    const sb = createServiceClient()
    const { data: userLog } = await sb
      .from("users_log")
      .select("is_vip_tipster")
      .eq("email", normalizedEmail)
      .maybeSingle()
    is_vip_tipster = !!userLog?.is_vip_tipster
  } catch {}

  // ─── 1. Grant manual ────────────────────────────────────────────────────
  const grant = getGrantedPlan(normalizedEmail)
  if (grant) {
    return NextResponse.json({ plan: grant, source: "grant", is_vip_tipster })
  }

  // ─── 2. Stripe ──────────────────────────────────────────────────────────
  try {
    const stripe = getStripe()

    // Buscar cliente de Stripe por email
    const customers = await stripe.customers.search({
      query: `email:"${normalizedEmail}"`,
      limit: 1,
      expand: ["data.subscriptions"],
    })

    if (customers.data.length === 0) {
      return NextResponse.json({ plan: "free", source: "free", is_vip_tipster })
    }

    const customer = customers.data[0]
    const subs = (customer as any).subscriptions?.data ?? []

    // Filtrar subs activas (incluyendo cancel_at_period_end)
    const now = Math.floor(Date.now() / 1000)
    const activeSubs = subs.filter((s: any) => {
      if (s.status === "active") return true
      if (s.status === "canceled") {
        const ends = s.cancel_at ?? s.ended_at ?? 0
        return ends > now
      }
      return false
    })

    if (activeSubs.length === 0) {
      return NextResponse.json({ plan: "free", source: "free", is_vip_tipster })
    }

    const priceId = activeSubs[0].items?.data?.[0]?.price?.id ?? ""
    const proPrices = new Set([PRICE_IDS.pro, PRICE_IDS.pro_monthly, PRICE_IDS.pro_annual].filter(Boolean))
    const premiumPrices = new Set([PRICE_IDS.premium, PRICE_IDS.premium_monthly, PRICE_IDS.premium_annual].filter(Boolean))

    let plan: "premium" | "pro" | "free" = "free"
    if (priceId && proPrices.has(priceId))          plan = "pro"
    else if (priceId && premiumPrices.has(priceId)) plan = "premium"
    else if (priceId) plan = (activeSubs[0].metadata?.plan ?? "premium") as "premium" | "pro"

    return NextResponse.json({ plan, source: "stripe", is_vip_tipster })
  } catch {
    // Error de Stripe → no bloquear al usuario, devolver free
    return NextResponse.json({ plan: "free", source: "free", is_vip_tipster })
  }
}
