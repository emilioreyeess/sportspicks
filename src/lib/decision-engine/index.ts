/**
 * Decision Engine — API pública.
 *
 * Pipeline de uso típico:
 *
 *   import {
 *     runAllModels, runConsensus, runAllGates,
 *     evaluateFinalGate, publishPick
 *   } from "@/lib/decision-engine"
 *
 *   const outputs = runAllModels(snapshot, proposal, historyAdj)
 *   const consensus = runConsensus(outputs, weights.consensus)
 *   const gates = runAllGates(snapshot, proposal, outputs)
 *   const decision = evaluateFinalGate({
 *     qualityScore: pipelineQuality, consensus,
 *     uncertainty: gates.uncertainty,
 *     contradiction: gates.contradiction,
 *     dataValidation: gates.dataValidation,
 *   })
 *   if (decision.approved) publish(pick)
 */

// Tipos
export * from "./types"

// 5 modelos
export {
  modelA_statisticalPure,
  modelB_context,
  modelC_form,
  modelD_market,
  modelE_history,
  runAllModels,
} from "./models"

// Consensus
export { runConsensus } from "./consensus"

// Gates
export {
  dataValidationGate,
  uncertaintyGate,
  contradictionGate,
  runAllGates,
  type AllGatesResult,
} from "./gates"

// Final gate
export {
  evaluateFinalGate,
  evaluateFinalGateWithLLM,
  askLLMVerification,
} from "./final-gate"

// Second opinion
export { runSecondOpinion } from "./second-opinion-engine"

// ─── High-level convenience: `publishPick()` ───────────────────────────────────

import type {
  MatchSnapshot, PickProposal, FinalGateResult, FinalGateInput,
} from "./types"
import type { WeightsConfig } from "../learning/types"
import { runAllModels } from "./models"
import { runConsensus } from "./consensus"
import { runAllGates } from "./gates"
import { evaluateFinalGate, evaluateFinalGateWithLLM } from "./final-gate"

interface PublishPickArgs {
  snapshot: MatchSnapshot
  proposal: PickProposal
  qualityScore: number
  weights: WeightsConfig
  history: { probAdjustment: number; sourcePattern?: string }
  /** Si true y existe ANTHROPIC_API_KEY, hace el doble-check con LLM */
  withLLMVerification?: boolean
  anthropicApiKey?: string
}

/**
 * One-shot: ejecuta los 5 modelos, consensus, gates y final gate.
 * Devuelve el resultado completo + decisión final approved/blocked.
 */
export async function publishPick(args: PublishPickArgs): Promise<{
  decision: FinalGateResult
  consensus: ReturnType<typeof runConsensus>
  gates: ReturnType<typeof runAllGates>
  modelOutputs: ReturnType<typeof runAllModels>
}> {
  const modelOutputs = runAllModels(args.snapshot, args.proposal, args.history)
  const consensus = runConsensus(modelOutputs, args.weights.consensus)
  const gates = runAllGates(args.snapshot, args.proposal, modelOutputs)

  const gateInput: FinalGateInput = {
    qualityScore: args.qualityScore,
    consensus,
    uncertainty: gates.uncertainty,
    contradiction: gates.contradiction,
    dataValidation: gates.dataValidation,
  }

  let decision: FinalGateResult
  if (args.withLLMVerification && args.anthropicApiKey) {
    decision = await evaluateFinalGateWithLLM(gateInput, {
      match: args.snapshot,
      pick: args.proposal,
      qualityScore: args.qualityScore,
      consensusProb: consensus.consensusProb,
      consensusConfidence: consensus.consensusConfidence,
      uncertaintyScore: gates.uncertainty.score,
      contradictionScore: gates.contradiction.score,
      modelExplanations: modelOutputs.map((o) => o.explanation),
    }, args.anthropicApiKey)
  } else {
    decision = evaluateFinalGate(gateInput)
  }

  return { decision, consensus, gates, modelOutputs }
}
