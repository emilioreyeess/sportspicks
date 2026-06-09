/**
 * GET /api/debug/odds-test
 *
 * Herramienta de validación (PUNTO 5): prueba la ingesta de cuotas de
 * API-Football para un partido y verifica que el mapeo 1X2 (bookmakers→bets→
 * values) funciona. Toma un fixture ALEATORIO de nuestra tabla `fixtures`
 * (próximo o de hoy) o uno forzado con ?fixture=ID.
 *
 * Seguridad: Authorization: Bearer ${CRON_SECRET} (fail-closed, ≥16 chars).
 * Uso: curl -H "Authorization: Bearer $CRON_SECRET" https://.../api/debug/odds-test
 */
import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/client"
import { fetchFixtureOddsAF } from "@/lib/infrastructure/footballApi"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || secret.length < 16) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const forced = new URL(req.url).searchParams.get("fixture")

  try {
    const sb = createServiceClient()
    let row: any = null

    if (forced && Number.isFinite(Number(forced))) {
      const { data } = await sb
        .from("fixtures")
        .select("fixture_id, home_team, away_team, league, match_date")
        .eq("fixture_id", Number(forced)).maybeSingle()
      row = data ?? { fixture_id: Number(forced) }
    } else {
      // Partido ALEATORIO entre los próximos (de la BD ya ingestada por el cron).
      const { data } = await sb
        .from("fixtures")
        .select("fixture_id, home_team, away_team, league, match_date")
        .gte("match_date", new Date().toISOString())
        .order("match_date", { ascending: true })
        .limit(50)
      if (!data?.length) {
        return NextResponse.json({ ok: false, reason: "No hay fixtures próximos en la BD." })
      }
      row = data[Math.floor(Math.random() * data.length)]
    }

    const fixtureId = Number(row.fixture_id)
    const odds = await fetchFixtureOddsAF(fixtureId)
    const mapping_1x2_ok = !!odds && odds.home != null && odds.away != null

    const result = {
      ok: true,
      fixture: {
        fixture_id: fixtureId,
        match: row.home_team ? `${row.home_team} vs ${row.away_team}` : "(desconocido)",
        league: row.league ?? null,
        kickoff: row.match_date ?? null,
      },
      provider: odds?.provider ?? null,
      odds_1x2: odds ? { home: odds.home ?? null, draw: odds.draw ?? null, away: odds.away ?? null } : null,
      odds_ou25: odds ? { over25: odds.over25 ?? null, under25: odds.under25 ?? null } : null,
      mapping_1x2_ok,
      verdict: mapping_1x2_ok
        ? "✅ Mapeo 1X2 OK — cuotas reales leídas de API-Football (/odds)."
        : "⚠️ Sin cuotas 1X2 para este fixture (API-Football no las expone aún o no hay). El motor lo descartaría.",
    }
    console.log("[debug/odds-test]", JSON.stringify(result))
    return NextResponse.json(result)
  } catch (e) {
    console.error("[debug/odds-test] error:", e instanceof Error ? e.message : e)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
