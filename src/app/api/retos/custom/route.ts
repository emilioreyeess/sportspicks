import { NextRequest } from "next/server"
import { ensureWarm, computeCustomRetoPick } from "@/lib/pipeline"
import { consume } from "@/lib/rate-limit"

export const runtime = "nodejs"
export const maxDuration = 60

/**
 * POST /api/retos/custom
 * Genera un pick personalizado para el usuario PRO.
 * Body: { targetOdd: number, nLegs: 1 | 2 }
 */
export async function POST(req: NextRequest) {
  // Rate limit: 10 generaciones por IP cada 5 minutos
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown"
  try {
    await consume(`custom_reto:${ip}`, 10, 5)
  } catch {
    return Response.json({ error: "Demasiadas solicitudes. Espera unos minutos." }, { status: 429 })
  }

  let body: any
  try { body = await req.json() } catch {
    return Response.json({ error: "Cuerpo inválido." }, { status: 400 })
  }

  const rawOdd = parseFloat(body?.targetOdd)
  const rawLegs = parseInt(body?.nLegs)

  if (!isFinite(rawOdd) || rawOdd < 1.10 || rawOdd > 5.50) {
    return Response.json({ error: "La cuota debe estar entre 1.10 y 5.50." }, { status: 400 })
  }
  if (rawLegs !== 1 && rawLegs !== 2) {
    return Response.json({ error: "nLegs debe ser 1 o 2." }, { status: 400 })
  }

  await ensureWarm()

  const combo = computeCustomRetoPick(rawOdd, rawLegs as 1 | 2)

  if (!combo) {
    return Response.json(
      {
        error: "No hay picks con esa cuota disponibles hoy. Prueba a ajustar la cuota o cambiar entre simple y combinada.",
      },
      { status: 404 },
    )
  }

  return Response.json({ combo })
}
