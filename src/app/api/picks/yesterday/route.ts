/**
 * GET  /api/picks/yesterday — lee picks del día anterior.
 * POST /api/picks/yesterday — recibe picks del cliente y los enriquece con resultados ESPN.
 *
 * Fuentes GET en orden de fiabilidad:
 *  1. In-memory store (instancia caliente)
 *  2. /tmp/sp-yesterday.json (cold restart misma instancia)
 *  3. Vercel KV "picks:yesterday" (compartido, multi-instancia — activo desde 31/05/2026)
 *
 * Si ninguna fuente tiene datos, el cliente cae al fallback de localStorage
 * (clave sp_picks_YYYY-MM-DD guardada por value/page.tsx al cargar picks de hoy).
 */
import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"   // nunca cachear: datos reales del día anterior
export const revalidate = 0

/**
 * GET /api/picks/yesterday — "Histórico de ayer" 100% REAL desde `predictions_log`.
 *
 * REGLA (cero mocks): solo picks cuyo kickoff cae AYER (ventana UTC dinámica) y con
 * estado RESUELTO 'won'|'lost' (se excluyen 'pending' y 'void'). Los 3 más recientes.
 * Mapea won→WIN, lost→LOSS para el cliente. Si no hay, devuelve picks: [].
 */
export async function GET() {
  // ── Cálculo DINÁMICO de "ayer" en UTC estricto ──
  const now = new Date()
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const yesterdayStart = new Date(todayStart.getTime() - 86_400_000)
  const fromIso = yesterdayStart.toISOString()   // ayer 00:00:00Z
  const toIso = todayStart.toISOString()         // hoy  00:00:00Z (exclusivo)

  try {
    const sb = createServiceClient()
    const { data, error } = await sb
      .from("predictions_log")
      .select("id, home_team, away_team, pick, odds, model_prob, status, kickoff_iso")
      .in("status", ["won", "lost"])             // SOLO resueltos (sin pending/void)
      .gte("kickoff_iso", fromIso)
      .lt("kickoff_iso", toIso)
      .order("kickoff_iso", { ascending: false })
      .limit(3)
    if (error || !data) return NextResponse.json({ date: fromIso.slice(0, 10), picks: [] })

    const picks = data.map((p: any) => ({
      id: p.id,
      home_team: p.home_team,
      away_team: p.away_team,
      selection: p.pick,
      best_odd: typeof p.odds === "number" ? p.odds : Number(p.odds),
      model_prob: typeof p.model_prob === "number" ? p.model_prob * (p.model_prob <= 1 ? 100 : 1) : 0,
      result: p.status === "won" ? "WIN" : "LOSS",
    }))
    return NextResponse.json({ date: fromIso.slice(0, 10), picks })
  } catch {
    return NextResponse.json({ date: fromIso.slice(0, 10), picks: [] })
  }
}

const ALL_SLUGS = ["esp.1", "eng.1", "ger.1", "ita.1", "fra.1", "usa.1", "mex.1", "por.1", "ned.1", "arg.1", "bra.1", "tur.1", "sau.1", "fra.2"]

function normTeam(s: string): string {
  return (s || "").toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, "").trim()
}

function evaluateResult(
  pick: any,
  homeScore: number,
  awayScore: number,
): "WIN" | "LOSS" | "VOID" {
  const { market, selection, home_team, away_team } = pick
  const total = homeScore + awayScore

  if (market === "1X2") {
    if (selection === `Gana ${home_team}`) return homeScore > awayScore ? "WIN" : "LOSS"
    if (selection === `Gana ${away_team}`) return awayScore > homeScore ? "WIN" : "LOSS"
    if (selection === "Empate")            return homeScore === awayScore ? "WIN" : "LOSS"
    return "VOID"
  }
  if (market === "Over/Under 2.5") {
    if (selection === "Over 2.5 Goles")  return total > 2 ? "WIN" : "LOSS"
    if (selection === "Under 2.5 Goles") return total < 3 ? "WIN" : "LOSS"
    return "VOID"
  }
  if (market === "Hándicap") {
    const m = selection.match(/hándicap ([+-]?\d+\.?\d*)$/)
    if (!m) return "VOID"
    const line = parseFloat(m[1])
    const isHome = selection.startsWith(home_team)
    const adj = isHome ? homeScore + line : awayScore + line
    const opp = isHome ? awayScore : homeScore
    if (adj > opp) return "WIN"
    if (adj < opp) return "LOSS"
    return "VOID"
  }
  return "VOID"
}

export async function POST(req: NextRequest) {
  let body: { date?: string; picks?: any[] }
  try { body = await req.json() } catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }) }

  const { date, picks } = body
  if (!date || !Array.isArray(picks) || picks.length === 0) {
    return NextResponse.json({ date: date ?? null, picks: [] })
  }

  const yyyymmdd = date.replace(/-/g, "")

  // Descargar marcadores finales del día en paralelo para todas las ligas
  const resultMap = new Map<string, { homeScore: number; awayScore: number }>()

  await Promise.all(ALL_SLUGS.map(async (slug) => {
    try {
      const res = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${yyyymmdd}`,
        { signal: AbortSignal.timeout(6000) },
      )
      if (!res.ok) return
      const data = await res.json()
      for (const ev of data?.events ?? []) {
        const comp = ev.competitions?.[0]
        if (!comp?.status?.type?.completed) continue
        const home = comp.competitors?.find((c: any) => c.homeAway === "home")
        const away = comp.competitors?.find((c: any) => c.homeAway === "away")
        if (!home || !away) continue
        const key = `${normTeam(home.team.displayName)}|${normTeam(away.team.displayName)}`
        resultMap.set(key, {
          homeScore: parseInt(home.score ?? "0", 10),
          awayScore: parseInt(away.score ?? "0", 10),
        })
      }
    } catch { /* ignorar ligas con error */ }
  }))

  const resolved = picks.map((pick) => {
    const key = `${normTeam(pick.home_team)}|${normTeam(pick.away_team)}`
    const match = resultMap.get(key)
    if (!match) return { ...pick, result: "PENDING" }
    return {
      ...pick,
      result: evaluateResult(pick, match.homeScore, match.awayScore),
      home_score: match.homeScore,
      away_score: match.awayScore,
    }
  })

  return NextResponse.json({ date, picks: resolved })
}
