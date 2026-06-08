/**
 * Motor de cálculo de rendimiento — función pura sobre PickRecord[].
 *
 * REGLA CRÍTICA: protecciones estrictas contra división por cero / NaN.
 * Con array vacío o stake total 0, todas las métricas devuelven 0.
 *
 * Convenciones:
 *  · Beneficio neto: Won → stake·(odds−1); Lost → −stake; Void → 0.
 *  · Total apostado: suma de stakes EXCLUYENDO los Void (la stake se devuelve).
 *  · ROI y Yield: beneficio / total apostado × 100 (coinciden en stake por unidades).
 *  · Win rate: ganadas / (ganadas + perdidas) × 100 (los Void no cuentan).
 */

import type { PickRecord } from "@/data/picks"

export interface PerformanceMetrics {
  totalStaked: number
  netProfit: number
  roi: number        // %
  yield: number      // %
  winRate: number    // %
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function calculatePerformance(picks: PickRecord[]): PerformanceMetrics {
  const empty: PerformanceMetrics = { totalStaked: 0, netProfit: 0, roi: 0, yield: 0, winRate: 0 }
  if (!Array.isArray(picks) || picks.length === 0) return empty

  let totalStaked = 0
  let netProfit = 0
  let won = 0
  let settled = 0   // won + lost (excluye void)

  for (const p of picks) {
    const stake = Number(p.stakeUnits)
    const odds = Number(p.recommendedOdds)
    if (!Number.isFinite(stake) || stake <= 0) continue   // entrada inválida → se ignora

    if (p.result === "Won") {
      const profit = Number.isFinite(odds) ? stake * (odds - 1) : 0
      netProfit += profit
      totalStaked += stake
      won++
      settled++
    } else if (p.result === "Lost") {
      netProfit -= stake
      totalStaked += stake
      settled++
    }
    // Void: stake devuelta → no suma a totalStaked, profit 0, no cuenta en winrate.
  }

  // Guardas anti-NaN / división por cero.
  const roi = totalStaked > 0 ? (netProfit / totalStaked) * 100 : 0
  const yieldPct = totalStaked > 0 ? (netProfit / totalStaked) * 100 : 0
  const winRate = settled > 0 ? (won / settled) * 100 : 0

  return {
    totalStaked: round2(totalStaked),
    netProfit: round2(netProfit),
    roi: round2(roi),
    yield: round2(yieldPct),
    winRate: round2(winRate),
  }
}
