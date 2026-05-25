/**
 * GET /api/world-cup/team/[code]
 * Detalle completo de una selección: plantilla, forma, fixtures pasados/futuros.
 *
 * El code debe ser 3 letras (ISO FIFA), p.ej. ESP, ARG, USA.
 */
import { NextRequest } from "next/server"
import { getTeamDetail } from "@/lib/world-cup"
import { consume, getClientIp, tooManyRequests } from "@/lib/rate-limit"

export const runtime = "nodejs"
export const maxDuration = 60

const CODE_REGEX = /^[A-Z]{3}$/

export async function GET(
  req: NextRequest,
  { params }: { params: { code: string } },
) {
  const ip = getClientIp(req)
  if (!consume(`wc-team:${ip}`, 20, 4)) return tooManyRequests(60)

  const code = (params.code ?? "").toUpperCase()
  if (!CODE_REGEX.test(code)) {
    return Response.json({ error: "Código FIFA inválido (3 letras mayúsculas)" }, { status: 400 })
  }

  const detail = await getTeamDetail(code)
  if (!detail) {
    return Response.json({ error: "Selección no encontrada en el Mundial 2026" }, { status: 404 })
  }

  return Response.json(detail, {
    headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=10800" },
  })
}
