/**
 * GET /api/world-cup/bracket
 * Cuadro completo del torneo: standings por grupo + fixtures de eliminatorias.
 */
import { NextRequest } from "next/server"
import { getBracket } from "@/lib/world-cup"
import { consume, getClientIp, tooManyRequests } from "@/lib/rate-limit"

export const runtime = "nodejs"
export const maxDuration = 30

export async function GET(req: NextRequest) {
  const ip = getClientIp(req)
  if (!consume(`wc-bracket:${ip}`, 30, 6)) return tooManyRequests(60)

  const bracket = await getBracket()
  return Response.json(bracket, {
    headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" },
  })
}
