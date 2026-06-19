/**
 * GET /api/matches/analysis  — Análisis ZERO-HALLUCINATION de un partido (STEP 4)
 *
 * Params: id (match_id), slug (liga), home (teamId), away (teamId),
 *         hname?, aname?, kickoff? (ISO).
 *
 * Calcula 1X2, BTTS, Over/Under goles, corners y tarjetas con datos REALES de
 * ESPN (lib/analysis/match-model). Antes de emitir cada probabilidad consulta
 * `team_form_weights`. Si el partido aún no ha empezado, registra las
 * predicciones en `predictions_log` para cerrar el ciclo de aprendizaje (STEP 1).
 */
import { NextRequest } from "next/server"
import { getServerSession } from "@/lib/auth-server"
import { consume, getClientIp, tooManyRequests } from "@/lib/rate-limit"
import { fetchTeamModel, analyzeMatch } from "@/lib/analysis/match-model"
import { logPredictions, type PredictionInput } from "@/lib/learning/supabase-ml"
import { getMatchContext } from "@/lib/match-context"
import { inferTeamCode } from "@/lib/world-cup/elo"
import { createServiceClient } from "@/lib/supabase/client"
import { resolveWcCode } from "@/lib/world-cup/name-to-code"

export const runtime = "nodejs"
export const maxDuration = 30

// Ligas soportadas (coinciden con /api/matches/today) — anti-SSRF.
const VALID_SLUGS = new Set([
  "uefa.champions", "uefa.europa", "fifa.world", "conmebol.america", "UEFA.EURO",
  "esp.1", "eng.1", "ger.1", "ita.1", "fra.1", "por.1", "ned.1",
  "usa.1", "mex.1", "bra.1", "arg.1", "fifa.friendly",
])

/**
 * Lee las cuotas 1X2 reales de un partido del Mundial desde la tabla `fixtures`
 * (las refresca el cron de sync). Cruza por código FIFA (los nombres ESPN ≠ los
 * de API-Football) y acepta el orden invertido (local/visitante).
 * Devuelve null si no hay fila, no hay cuotas, o ante cualquier error → el motor
 * usa Poisson puro como fallback. NUNCA inventa cuotas.
 */
async function fetchWcOdds(
  homeName?: string | null,
  awayName?: string | null,
): Promise<{ home: number | null; draw: number | null; away: number | null } | null> {
  if (!homeName || !awayName) return null
  const hc = resolveWcCode(homeName)
  const ac = resolveWcCode(awayName)
  if (!hc || !ac) return null
  try {
    const sb = createServiceClient()
    const { data } = await sb
      .from("fixtures")
      .select("home_team, away_team, stats")
      .eq("league", "World Cup")
      .limit(400)
    const hit = (data ?? []).find((f: { home_team?: string; away_team?: string }) => {
      const fh = resolveWcCode(f.home_team ?? "")
      const fa = resolveWcCode(f.away_team ?? "")
      return (fh === hc && fa === ac) || (fh === ac && fa === hc)
    }) as { stats?: { odds?: { home?: number; draw?: number; away?: number } } } | undefined
    const o = hit?.stats?.odds
    if (!o) return null
    const num = (v: unknown) => (typeof v === "number" && isFinite(v) && v > 1 ? v : null)
    const home = num(o.home), draw = num(o.draw), away = num(o.away)
    if (home == null && draw == null && away == null) return null
    return { home, draw, away }
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req)
  if (!consume(`match-analysis:${ip}`, 15, 3)) return tooManyRequests(60)

  const sp = req.nextUrl.searchParams
  const matchId = (sp.get("id") ?? "").trim()
  const slug = (sp.get("slug") ?? "").trim()
  const homeId = (sp.get("home") ?? "").trim()
  const awayId = (sp.get("away") ?? "").trim()
  const hname = (sp.get("hname") ?? "").trim()
  const aname = (sp.get("aname") ?? "").trim()
  const kickoff = (sp.get("kickoff") ?? "").trim()

  // Validación estricta (anti-SSRF / abuso)
  if (!/^\d{1,12}$/.test(matchId)) return Response.json({ error: "match_id inválido" }, { status: 400 })
  if (!VALID_SLUGS.has(slug)) return Response.json({ error: "Liga no soportada" }, { status: 400 })
  if (!/^\d{1,7}$/.test(homeId) || !/^\d{1,7}$/.test(awayId)) {
    return Response.json({ error: "team id inválido" }, { status: 400 })
  }

  try {
    const [home, away] = await Promise.all([
      fetchTeamModel(slug, homeId),
      fetchTeamModel(slug, awayId),
    ])

    // Inferimos códigos FIFA desde los nombres para que el motor Elo tenga
    // material de fallback cuando es un internacional con poca historia.
    const homeCode = inferTeamCode(hname || home?.name)
    const awayCode = inferTeamCode(aname || away?.name)

    // FASE 1 — Cuotas reales (fuente de verdad). Solo Mundial: leemos las cuotas
    // 1X2 de la tabla `fixtures` (refrescadas por el cron) cruzando por código
    // FIFA. Si no hay fila o cuotas → odds=null → el motor cae a Poisson puro.
    const odds = /world/i.test(slug)
      ? await fetchWcOdds(hname || home?.name, aname || away?.name)
      : null
    const analysis = await analyzeMatch({ league: slug, home, away, homeCode, awayCode, odds })

    // ── Registrar predicciones en el ML loop (solo si el partido no ha empezado) ──
    //   · No registrar si el motor no tuvo datos suficientes (amistosos sin
    //     historia, debutantes de copa). El feed se ensuciaría con predicciones
    //     basadas en 1-2 partidos.
    const kickoffMs = kickoff ? new Date(kickoff).getTime() : NaN
    const notStarted = isFinite(kickoffMs) ? kickoffMs > Date.now() : false
    if (notStarted && analysis.dataSufficient && analysis.picks.length) {
      let userId: string | null = null
      try {
        const session = await getServerSession()
        userId = session?.user?.email ?? null
      } catch { /* sesión opcional */ }

      const homeName = hname || home?.name || "Local"
      const awayName = aname || away?.name || "Visitante"
      // Derivamos el contexto desde el slug — esto etiqueta cada predicción y
      // permite que el cron de Brier/accuracy aísle el aprendizaje de
      // selecciones del de clubes.
      const ctx = getMatchContext(slug).context
      const inputs: PredictionInput[] = analysis.picks.map((p) => ({
        matchId,
        league: slug,
        homeTeam: homeName,
        awayTeam: awayName,
        market: p.market,
        pick: p.pick,
        odds: null,
        modelProb: p.prob,         // 0..1
        edge: null,
        userId,
        kickoffIso: new Date(kickoffMs).toISOString(),
        context: ctx,
      }))
      // best-effort, no bloquea la respuesta si falla
      logPredictions(inputs).catch(() => {})
    }

    return Response.json({
      match_id: matchId,
      league: slug,
      analysis,
      ts: new Date().toISOString(),
    })
  } catch (e: any) {
    return Response.json({ error: e?.message ?? "error" }, { status: 500 })
  }
}
