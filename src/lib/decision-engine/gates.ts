/**
 * Validation Gates — middleware estricto antes de aprobar un pick.
 *
 * Tres gates secuenciales:
 *   1. DataValidationGate   — ¿tenemos suficientes datos para razonar?
 *   2. UncertaintyGate       — ¿cuánta incertidumbre estructural hay?
 *   3. ContradictionGate     — ¿los modelos se contradicen entre sí?
 *
 * Cada gate devuelve un GateResult con status PASS/WARN/BLOCK + razones.
 * Si CUALQUIER gate devuelve BLOCK, el pick no debe publicarse.
 */

import type { MatchSnapshot, PickProposal, ModelOutput, GateResult } from "./types"

// ═══════════════════════════════════════════════════════════════════════════════
// 1. DATA VALIDATION GATE
// ═══════════════════════════════════════════════════════════════════════════════

const MIN_GAMES_PER_TEAM = 5
const MIN_ODD = 1.10
const MAX_ODD = 7.00

/** Verifica que tenemos los datos mínimos para confiar en el pick. */
export function dataValidationGate(m: MatchSnapshot, p: PickProposal): GateResult {
  const missing: string[] = []
  const reasons: string[] = []

  // Campos esenciales del snapshot
  if (!m.matchId)          missing.push("matchId")
  if (!m.kickoffISO)       missing.push("kickoffISO")
  if (!m.homeName)         missing.push("homeName")
  if (!m.awayName)         missing.push("awayName")
  if (!Number.isFinite(m.marketOdds))      missing.push("marketOdds")
  if (!Number.isFinite(m.baseModelProb))   missing.push("baseModelProb")
  if (!Number.isFinite(m.expectedGoals))   missing.push("expectedGoals")

  // Muestra mínima de forma
  if (m.homeGamesPlayed < MIN_GAMES_PER_TEAM) {
    reasons.push(`${m.homeName}: solo ${m.homeGamesPlayed} partidos jugados (mínimo ${MIN_GAMES_PER_TEAM})`)
  }
  if (m.awayGamesPlayed < MIN_GAMES_PER_TEAM) {
    reasons.push(`${m.awayName}: solo ${m.awayGamesPlayed} partidos jugados (mínimo ${MIN_GAMES_PER_TEAM})`)
  }

  // Cuotas en rango operativo
  if (p.odd < MIN_ODD || p.odd > MAX_ODD) {
    reasons.push(`Cuota ${p.odd} fuera del rango operativo [${MIN_ODD}, ${MAX_ODD}]`)
  }

  // Kickoff válido y futuro
  if (m.kickoffISO) {
    const kickoffMs = new Date(m.kickoffISO).getTime()
    if (!Number.isFinite(kickoffMs)) {
      reasons.push("Kickoff con formato inválido")
    } else if (kickoffMs < Date.now() - 60_000) {
      reasons.push("Partido ya empezó / terminó")
    }
  }

  // Selection no vacía
  if (!p.selection || p.selection.length < 2) {
    missing.push("selection")
  }

  // Completeness score: % de campos OK
  const totalChecks = 7 + 4   // 7 campos + 4 reglas
  const failed = missing.length + reasons.length
  const completeness = Math.max(0, Math.min(100, ((totalChecks - failed) / totalChecks) * 100))

  const status = missing.length > 0 || reasons.length > 0 ? "BLOCK" : "PASS"

  return {
    gate: "data-validation",
    status,
    score: completeness,
    reasons: [...missing.map((f) => `Campo faltante: ${f}`), ...reasons],
    missingFields: missing.length > 0 ? missing : undefined,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. UNCERTAINTY GATE
// ═══════════════════════════════════════════════════════════════════════════════

const UNCERTAINTY_BLOCK_THRESHOLD = 65   // ≥65 → BLOCK
const UNCERTAINTY_WARN_THRESHOLD  = 40   // ≥40 → WARN

/**
 * Calcula un score de incertidumbre 0-100 sumando factores agravantes.
 * 0 = pick limpio en condiciones óptimas
 * 100 = inviable, demasiada incertidumbre estructural
 */
export function uncertaintyGate(m: MatchSnapshot, p: PickProposal): GateResult {
  const reasons: string[] = []
  let score = 0

  // Muestra pequeña en cualquier equipo
  if (m.homeGamesPlayed < 8) {
    score += 15
    reasons.push(`Muestra reducida del local: ${m.homeGamesPlayed} partidos`)
  }
  if (m.awayGamesPlayed < 8) {
    score += 15
    reasons.push(`Muestra reducida del visitante: ${m.awayGamesPlayed} partidos`)
  }

  // Kickoff muy próximo: sin tiempo para verificar alineaciones
  const minutesToKickoff = (new Date(m.kickoffISO).getTime() - Date.now()) / 60_000
  if (minutesToKickoff >= 0 && minutesToKickoff < 120) {
    score += 20
    reasons.push(`Kickoff en ${Math.round(minutesToKickoff)} min — alineaciones no verificables`)
  }

  // Cuota implícita extrema (mercado muy convencido o totalmente despreocupado)
  if (m.marketImpliedProb > 0.78) {
    score += 12
    reasons.push("Mercado muy convencido (implícita >78%) — poco margen para edge real")
  }
  if (m.marketImpliedProb < 0.18) {
    score += 18
    reasons.push("Cuota muy alta (implícita <18%) — riesgo intrínseco elevado")
  }

  // Probabilidad base intrínsecamente débil
  if (p.baseProb < 0.45) {
    score += 12
    reasons.push(`Probabilidad base baja (${(p.baseProb * 100).toFixed(0)}%)`)
  }

  // Forma errática: si la racha del local o visitante varía mucho (W-L-W-L-W)
  const homeAlternation = countAlternation(m.homeForm)
  const awayAlternation = countAlternation(m.awayForm)
  if (homeAlternation >= 3 || awayAlternation >= 3) {
    score += 10
    reasons.push("Forma errática en al menos un equipo (alternancia W/L alta)")
  }

  // Motivación contradictoria (uno necesita ganar, otro relajado) → señal mixta
  if (Math.abs(m.homeMotivFactor - m.awayMotivFactor) > 0.25) {
    score += 8
    reasons.push("Diferencia motivacional muy marcada — puede invertir el modelo")
  }

  score = Math.min(100, score)

  const status =
    score >= UNCERTAINTY_BLOCK_THRESHOLD ? "BLOCK" :
    score >= UNCERTAINTY_WARN_THRESHOLD  ? "WARN"  : "PASS"

  return { gate: "uncertainty", status, score, reasons }
}

/** Cuenta cambios consecutivos entre W/L/D en un string de forma */
function countAlternation(form: string): number {
  if (form.length < 2) return 0
  let changes = 0
  for (let i = 1; i < form.length; i++) {
    if (form[i] !== form[i - 1]) changes++
  }
  return changes
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. CONTRADICTION GATE
// ═══════════════════════════════════════════════════════════════════════════════

const CONTRADICTION_BLOCK_THRESHOLD = 55   // ≥55 → BLOCK
const CONTRADICTION_WARN_THRESHOLD  = 30   // ≥30 → WARN

/**
 * Detecta conflictos lógicos entre los 5 modelos.
 *
 * Casos:
 *  - Dos modelos no-abstenidos discrepan más de 0.25 en probabilidad
 *  - Modelo A dice "alto" pero Modelo B dice "contexto contrario"
 *  - Modelo D detecta edge negativo mientras A/B dicen alto
 */
export function contradictionGate(outputs: ModelOutput[]): GateResult {
  const active = outputs.filter((o) => !o.abstain)
  const reasons: string[] = []
  let score = 0

  if (active.length < 2) {
    // Sin al menos 2 modelos activos, no se puede medir contradicción
    return {
      gate: "contradiction",
      status: active.length === 0 ? "BLOCK" : "WARN",
      score: 0,
      reasons: active.length === 0
        ? ["Todos los modelos se abstuvieron — sin base para evaluar"]
        : ["Solo un modelo se pronunció — sin segunda opinión"],
    }
  }

  // 1. Discrepancias por pares
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const diff = Math.abs(active[i].probability - active[j].probability)
      if (diff >= 0.30) {
        score += 18
        reasons.push(
          `Modelo ${active[i].modelId} (${(active[i].probability * 100).toFixed(0)}%) vs Modelo ${active[j].modelId} (${(active[j].probability * 100).toFixed(0)}%) discrepan ${(diff * 100).toFixed(0)}pp`,
        )
      } else if (diff >= 0.20) {
        score += 10
      } else if (diff >= 0.15) {
        score += 5
      }
    }
  }

  // 2. El modelo D (mercado) discrepa MUCHO del consenso estadístico
  const modelD = outputs.find((o) => o.modelId === "D")
  const modelA = outputs.find((o) => o.modelId === "A")
  if (modelD && modelA && !modelD.abstain && !modelA.abstain) {
    const dvsA = modelA.probability - modelD.probability
    if (dvsA > 0.20) {
      // El stat dice mucho más probable de lo que el mercado refleja
      score += 12
      reasons.push("Modelo estadístico (A) muy por encima del mercado (D) — posible info perdida")
    }
  }

  // 3. Confianzas opuestas: un modelo con alta confianza dice algo distinto de otro con alta confianza
  const highConfActive = active.filter((o) => o.confidence > 0.6)
  if (highConfActive.length >= 2) {
    const probs = highConfActive.map((o) => o.probability)
    const max = Math.max(...probs)
    const min = Math.min(...probs)
    if (max - min > 0.25) {
      score += 15
      reasons.push("Dos modelos con confianza alta sostienen probabilidades opuestas")
    }
  }

  score = Math.min(100, score)

  const status =
    score >= CONTRADICTION_BLOCK_THRESHOLD ? "BLOCK" :
    score >= CONTRADICTION_WARN_THRESHOLD  ? "WARN"  : "PASS"

  return { gate: "contradiction", status, score, reasons }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Runner: ejecuta los 3 gates en orden y devuelve los resultados
// ═══════════════════════════════════════════════════════════════════════════════

export interface AllGatesResult {
  dataValidation: GateResult
  uncertainty: GateResult
  contradiction: GateResult
  /** Hay al menos un BLOCK */
  anyBlock: boolean
}

export function runAllGates(
  m: MatchSnapshot,
  p: PickProposal,
  outputs: ModelOutput[],
): AllGatesResult {
  const dataValidation = dataValidationGate(m, p)

  // Si los datos no son válidos, no tiene sentido seguir
  if (dataValidation.status === "BLOCK") {
    return {
      dataValidation,
      uncertainty: { gate: "uncertainty", status: "BLOCK", score: 100, reasons: ["Bloqueado por data-validation"] },
      contradiction: { gate: "contradiction", status: "BLOCK", score: 100, reasons: ["Bloqueado por data-validation"] },
      anyBlock: true,
    }
  }

  const uncertainty = uncertaintyGate(m, p)
  const contradiction = contradictionGate(outputs)

  // dataValidation.status ya es PASS|WARN aquí (BLOCK retorna antes)
  const anyBlock =
    uncertainty.status === "BLOCK" ||
    contradiction.status === "BLOCK"

  return { dataValidation, uncertainty, contradiction, anyBlock }
}
