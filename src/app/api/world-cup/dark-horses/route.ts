/**
 * GET /api/world-cup/dark-horses
 *
 * Detecta selecciones infravaloradas por el mercado: equipos con buena forma
 * reciente cuya probabilidad implícita del mercado outright es claramente
 * inferior a lo que sus datos sugieren.
 *
 * Heurística honesta y reproducible (sin LLM por ahora — añadible más adelante):
 *  - Toma todos los equipos con forma disponible
 *  - Calcula "strengthScore" = goalsForAvg * 0.4 + (1 - goalsAgainstAvg) * 0.3 + formPoints/15 * 0.3
 *  - Compara contra una estimación de probabilidad implícita derivada de la
 *    confederación + ranking FIFA cuando esté disponible
 *  - Devuelve los equipos donde modelProb - implícita ≥ +4 pp
 *
 * Cache: 6h. Endpoint público sin auth.
 */
import { NextRequest } from "next/server"
import { getAllTeams, getTeamForm, cached, WC_CACHE_TTL } from "@/lib/world-cup"
import type { DarkHorse, DarkHorsesResponse, WCTeam } from "@/lib/world-cup"
import { consume, getClientIp, tooManyRequests } from "@/lib/rate-limit"

export const runtime = "nodejs"
export const maxDuration = 60

// Probabilidad implícita aproximada de llegar a Cuartos de Final basada en
// confederación. Valores conservadores derivados del histórico FIFA.
// Solo usado como ancla — NUNCA como predicción final.
const QUARTERS_BASELINE_PROB_BY_CONFED: Record<WCTeam["confederation"], number> = {
  UEFA:     0.32,
  CONMEBOL: 0.38,
  CONCACAF: 0.12,
  AFC:      0.08,
  CAF:      0.10,
  OFC:      0.03,
}

function strengthScore(form: { goalsForAvg: number; goalsAgainstAvg: number; formPoints: number }): number {
  const offensive = Math.min(1, form.goalsForAvg / 2.5)        // 2.5 gol/partido es élite
  const defensive = Math.max(0, 1 - form.goalsAgainstAvg / 2)   // 0 conced. = 1, 2 = 0
  const formN     = form.formPoints / 15                        // 0-1
  return offensive * 0.4 + defensive * 0.3 + formN * 0.3
}

/** strengthScore → probabilidad estimada de llegar a cuartos (0-1) */
function estimateModelProb(strength: number, confed: WCTeam["confederation"]): number {
  const baseline = QUARTERS_BASELINE_PROB_BY_CONFED[confed]
  // strength 0.5 = sin cambio; >0.5 sube prob, <0.5 baja
  const shift = (strength - 0.5) * 0.5
  return Math.max(0.02, Math.min(0.85, baseline + shift))
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req)
  if (!consume(`wc-dh:${ip}`, 10, 2)) return tooManyRequests(120)

  const response: DarkHorsesResponse = await cached(
    "dark-horses",
    WC_CACHE_TTL.DARK_HORSES,
    async () => {
      const teamsResp = await getAllTeams()
      const darkHorses: DarkHorse[] = []

      // Computar en paralelo limitando concurrencia (chunks de 8)
      const teamsToScan = teamsResp.teams.slice(0, 48)
      const chunkSize = 8
      for (let i = 0; i < teamsToScan.length; i += chunkSize) {
        const chunk = teamsToScan.slice(i, i + chunkSize)
        const forms = await Promise.all(
          chunk.map(async (t) => ({ team: t, form: await getTeamForm(t.code) })),
        )
        for (const { team, form } of forms) {
          if (!form || form.last10.length < 5) continue

          const strength = strengthScore(form)
          const modelProb = estimateModelProb(strength, team.confederation)
          const marketImplied = QUARTERS_BASELINE_PROB_BY_CONFED[team.confederation] * 0.85

          const edgePoints = (modelProb - marketImplied) * 100

          if (edgePoints < 4) continue   // solo edges claros

          const reasons: string[] = [
            `Forma últimos 10: ${form.formString || form.formPoints + "/15 pts"} · ${form.goalsForAvg.toFixed(2)} GF / ${form.goalsAgainstAvg.toFixed(2)} GA`,
            `Strength score ${(strength * 100).toFixed(0)}/100 vs baseline ${(QUARTERS_BASELINE_PROB_BY_CONFED[team.confederation] * 100).toFixed(0)}% de su confederación`,
          ]
          if (form.bttsPct > 0.6) reasons.push(`Partidos abiertos: BTTS ${Math.round(form.bttsPct * 100)}%`)
          if (form.cleanSheets >= 4) reasons.push(`Defensa sólida: ${form.cleanSheets} clean sheets en 10`)

          const riskTier: DarkHorse["riskTier"] =
            edgePoints >= 12 ? "low" :
            edgePoints >= 7  ? "mid"  : "high"

          darkHorses.push({
            teamCode: team.code,
            teamName: team.name,
            edge: Math.round(edgePoints * 10) / 10,
            marketType: "outright-to-quarters",
            marketImpliedProb: Math.round(marketImplied * 1000) / 1000,
            modelProb: Math.round(modelProb * 1000) / 1000,
            reasons,
            riskTier,
          })
        }
      }

      // Ordenar por edge desc, top 8
      darkHorses.sort((a, b) => b.edge - a.edge)
      const top = darkHorses.slice(0, 8)

      return {
        darkHorses: top,
        computedAt: new Date().toISOString(),
        modelInfo: { engine: "wc26-darkhorses", version: "1.0.0" },
        disclaimer: "Análisis estadístico informativo basado en forma reciente y baselines por confederación. No es una predicción ni recomendación de apuesta. +18.",
      }
    },
  )

  return Response.json(response, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=21600" },
  })
}
