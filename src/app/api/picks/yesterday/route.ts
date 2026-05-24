/**
 * POST /api/picks/yesterday
 * Body: { date: "YYYY-MM-DD", picks: Pick[] }
 *
 * Recibe los picks guardados en el cliente (localStorage) y los enriquece
 * con los resultados reales del marcador de ESPN.
 * No depende de almacenamiento en servidor — funciona en Vercel serverless.
 */
import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const revalidate = 0

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
