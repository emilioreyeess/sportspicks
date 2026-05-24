/**
 * Auto Weight Adjustment con safeguards anti-overfitting.
 *
 * Reglas absolutas (todas se aplican):
 *  - Solo se ajusta si hay >= MIN_SAMPLES_FOR_PATTERN muestras totales
 *  - Cambio máximo por día: MAX_WEIGHT_CHANGE_PER_DAY
 *  - Distancia máxima del baseline: MAX_WEIGHT_DRIFT_FROM_BASE
 *  - Si NO hay patterns significativos → NO se toca nada
 *  - Cada cambio se registra en adjustmentHistory con razón explícita
 */

import type { Pattern, WeightsConfig, PickRecord } from "./types"
import { DEFAULT_WEIGHTS, LEARNING_CONFIG } from "./types"

// ─────────────────────────────────────────────────────────────────────────────

interface AdjustmentDecision {
  target: string                  // "consensus.context" / "scoring.edge"
  from: number
  to: number
  reason: string
}

/**
 * Decide qué pesos ajustar (y cuánto) basándose en:
 *  - Performance global del modelo (winRate vs implied) → ajusta scoring
 *  - Performance por dimensión (patterns) → puede sugerir cambios en consensus
 *
 * IMPORTANTE: devuelve la decisión ANTES de aplicarla. El daily job decide
 * si aplica o no según otros gates.
 */
export function planAdjustments(args: {
  current: WeightsConfig
  patterns: Pattern[]
  recentRecords: PickRecord[]
  todayDate: string
}): AdjustmentDecision[] {
  const { current, patterns, recentRecords, todayDate } = args
  const decisions: AdjustmentDecision[] = []

  const settled = recentRecords.filter((r) => r.result === "WIN" || r.result === "LOSS")
  if (settled.length < LEARNING_CONFIG.MIN_SAMPLES_FOR_PATTERN) {
    return [] // sin muestra suficiente, no tocamos nada
  }

  // ── 1. Performance global: ¿edge real o sobrevalorado? ────────────────────
  const wins = settled.filter((r) => r.result === "WIN").length
  const realWinRate = wins / settled.length
  const expectedWinRate = settled.reduce((s, r) => s + r.modelProb / 100, 0) / settled.length

  // Si el modelo está sobreestimando consistentemente → bajar peso edge, subir mercado
  // Si está infravalorando (winRate > esperado) → subir peso edge
  const overEstimation = expectedWinRate - realWinRate  // positivo = sobrestima
  const wilsonGap = Math.abs(overEstimation)

  if (wilsonGap > 0.05) {
    // El modelo está descalibrado en >5 puntos → ajustar
    const direction = overEstimation > 0 ? -1 : +1   // si sobrestima → bajar edge
    const magnitude = Math.min(LEARNING_CONFIG.MAX_WEIGHT_CHANGE_PER_DAY, wilsonGap * 0.3)

    // scoring.edge ajustar
    const newEdge = clampDrift(
      current.scoring.edge + direction * magnitude,
      DEFAULT_WEIGHTS.scoring.edge,
    )
    if (Math.abs(newEdge - current.scoring.edge) >= 0.005) {
      decisions.push({
        target: "scoring.edge",
        from: current.scoring.edge, to: newEdge,
        reason: `Modelo ${overEstimation > 0 ? "sobrestima" : "infraestima"} ${(wilsonGap * 100).toFixed(1)}pts sobre ${settled.length} picks`,
      })
    }

    // Y compensar el peso del mercado en consensus en dirección contraria
    const newMarketConsensus = clampDrift(
      current.consensus.market - direction * magnitude * 0.5,
      DEFAULT_WEIGHTS.consensus.market,
    )
    if (Math.abs(newMarketConsensus - current.consensus.market) >= 0.005) {
      decisions.push({
        target: "consensus.market",
        from: current.consensus.market, to: newMarketConsensus,
        reason: `Compensación: subir peso del mercado al haber descalibración del modelo`,
      })
    }
  }

  // ── 2. Performance por dimensión: subir peso de history si patterns funcionan ──
  const significantPatterns = patterns.filter((p) => p.significant)
  if (significantPatterns.length >= 3) {
    // Si tenemos patterns útiles funcionando, history merece más peso en consensus
    const newHistory = clampDrift(
      current.consensus.history + LEARNING_CONFIG.MAX_WEIGHT_CHANGE_PER_DAY * 0.5,
      DEFAULT_WEIGHTS.consensus.history,
    )
    if (newHistory > current.consensus.history + 0.005) {
      decisions.push({
        target: "consensus.history",
        from: current.consensus.history, to: newHistory,
        reason: `${significantPatterns.length} patrones significativos detectados — subir peso histórico`,
      })
    }
  }

  // ── 3. Si el agreement del consensus correlaciona con winRate, subir context ──
  // (heurística: en records donde agreement > 75 el winRate debería ser mayor)
  const highAgreement = settled.filter((r) => r.consensusAgreement > 75)
  const lowAgreement  = settled.filter((r) => r.consensusAgreement < 65)
  if (highAgreement.length >= 10 && lowAgreement.length >= 10) {
    const highWin = highAgreement.filter((r) => r.result === "WIN").length / highAgreement.length
    const lowWin  = lowAgreement.filter((r) => r.result === "WIN").length / lowAgreement.length
    if (highWin - lowWin > 0.08) {
      // El agreement es predictivo → context y form merecen más peso
      const newContext = clampDrift(
        current.consensus.context + LEARNING_CONFIG.MAX_WEIGHT_CHANGE_PER_DAY * 0.4,
        DEFAULT_WEIGHTS.consensus.context,
      )
      if (newContext > current.consensus.context + 0.005) {
        decisions.push({
          target: "consensus.context",
          from: current.consensus.context, to: newContext,
          reason: `WinRate de alta concordancia (${(highWin * 100).toFixed(0)}%) supera baja (${(lowWin * 100).toFixed(0)}%) — subir context`,
        })
      }
    }
  }

  return decisions
}

/** Aplica un decision al WeightsConfig y devuelve la nueva config */
export function applyAdjustments(
  current: WeightsConfig,
  decisions: AdjustmentDecision[],
  todayDate: string,
): WeightsConfig {
  if (decisions.length === 0) return current

  const next: WeightsConfig = JSON.parse(JSON.stringify(current))
  for (const d of decisions) {
    const [section, field] = d.target.split(".") as ["consensus" | "scoring", string]
    if (next[section] && field in next[section]) {
      ;(next[section] as any)[field] = d.to
    }
  }

  // Normalizar consensus a que sume ~1
  const consensusSum = Object.values(next.consensus).reduce((s, v) => s + v, 0)
  if (consensusSum > 0 && Math.abs(consensusSum - 1) > 0.05) {
    for (const k of Object.keys(next.consensus) as Array<keyof WeightsConfig["consensus"]>) {
      next.consensus[k] = next.consensus[k] / consensusSum
    }
  }

  next.lastAdjustedAt = new Date().toISOString()
  next.adjustmentHistory.unshift({
    date: todayDate,
    changes: decisions.map((d) => `${d.target}: ${d.from.toFixed(3)} → ${d.to.toFixed(3)}`),
    triggeredBy: decisions.map((d) => d.reason).join(" · "),
  })
  next.adjustmentHistory = next.adjustmentHistory.slice(0, 30)
  return next
}

/** Limita un valor a estar dentro de MAX_DRIFT del baseline */
function clampDrift(value: number, baseline: number): number {
  const max = baseline + LEARNING_CONFIG.MAX_WEIGHT_DRIFT_FROM_BASE
  const min = Math.max(0.01, baseline - LEARNING_CONFIG.MAX_WEIGHT_DRIFT_FROM_BASE)
  return Math.min(max, Math.max(min, value))
}
