/**
 * /api/world-cup/combinadas — WC 2026 parlay generator.
 *
 * GET /api/world-cup/combinadas
 *   ?tier=segura|balanceada|soñadora|all  (default: all)
 *
 * Returns WCCombinadasResponse (all 3 tiers) or a single WCCombinada.
 * Results are cached in Upstash KV for 30 minutes.
 */

import { NextRequest } from "next/server"
import { generateWCCombinadas } from "@/lib/world-cup/wc-combinadas"
import { consume, getClientIp, tooManyRequests } from "@/lib/rate-limit"
import { cacheGet, cacheSet } from "@/lib/world-cup/cache"

export const runtime    = "nodejs"
export const maxDuration = 120

const CACHE_KEY = "wc:combinadas:v1"
const CACHE_TTL = 30 * 60   // 30 minutes

export async function GET(req: NextRequest) {
  // Rate limit: 10 requests per minute per IP
  const ip = getClientIp(req)
  if (!consume(ip, 10, 1)) return tooManyRequests(60)

  const tier = new URL(req.url).searchParams.get("tier") ?? "all"

  // Try cache first
  const cached = await cacheGet<ReturnType<typeof generateWCCombinadas> extends Promise<infer T> ? T : never>(CACHE_KEY)
  if (cached) {
    return Response.json(tier === "all" ? cached : pickTier(cached, tier), {
      headers: { "X-Cache": "HIT" },
    })
  }

  // Generate fresh
  const result = await generateWCCombinadas()

  // Cache asynchronously (don't block response)
  cacheSet(CACHE_KEY, result, CACHE_TTL).catch(() => null)

  return Response.json(tier === "all" ? result : pickTier(result, tier), {
    headers: { "X-Cache": "MISS" },
  })
}

function pickTier(
  result: Awaited<ReturnType<typeof generateWCCombinadas>>,
  tier: string,
) {
  switch (tier) {
    case "segura":     return result.segura
    case "balanceada": return result.balanceada
    case "soñadora":   return result.soñadora
    default:           return result
  }
}
