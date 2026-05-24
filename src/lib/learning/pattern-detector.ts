/**
 * Pattern Detection Engine.
 *
 * Agrupa los PickRecord por dimensiones (mercado, liga, selección, riesgo)
 * y calcula:
 *  - winRate real
 *  - winRate esperado (a partir de las cuotas/implied)
 *  - delta = real - esperado
 *  - Wilson lower bound (medida CONSERVADORA del winRate real)
 *  - significance gate: muestra ≥ MIN_SAMPLES Y Wilson lower > expected
 *
 * Solo los patterns "significant" mueven pesos. Anti-overfitting:
 *  - Z = 1.645 (90% conf)
 *  - El delta tiene que estar fuera de la banda de Wilson para ser significativo.
 */

import type { PickRecord, Pattern } from "./types"
import { LEARNING_CONFIG } from "./types"

// ─────────────────────────────────────────────────────────────────────────────

const Z_90 = 1.645   // intervalo de confianza al 90%

/** Wilson score interval — más fiable que normal para muestras pequeñas */
function wilsonInterval(wins: number, total: number): { lower: number; upper: number } {
  if (total === 0) return { lower: 0, upper: 1 }
  const p = wins / total
  const n = total
  const denom = 1 + (Z_90 * Z_90) / n
  const center = (p + (Z_90 * Z_90) / (2 * n)) / denom
  const halfWidth = (Z_90 * Math.sqrt((p * (1 - p) / n) + (Z_90 * Z_90 / (4 * n * n)))) / denom
  return { lower: Math.max(0, center - halfWidth), upper: Math.min(1, center + halfWidth) }
}

// ─────────────────────────────────────────────────────────────────────────────

/** Genera la clave del patrón a partir del scope */
function patternId(scope: Pattern["scope"]): string {
  const parts: string[] = []
  if (scope.market)        parts.push(`market:${scope.market}`)
  if (scope.league)        parts.push(`league:${scope.league}`)
  if (scope.selectionType) parts.push(`type:${scope.selectionType}`)
  if (scope.riskTier)      parts.push(`risk:${scope.riskTier}`)
  return parts.join("|") || "global"
}

/** Construye un Pattern a partir de un subset de records */
function buildPattern(scope: Pattern["scope"], records: PickRecord[]): Pattern {
  const settled = records.filter((r) => r.result === "WIN" || r.result === "LOSS")
  const voids   = records.filter((r) => r.result === "VOID").length
  const wins    = settled.filter((r) => r.result === "WIN").length
  const losses  = settled.length - wins

  const samples = settled.length
  const winRate = samples > 0 ? wins / samples : 0
  const avgOdd  = samples > 0 ? settled.reduce((s, r) => s + r.odd, 0) / samples : 0
  const avgEdge = samples > 0 ? settled.reduce((s, r) => s + r.edge, 0) / samples : 0
  // ROI compuesto: cada apuesta de 1u, ganas (odd-1)u si WIN, pierdes 1u si LOSS
  const roi = samples > 0
    ? ((wins * avgOdd - samples) / samples) * 100
    : 0

  // WinRate esperado a partir de las cuotas reales
  const expectedWinRate = samples > 0
    ? settled.reduce((s, r) => s + r.impliedProb / 100, 0) / samples
    : 0

  const deltaVsExpected = (winRate - expectedWinRate) * 100  // en puntos

  const { lower: wilsonLower, upper: wilsonUpper } = wilsonInterval(wins, samples)

  // Significativo si:
  //  1. Muestra suficiente
  //  2. La banda de Wilson NO contiene el winRate esperado (es decir, la
  //     diferencia respecto al mercado es estadísticamente real)
  const significant =
    samples >= LEARNING_CONFIG.MIN_SAMPLES_FOR_PATTERN &&
    (wilsonLower > expectedWinRate || wilsonUpper < expectedWinRate)

  // Ajuste de probabilidad recomendado: proporcional al delta, con tope
  // Solo tiene efecto si significant
  let probAdjustment = 0
  if (significant) {
    // delta normalizado: -1 a +1
    const normDelta = Math.max(-1, Math.min(1, deltaVsExpected / 20))
    probAdjustment = normDelta * LEARNING_CONFIG.MAX_PROB_ADJUSTMENT
  }

  return {
    id: patternId(scope),
    scope,
    samples,
    wins,
    losses,
    voids,
    winRate,
    avgOdd,
    avgEdge,
    roi,
    expectedWinRate,
    deltaVsExpected,
    wilsonLower,
    wilsonUpper,
    significant,
    probAdjustment,
    computedAt: new Date().toISOString(),
  }
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detecta TODOS los patrones de interés a partir del histórico reciente.
 * Recorre cada dimensión y combinación útil. Devuelve solo los con muestra ≥ 5
 * (los <30 no son actionable pero se exponen para diagnóstico).
 */
export function detectPatterns(records: PickRecord[]): Pattern[] {
  const out: Pattern[] = []
  if (records.length === 0) return out

  // Helper: agrupa records por una función de clave
  function groupBy<K extends string>(fn: (r: PickRecord) => K): Map<K, PickRecord[]> {
    const m = new Map<K, PickRecord[]>()
    for (const r of records) {
      const k = fn(r)
      const arr = m.get(k) ?? []
      arr.push(r); m.set(k, arr)
    }
    return m
  }

  // 1. Por mercado solo
  for (const [market, recs] of groupBy((r) => r.market)) {
    const p = buildPattern({ market }, recs)
    if (p.samples >= 5) out.push(p)
  }

  // 2. Por liga solo
  for (const [league, recs] of groupBy((r) => r.league)) {
    const p = buildPattern({ league }, recs)
    if (p.samples >= 5) out.push(p)
  }

  // 3. Por mercado × liga (la combinación más rica)
  const marketLeague = new Map<string, PickRecord[]>()
  for (const r of records) {
    const k = `${r.market}|${r.league}`
    const arr = marketLeague.get(k) ?? []
    arr.push(r); marketLeague.set(k, arr)
  }
  for (const [key, recs] of marketLeague) {
    const [market, league] = key.split("|")
    const p = buildPattern({ market, league }, recs)
    if (p.samples >= 5) out.push(p)
  }

  // 4. Por selectionType (Over25, Under25, 1X2-Home, etc.)
  for (const [selectionType, recs] of groupBy((r) => r.selectionType)) {
    const p = buildPattern({ selectionType }, recs)
    if (p.samples >= 5) out.push(p)
  }

  // 5. Por riskTier
  for (const [riskTier, recs] of groupBy((r) => r.riskTier as "low" | "mid" | "high")) {
    const p = buildPattern({ riskTier }, recs)
    if (p.samples >= 5) out.push(p)
  }

  // Ordenar: significativos primero, luego por |delta|
  out.sort((a, b) => {
    if (a.significant && !b.significant) return -1
    if (!a.significant && b.significant) return 1
    return Math.abs(b.deltaVsExpected) - Math.abs(a.deltaVsExpected)
  })

  return out
}

/**
 * Devuelve el ajuste de probabilidad que el patrón histórico sugiere
 * para un (market, league, selectionType) dado. Solo aplica significativos.
 *
 * Estrategia de matching (más específico primero):
 *  1. market × league exacto
 *  2. selectionType global
 *  3. market global
 *  4. 0 (sin ajuste)
 */
export function getProbAdjustmentFor(
  patterns: Pattern[],
  args: { market: string; league: string; selectionType: string },
): { adjustment: number; sourcePattern?: string } {
  const significant = patterns.filter((p) => p.significant)
  if (significant.length === 0) return { adjustment: 0 }

  // 1. market × league
  const specific = significant.find((p) =>
    p.scope.market === args.market && p.scope.league === args.league)
  if (specific) return { adjustment: specific.probAdjustment, sourcePattern: specific.id }

  // 2. selectionType global
  const byType = significant.find((p) =>
    p.scope.selectionType === args.selectionType && !p.scope.market && !p.scope.league)
  if (byType) return { adjustment: byType.probAdjustment, sourcePattern: byType.id }

  // 3. market global
  const byMarket = significant.find((p) =>
    p.scope.market === args.market && !p.scope.league && !p.scope.selectionType)
  if (byMarket) return { adjustment: byMarket.probAdjustment, sourcePattern: byMarket.id }

  return { adjustment: 0 }
}
