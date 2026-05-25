/**
 * Consensus Engine — combina los 5 outputs en una probabilidad y confianza.
 *
 * Fórmula:
 *   consensusProb = sum(probabilities[i] * weight[i]) / sum(weight[i])  — solo no-abstenidos
 *   stdev = desviación estándar de las probabilidades
 *   agreement = 1 - normalize(stdev)
 *   consensusConfidence = mean(confidences) * agreement * (1 - abstentionPenalty)
 *
 * Penalización por desviación extrema:
 *   stdev > 0.20 → la divergencia entre modelos es tan alta que el consenso
 *   pierde fiabilidad. Aplica un factor multiplicativo sobre confidence.
 */

import type { ModelOutput, ConsensusResult, ModelId } from "./types"
import type { WeightsConfig } from "../learning/types"

const MODEL_TO_WEIGHT_KEY: Record<ModelId, keyof WeightsConfig["consensus"]> = {
  A: "stat",
  B: "context",
  C: "form",
  D: "market",
  E: "history",
}

/** Desviación estándar poblacional */
function stdev(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((s, v) => s + v, 0) / values.length
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

export function runConsensus(
  outputs: ModelOutput[],
  weights: WeightsConfig["consensus"],
): ConsensusResult {
  if (outputs.length !== 5) {
    throw new Error(`runConsensus: esperaba 5 modelos, recibí ${outputs.length}`)
  }

  const active = outputs.filter((o) => !o.abstain)
  const abstentions = outputs.length - active.length

  // Si TODOS abstienen, no hay decisión posible
  if (active.length === 0) {
    return {
      consensusProb: 0,
      consensusConfidence: 0,
      agreement: 0,
      perModel: outputs,
      weights,
      abstentions: 5,
      stdev: 0,
    }
  }

  // Pesos efectivos: solo de los modelos activos. Normalizados para que sumen 1.
  const activeWeights = active.map((o) => weights[MODEL_TO_WEIGHT_KEY[o.modelId]])
  const totalW = activeWeights.reduce((s, w) => s + w, 0)
  const normalizedW = activeWeights.map((w) => (totalW > 0 ? w / totalW : 1 / active.length))

  // Probabilidad consensuada
  const consensusProb = active.reduce(
    (s, o, i) => s + o.probability * normalizedW[i],
    0,
  )

  // Desviación entre los modelos activos (señal de divergencia)
  const probsSpread = stdev(active.map((o) => o.probability))

  // Agreement: 1 cuando todos coinciden, 0 cuando divergen máximamente (stdev 0.5)
  const agreement = Math.max(0, 1 - probsSpread / 0.5)

  // Penalización por divergencia:
  //   stdev <= 0.10 → factor 1.0 (sin penalización)
  //   stdev 0.10-0.20 → factor 0.85
  //   stdev > 0.20 → factor 0.65
  let divergencePenalty = 1.0
  if (probsSpread > 0.20) divergencePenalty = 0.65
  else if (probsSpread > 0.10) divergencePenalty = 0.85

  // Penalización por abstenciones: cada modelo abstenido baja la confianza
  //   0 abstenciones → factor 1.00
  //   1 abstención  → factor 0.92
  //   2 abstenciones → factor 0.80
  //   3 abstenciones → factor 0.65
  //   4 abstenciones → factor 0.45
  const abstentionPenalty = [1.0, 0.92, 0.80, 0.65, 0.45][abstentions] ?? 0.3

  // Confianza media de los activos
  const avgConfidence = active.reduce((s, o) => s + o.confidence, 0) / active.length

  const consensusConfidence = Math.max(0, Math.min(1,
    avgConfidence * divergencePenalty * abstentionPenalty,
  ))

  return {
    consensusProb: Math.max(0, Math.min(1, consensusProb)),
    consensusConfidence,
    agreement,
    perModel: outputs,
    weights,
    abstentions,
    stdev: probsSpread,
  }
}
