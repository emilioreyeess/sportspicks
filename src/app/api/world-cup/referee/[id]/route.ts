/**
 * GET /api/world-cup/referee/[id]
 * Estadísticas del árbitro: tarjetas/partido, penaltis/partido, severidad,
 * notas, competiciones recientes.
 *
 * Lista de árbitros disponible en: GET /api/world-cup/referee
 */
import { NextRequest } from "next/server"
import { getRefereeById, getAllReferees, refreshRefereeSeverity } from "@/lib/world-cup"
import { consume, getClientIp, tooManyRequests } from "@/lib/rate-limit"

export const runtime = "nodejs"

const ID_REGEX = /^[a-z][a-z0-9-]{2,60}$/

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const ip = getClientIp(req)
  if (!consume(`wc-ref:${ip}`, 30, 6)) return tooManyRequests(60)

  const id = (params.id ?? "").toLowerCase()

  // Listado completo si id === "all"
  if (id === "all") {
    const refs = getAllReferees().map(refreshRefereeSeverity)
    return Response.json({ referees: refs, total: refs.length })
  }

  if (!ID_REGEX.test(id)) {
    return Response.json({ error: "id de árbitro inválido" }, { status: 400 })
  }

  const ref = getRefereeById(id)
  if (!ref) {
    return Response.json({ error: "Árbitro no encontrado en la base curada" }, { status: 404 })
  }

  return Response.json(refreshRefereeSeverity(ref), {
    headers: { "Cache-Control": "public, s-maxage=86400" },
  })
}
