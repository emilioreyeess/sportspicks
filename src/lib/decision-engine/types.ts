/**
 * Decision Engine — Tipos centrales.
 *
 * Filosofía:
 *   - Inmutable: ningún módulo modifica los inputs.
 *   - Estricto: cero `any` en interfaces públicas. Cero tipos opcionales no documentados.
 *   - Auditable: cada decisión (consensus, gate, final) lleva una explicación textual.
 *
 * Regla de oro: si una función no puede decidir con confianza, devuelve null o
 *   una decisión "BLOCK" explícita. Nunca un valor placeholder.
 */

// ─── Contexto de evaluación ───────────────────────────────────────────────────

/** Snapshot mínimo de un partido para que un modelo pueda razonar. */
export interface MatchSnapshot {
  matchId: string
  league: string                  // slug ("esp.1")
  leagueName: string
  homeName: string
  awayName: string
  kickoffISO: string              // ISO 8601
  /** Cuotas reales del bookmaker para el mercado evaluado */
  marketOdds: number              // cuota del selection (e.g. 1.85)
  /** Probabilidad implícita derivada de la cuota (0-1) */
  marketImpliedProb: number
  /** Probabilidad del modelo base Poisson (0-1) */
  baseModelProb: number
  /** xG estimado del partido (lambdaHome + lambdaAway) */
  expectedGoals: number
  /** Partidos jugados por cada equipo en últimos 10 (medida de fiabilidad de la muestra) */
  homeGamesPlayed: number
  awayGamesPlayed: number
  /** Forma reciente: "WWDLW" (5 últimos) */
  homeForm: string
  awayForm: string
  /** 0-1 — puntos de los últimos 5 / 15 */
  homeFormPoints: number
  awayFormPoints: number
  /** Estado motivacional clasificado */
  homeMotivStatus: string
  awayMotivStatus: string
  /** Multiplicador motivacional (1.0 = neutral, >1 = motivado, <1 = desmotivado) */
  homeMotivFactor: number
  awayMotivFactor: number
  /** Fecha de los últimos partidos (para detectar fatiga / congestión) */
  homeRecentDates: string[]
  awayRecentDates: string[]
}

/** Pick bajo evaluación: qué mercado, qué selección, qué cuota se está considerando. */
export interface PickProposal {
  market: string                  // "1X2", "Over/Under 2.5", "Hándicap", "BTTS", ...
  selection: string               // "Gana Local", "Over 2.5", ...
  selectionType: SelectionType    // normalizado para learning engine
  odd: number
  /** Probabilidad del modelo base (la del propio Candidate de pipeline.ts) */
  baseProb: number
  /** Edge bruto (modelProb% - impliedProb%) */
  rawEdge: number
}

export type SelectionType =
  | "1X2-Home" | "1X2-Draw" | "1X2-Away"
  | "Over25" | "Under25"
  | "BTTS-Yes" | "BTTS-No"
  | "Handicap-Home" | "Handicap-Away"
  | "Other"

/** Identidad de uno de los 5 sub-modelos */
export type ModelId = "A" | "B" | "C" | "D" | "E"

export const MODEL_LABELS: Record<ModelId, string> = {
  A: "Estadístico Puro",
  B: "Contexto de Partido",
  C: "Forma Reciente",
  D: "Mercado y Cuotas",
  E: "Histórico H2H",
}

// ─── Salida de cada sub-modelo ────────────────────────────────────────────────

/**
 * Output canónico de cualquier modelo. Todos los campos son obligatorios para
 * forzar a cada modelo a comprometerse con una respuesta evaluable.
 */
export interface ModelOutput {
  modelId: ModelId
  /** Probabilidad estimada del selection (0-1) */
  probability: number
  /** Confianza del modelo en su propia probabilidad (0-1). Baja muestra → baja confianza. */
  confidence: number
  /** Explicación corta, accionable, en español. Sin jerga matemática. */
  explanation: string
  /** Señales numéricas internas — útiles para el contradiction detector. */
  signals: Record<string, number>
  /** Si el modelo NO puede pronunciarse, marca abstain=true y los demás campos quedan en neutro. */
  abstain: boolean
}

// ─── Consensus ────────────────────────────────────────────────────────────────

export interface ConsensusResult {
  /** Probabilidad consensuada (0-1) — media ponderada de las que NO se abstienen */
  consensusProb: number
  /** Confianza global (0-1) — promedio de confianzas penalizado por desviación */
  consensusConfidence: number
  /** 0-1 — qué tanto coinciden los 5 modelos. 1 = idéntica probabilidad. */
  agreement: number
  /** Outputs individuales para auditoría */
  perModel: ModelOutput[]
  /** Pesos efectivos aplicados (puede divergir del baseline si learning ajustó algo) */
  weights: { stat: number; context: number; form: number; market: number; history: number }
  /** Cuántos modelos abstuvieron */
  abstentions: number
  /** Desviación estándar de las probabilidades entre modelos (0-1) */
  stdev: number
}

// ─── Validation Gates ─────────────────────────────────────────────────────────

export type GateStatus = "PASS" | "BLOCK" | "WARN"

export interface GateResult {
  gate: "data-validation" | "uncertainty" | "contradiction"
  status: GateStatus
  /** Score numérico relevante al gate (uncertainty/contradiction/data-completeness en 0-100) */
  score: number
  /** Razones legibles que llevaron al status */
  reasons: string[]
  /** Datos faltantes (solo data-validation) */
  missingFields?: string[]
}

// ─── Final Quality Gate ───────────────────────────────────────────────────────

/** Thresholds T1-T5 — calibrados conservadoramente */
export const FINAL_GATE_THRESHOLDS = {
  T1_QUALITY_MIN: 55,         // quality_score (0-100)
  T2_CONFIDENCE_MIN: 0.55,    // consensusConfidence (0-1)
  T3_UNCERTAINTY_MAX: 35,     // uncertainty score (0-100, menor mejor)
  T4_CONSENSUS_MIN: 0.55,     // consensusProb (0-1)
  T5_CONTRADICTION_MAX: 30,   // contradiction score (0-100, menor mejor)
} as const

export interface FinalGateInput {
  qualityScore: number        // 0-100 (de pipeline.ts)
  consensus: ConsensusResult
  uncertainty: GateResult
  contradiction: GateResult
  dataValidation: GateResult
}

export interface FinalGateResult {
  /** Decisión final: ¿se publica el pick? */
  approved: boolean
  /** Si approved=false, razón principal */
  blockReason: string | null
  /** Snapshot de todos los scores comparados contra umbrales */
  scoreboard: {
    quality:       { value: number; threshold: number; pass: boolean }
    confidence:    { value: number; threshold: number; pass: boolean }
    uncertainty:   { value: number; threshold: number; pass: boolean }
    consensus:     { value: number; threshold: number; pass: boolean }
    contradiction: { value: number; threshold: number; pass: boolean }
    dataValid:     { pass: boolean }
  }
  /** Si se llamó al LLM para verificación final */
  llmVerification?: {
    asked: boolean
    answer: boolean | null
    rationale: string
  }
}

// ─── Second Opinion ───────────────────────────────────────────────────────────

export type PlanTier = "free" | "premium" | "pro"

export const SECOND_OPINION_QUOTA: Record<PlanTier, number> = {
  free: 1,
  premium: 3,
  pro: 5,
}

export interface SecondOpinionRequest {
  matchId: string
  originalMarket: string
  originalSelection: string
  originalQuality: number
  excludeSelections: string[]
  userKey: string             // hash/IP/email (lo que use el rate limiter)
  plan: PlanTier
}

export interface ChangeLog {
  whatChanged: string         // "De 'Gana Local' a 'Over 2.5'"
  why: string                 // "Defensas mermadas, xG combinado > 2.8"
  riskDelta: {
    oddDelta: number          // diferencia de cuota (puede ser + o -)
    confidenceMaintained: boolean
    qualityDelta: number      // diferencia de quality_score
  }
}

export interface SecondOpinionResponse {
  found: boolean
  /** Pick alternativo si lo hubo */
  alternative?: {
    market: string
    selection: string
    odd: number
    qualityScore: number
    confidence: number
    reasoning: string[]
  }
  changeLog?: ChangeLog
  /** Mensaje al usuario si NO se encontró nada que mejore */
  reason?: string
  /** Estado de la quota tras esta llamada */
  quota: {
    plan: PlanTier
    limit: number
    used: number              // tras consumir esta llamada
    remaining: number
  }
}
