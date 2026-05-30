/**
 * GET /api/world-cup/match/[id]
 * Match Center completo: equipos, plantillas, forma, xG snapshot, árbitro,
 * flags de contexto (knockout, derbi, ambos contentos con empate, etc.).
 *
 * El id debe ser un matchId con prefijo "wc26-" generado por el data-service.
 */
import { NextRequest } from "next/server"
import { getMatchCenter } from "@/lib/world-cup"
import { consume, getClientIp, tooManyRequests } from "@/lib/rate-limit"

export const runtime = "nodejs"
export const maxDuration = 60

const MATCH_ID_REGEX = /^wc26-[A-Za-z0-9-]+$/

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ip = getClientIp(req)
  if (!consume(`wc-match:${ip}`, 20, 4)) return tooManyRequests(60)

  const matchId = (await params).id ?? ""
  if (!MATCH_ID_REGEX.test(matchId) || matchId.length > 80) {
    return Response.json({ error: "matchId inválido" }, { status: 400 })
  }

  const center = await getMatchCenter(matchId)
  if (!center) {
    return Response.json({ error: "Partido no encontrado" }, { status: 404 })
  }

  return Response.json(center, {
    headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" },
  })
}
