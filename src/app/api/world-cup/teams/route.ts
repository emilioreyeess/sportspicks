/**
 * GET /api/world-cup/teams
 * Devuelve los 48 equipos del Mundial agrupados por confederación y, si el
 * sorteo ya se hizo, también por grupo (A-L).
 */
import { NextRequest } from "next/server"
import { getAllTeams } from "@/lib/world-cup"
import { consume, getClientIp, tooManyRequests } from "@/lib/rate-limit"

export const runtime = "nodejs"
export const maxDuration = 30

export async function GET(req: NextRequest) {
  const ip = getClientIp(req)
  if (!consume(`wc-teams:${ip}`, 30, 6)) return tooManyRequests(60)

  const data = await getAllTeams()
  return Response.json(data, {
    headers: {
      // Edge cache: 1 h con stale-while-revalidate 6 h
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=21600",
    },
  })
}
