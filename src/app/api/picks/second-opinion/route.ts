/**
 * POST /api/picks/second-opinion
 *
 * Body: {
 *   match_id: string,
 *   original_market: string,
 *   original_selection: string,
 *   original_quality: number,
 *   exclude_selections?: string[],
 *   plan?: "free" | "premium" | "pro"   // viene del cliente; el servidor confía en él
 * }
 *
 * Respuesta canónica del SecondOpinionResponse (decision-engine/types.ts).
 *
 * Reglas:
 *   - Quota por plan: FREE=1 / PREMIUM=3 / PRO=5 regeneraciones/día/usuario
 *   - No degrada calidad — el alternativo debe igualar o superar
 *   - Devuelve change_log estructurado para la UI
 */
import { NextRequest, NextResponse } from "next/server"
import { ensureWarm } from "@/lib/pipeline"
import { consume, getClientIp, tooManyRequests } from "@/lib/rate-limit"
import { runSecondOpinion } from "@/lib/decision-engine/second-opinion-engine"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import type { PlanTier } from "@/lib/decision-engine/types"

export const runtime = "nodejs"

const VALID_PLANS = new Set<PlanTier>(["free", "premium", "pro"])

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  if (!consume(`second-opinion:${ip}`, 10, 2)) return tooManyRequests(30)

  await ensureWarm()

  let body: {
    match_id?: string
    original_market?: string
    original_selection?: string
    original_quality?: number
    exclude_selections?: string[]
    plan?: string
  }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }) }

  // Validación estricta
  const { match_id, original_market, original_selection, original_quality, exclude_selections = [], plan: rawPlan } = body
  if (typeof match_id !== "string" || match_id.length < 3 || match_id.length > 80) {
    return NextResponse.json({ error: "match_id inválido" }, { status: 400 })
  }
  if (typeof original_market !== "string" || original_market.length < 2 || original_market.length > 50) {
    return NextResponse.json({ error: "original_market inválido" }, { status: 400 })
  }
  if (typeof original_selection !== "string" || original_selection.length < 2 || original_selection.length > 120) {
    return NextResponse.json({ error: "original_selection inválido" }, { status: 400 })
  }
  if (typeof original_quality !== "number" || original_quality < 0 || original_quality > 100) {
    return NextResponse.json({ error: "original_quality inválido (0-100)" }, { status: 400 })
  }
  if (!Array.isArray(exclude_selections) || exclude_selections.length > 20) {
    return NextResponse.json({ error: "exclude_selections inválido (máx 20)" }, { status: 400 })
  }
  const excluded = exclude_selections
    .filter((s): s is string => typeof s === "string")
    .map((s) => s.slice(0, 120))

  // Resolver plan: prioridad → sesión > cliente > free
  let plan: PlanTier = "free"
  try {
    const session = await getServerSession(authOptions)
    const sessionPlan = (session?.user as { plan?: string } | undefined)?.plan
    if (sessionPlan && VALID_PLANS.has(sessionPlan as PlanTier)) {
      plan = sessionPlan as PlanTier
    } else if (typeof rawPlan === "string" && VALID_PLANS.has(rawPlan as PlanTier)) {
      plan = rawPlan as PlanTier
    }
  } catch {
    // Sin sesión → leer del body (modo free por defecto si no se especifica)
    if (typeof rawPlan === "string" && VALID_PLANS.has(rawPlan as PlanTier)) {
      plan = rawPlan as PlanTier
    }
  }

  // userKey: identidad del usuario para la quota (sesión > IP)
  let userKey = `ip:${ip}`
  try {
    const session = await getServerSession(authOptions)
    const email = session?.user?.email
    if (email && typeof email === "string") userKey = `user:${email}`
  } catch {}

  const response = await runSecondOpinion({
    matchId: match_id,
    originalMarket: original_market,
    originalSelection: original_selection,
    originalQuality: original_quality,
    excludeSelections: excluded,
    userKey,
    plan,
  })

  // Mapear a status code:
  //   - quota exhausted → 429
  //   - encontrado → 200
  //   - no encontrado pero quota OK → 200 (con found: false)
  const status = response.quota.remaining === 0 && !response.found && response.reason?.includes("límite")
    ? 429 : 200

  return NextResponse.json(response, { status })
}
