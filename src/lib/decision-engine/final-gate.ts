/**
 * Final Quality Gate — la última puerta antes de publicar.
 *
 * Evalúa CINCO scores contra los thresholds T1-T5 (definidos en types.ts).
 * Si TODOS pasan, opcionalmente pregunta al LLM la pregunta final:
 *
 *   "¿Existe suficiente evidencia real e irrefutable para defender
 *    este pick profesionalmente ante un cliente?"
 *
 * El LLM responde con JSON estructurado { defensible: boolean, rationale: string }.
 * Solo si responde `true`, el pick se aprueba.
 *
 * IMPORTANTE: la llamada al LLM es OPCIONAL. La función `evaluateFinalGate()`
 * decide PASS/FAIL de forma síncrona basándose solo en los thresholds.
 * `evaluateFinalGateWithLLM()` añade el doble-check con Anthropic.
 */

import Anthropic from "@anthropic-ai/sdk"
import {
  FINAL_GATE_THRESHOLDS,
  type FinalGateInput,
  type FinalGateResult,
  type MatchSnapshot,
  type PickProposal,
} from "./types"

// ─── Síncrono — sin LLM ───────────────────────────────────────────────────────

export function evaluateFinalGate(input: FinalGateInput): FinalGateResult {
  const { qualityScore, consensus, uncertainty, contradiction, dataValidation } = input
  const T = FINAL_GATE_THRESHOLDS

  const scoreboard = {
    quality:       { value: qualityScore,                 threshold: T.T1_QUALITY_MIN,       pass: qualityScore >= T.T1_QUALITY_MIN },
    confidence:    { value: consensus.consensusConfidence, threshold: T.T2_CONFIDENCE_MIN,    pass: consensus.consensusConfidence >= T.T2_CONFIDENCE_MIN },
    uncertainty:   { value: uncertainty.score,             threshold: T.T3_UNCERTAINTY_MAX,   pass: uncertainty.score <= T.T3_UNCERTAINTY_MAX },
    consensus:     { value: consensus.consensusProb,       threshold: T.T4_CONSENSUS_MIN,     pass: consensus.consensusProb >= T.T4_CONSENSUS_MIN },
    contradiction: { value: contradiction.score,           threshold: T.T5_CONTRADICTION_MAX, pass: contradiction.score <= T.T5_CONTRADICTION_MAX },
    dataValid:     { pass: dataValidation.status !== "BLOCK" },
  }

  const allPass =
    scoreboard.quality.pass &&
    scoreboard.confidence.pass &&
    scoreboard.uncertainty.pass &&
    scoreboard.consensus.pass &&
    scoreboard.contradiction.pass &&
    scoreboard.dataValid.pass

  let blockReason: string | null = null
  if (!allPass) {
    if (!scoreboard.dataValid.pass)         blockReason = "Data validation falló"
    else if (!scoreboard.uncertainty.pass)  blockReason = `Incertidumbre demasiado alta (${uncertainty.score} > ${T.T3_UNCERTAINTY_MAX})`
    else if (!scoreboard.contradiction.pass) blockReason = `Modelos contradictorios (${contradiction.score} > ${T.T5_CONTRADICTION_MAX})`
    else if (!scoreboard.quality.pass)       blockReason = `Quality insuficiente (${qualityScore} < ${T.T1_QUALITY_MIN})`
    else if (!scoreboard.confidence.pass)    blockReason = `Confianza insuficiente (${consensus.consensusConfidence.toFixed(2)} < ${T.T2_CONFIDENCE_MIN})`
    else if (!scoreboard.consensus.pass)     blockReason = `Probabilidad consensuada insuficiente (${(consensus.consensusProb * 100).toFixed(0)}% < ${T.T4_CONSENSUS_MIN * 100}%)`
  }

  return {
    approved: allPass,
    blockReason,
    scoreboard,
  }
}

// ─── Asíncrono — con LLM ──────────────────────────────────────────────────────

const LLM_VERIFICATION_PROMPT = `Eres un analista deportivo senior con autoridad de veto. Te muestro la decisión de un motor cuantitativo para publicar un pick.

PREGUNTA OBLIGATORIA: "¿Existe suficiente evidencia real e irrefutable para defender este pick profesionalmente ante un cliente que paga por análisis serio?"

REGLA: Solo responde \`defensible: true\` si la respuesta sería sí en cualquier escenario razonable. En la duda, responde false — proteger el bankroll del cliente es prioridad absoluta.

Responde SOLO con JSON válido en una línea:
{"defensible": boolean, "rationale": "≤180 caracteres explicando tu decisión"}`

interface PickContextForLLM {
  match: MatchSnapshot
  pick: PickProposal
  qualityScore: number
  consensusProb: number
  consensusConfidence: number
  uncertaintyScore: number
  contradictionScore: number
  modelExplanations: string[]
}

/**
 * Pregunta al LLM si el pick es defensible. Devuelve null en caso de fallo
 * (el caller decide si bloquear por safety o pasar — recomendamos bloquear).
 */
export async function askLLMVerification(
  ctx: PickContextForLLM,
  apiKey: string,
  timeoutMs = 8000,
): Promise<{ defensible: boolean; rationale: string } | null> {
  if (!apiKey) return null

  const userMessage = `PARTIDO: ${ctx.match.homeName} vs ${ctx.match.awayName} (${ctx.match.leagueName})
KICKOFF: ${ctx.match.kickoffISO}
PICK: ${ctx.pick.selection} (${ctx.pick.market}) @ cuota ${ctx.pick.odd.toFixed(2)}

SCORES DEL MOTOR:
- Quality: ${ctx.qualityScore}/100
- Consensus probability: ${(ctx.consensusProb * 100).toFixed(1)}%
- Consensus confidence: ${(ctx.consensusConfidence * 100).toFixed(0)}%
- Uncertainty: ${ctx.uncertaintyScore}/100 (menor = mejor)
- Contradiction: ${ctx.contradictionScore}/100 (menor = mejor)

EXPLICACIONES POR MODELO:
${ctx.modelExplanations.map((e, i) => `  ${i + 1}. ${e}`).join("\n")}

Pregunta final.`

  try {
    const client = new Anthropic({ apiKey, timeout: timeoutMs })
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 200,
      system: LLM_VERIFICATION_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    })

    const txt = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim()

    // Extraer el JSON (a veces el LLM envuelve en markdown)
    const match = txt.match(/\{[^{}]*"defensible"[^{}]*\}/)
    if (!match) return null

    const parsed: unknown = JSON.parse(match[0])
    if (
      typeof parsed === "object" && parsed !== null &&
      "defensible" in parsed && typeof (parsed as { defensible: unknown }).defensible === "boolean" &&
      "rationale" in parsed && typeof (parsed as { rationale: unknown }).rationale === "string"
    ) {
      const safe = parsed as { defensible: boolean; rationale: string }
      return {
        defensible: safe.defensible,
        rationale: safe.rationale.slice(0, 220),
      }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Versión completa que combina evaluación síncrona + verificación LLM.
 * Si el LLM falla o dice false, el pick NO se aprueba.
 */
export async function evaluateFinalGateWithLLM(
  input: FinalGateInput,
  ctx: PickContextForLLM,
  apiKey: string,
): Promise<FinalGateResult> {
  const sync = evaluateFinalGate(input)
  if (!sync.approved) return sync   // ya falló antes del LLM

  const llm = await askLLMVerification(ctx, apiKey)

  if (!llm) {
    // Fallo de red / LLM no disponible → MEJOR NO PUBLICAR
    return {
      ...sync,
      approved: false,
      blockReason: "Verificación LLM no disponible — no publicamos sin doble-check",
      llmVerification: { asked: true, answer: null, rationale: "LLM no respondió" },
    }
  }

  return {
    ...sync,
    approved: llm.defensible,
    blockReason: llm.defensible ? null : `LLM rechazó: ${llm.rationale}`,
    llmVerification: { asked: true, answer: llm.defensible, rationale: llm.rationale },
  }
}
