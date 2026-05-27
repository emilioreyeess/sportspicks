/**
 * GET /api/world-cup/odds?home=ESP&away=URU
 * Devuelve las cuotas reales de un partido del Mundial.
 * Fuente: The Odds API (requiere ODDS_API_KEY).
 * Si no hay key configurada → 404 con mensaje claro.
 */
import { NextRequest } from "next/server"
import { getMatchOdds, isOddsEnabled } from "@/lib/world-cup/odds-service"
import { consume, getClientIp, tooManyRequests } from "@/lib/rate-limit"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const ip = getClientIp(req)
  if (!consume(`wc-odds:${ip}`, 20, 2)) return tooManyRequests(60)

  if (!isOddsEnabled()) {
    return Response.json({ error: "odds_disabled", message: "ODDS_API_KEY no configurada" }, { status: 404 })
  }

  const { searchParams } = new URL(req.url)
  const home = (searchParams.get("home") ?? "").toUpperCase()
  const away = (searchParams.get("away") ?? "").toUpperCase()

  if (!home || !away) {
    return Response.json({ error: "Parámetros home y away requeridos" }, { status: 400 })
  }

  const odds = await getMatchOdds(home, away)
  if (!odds) {
    return Response.json({ error: "no_odds", message: "Cuotas no disponibles aún para este partido" }, { status: 404 })
  }

  return Response.json(odds, {
    headers: { "Cache-Control": "public, s-maxage=7200, stale-while-revalidate=3600" },
  })
}
