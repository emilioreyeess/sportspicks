/**
 * Tipos centrales del Learning Engine.
 *
 * Filosofía:
 *  - Inmutable: una vez guardado un PickRecord, solo se le añade el resultado.
 *  - Auditable: cada Pattern y cada ajuste de weights guarda su muestra y razón.
 *  - Anti-overfitting: nada se aplica con < 30 muestras y < 90% confianza.
 */

export type PickResult = "WIN" | "LOSS" | "VOID" | "PENDING"

/** Registro permanente de cada pick publicado */
export interface PickRecord {
  pickId: string
  date: string                  // YYYY-MM-DD (día de publicación)
  matchId: string
  league: string                // slug (ej "esp.1")
  leagueName: string
  homeTeam: string
  awayTeam: string
  market: string
  selection: string
  /** Categoría normalizada para agrupar patrones: "1X2-Home", "Over25", "Under25", "Handicap-Home", etc. */
  selectionType: string
  odd: number
  impliedProb: number           // 0-100
  modelProb: number             // 0-100 (modelo base)
  consensusProb: number         // 0-100 (consenso 5 modelos)
  edge: number
  qualityScore: number
  riskTier: "low" | "mid" | "high"
  uncertaintyScore: number
  contradictionScore: number
  consensusAgreement: number    // 0-100
  contextSnapshot: {
    homeForm: string
    awayForm: string
    homeMotivStatus: string
    awayMotivStatus: string
    expGoals: number
  }
  result: PickResult
  resultRecordedAt?: string
  homeScore?: number
  awayScore?: number
  /** Contexto competitivo: "club" | "international_friendly" | "international_competitive".
   *  Permite aislar el aprendizaje de selecciones del de clubes. */
  context?: string
}

/** Patrón detectado en el histórico — solo se considera "actionable" si pasa los gates */
export interface Pattern {
  id: string                    // ej "market:Over25|league:usa.1"
  scope: {
    market?: string
    league?: string
    selectionType?: string
    riskTier?: "low" | "mid" | "high"
  }
  samples: number
  wins: number
  losses: number
  voids: number
  winRate: number               // wins / (wins+losses), 0-1
  avgOdd: number
  avgEdge: number
  roi: number                   // %  (banca cierre - banca inicio) / banca inicio
  /** Win rate esperado dado las cuotas reales (avg implied prob) */
  expectedWinRate: number
  /** Diferencia entre real y esperado, en puntos (-100 a +100) */
  deltaVsExpected: number
  /** Wilson lower bound al 90% (medida conservadora de win rate real) */
  wilsonLower: number
  wilsonUpper: number
  /** ¿El patrón es estadísticamente significativo y "actionable"? */
  significant: boolean
  /** Ajuste recomendado de probabilidad (-0.05 a +0.05) — solo si significant */
  probAdjustment: number
  computedAt: string
}

/** Configuración dinámica de pesos para el motor de decisión y scoring */
export interface WeightsConfig {
  /** Pesos para runConsensus — deben sumar ~1 pero el código normaliza */
  consensus: {
    stat: number
    context: number
    form: number
    market: number
    history: number
  }
  /** Pesos para la fórmula de quality_score en pipeline.computeValuePicks */
  scoring: {
    edge: number
    context: number
    market: number
    reliability: number
  }
  lastAdjustedAt: string
  /** Histórico de cambios — los últimos 30 días */
  adjustmentHistory: Array<{
    date: string
    changes: string[]
    triggeredBy: string         // ej "pattern:Over25 ROI +12% sobre 45 muestras"
  }>
}

export const DEFAULT_WEIGHTS: WeightsConfig = {
  consensus: { stat: 0.30, context: 0.20, form: 0.20, market: 0.20, history: 0.10 },
  scoring:   { edge: 0.38, context: 0.30, market: 0.16, reliability: 0.16 },
  lastAdjustedAt: new Date().toISOString(),
  adjustmentHistory: [],
}

/** Informe diario generado por el learning job */
export interface LearningReport {
  date: string                  // día evaluado (YYYY-MM-DD)
  ranAt: string
  totalPicksEvaluated: number
  wins: number
  losses: number
  voids: number
  pending: number               // partidos sin resultado verificable aún
  winRate: number               // 0-1
  roi: number                   // %
  patternsTop: Array<{
    id: string
    samples: number
    winRate: number
    delta: number               // deltaVsExpected
    significant: boolean
  }>
  weightAdjustments: Array<{
    target: string              // "consensus.context" / "scoring.edge"
    from: number
    to: number
    reason: string
  }>
  newPatternsDetected: number
  warnings: string[]            // ej "Muestra histórica baja: <100 picks totales"
}

/** Constantes de calibración del Learning Engine */
export const LEARNING_CONFIG = {
  /** Tamaño mínimo de muestra para que un patrón pueda mover pesos */
  MIN_SAMPLES_FOR_PATTERN: 30,
  /** Confianza estadística requerida (Wilson) para considerar un patrón actionable */
  MIN_PATTERN_CONFIDENCE: 0.90,
  /** Delta máximo de peso por día (anti-overshoot) */
  MAX_WEIGHT_CHANGE_PER_DAY: 0.03,
  /** Distancia máxima permitida desde el peso baseline */
  MAX_WEIGHT_DRIFT_FROM_BASE: 0.20,
  /** Ajuste máximo de probabilidad por patrón histórico */
  MAX_PROB_ADJUSTMENT: 0.05,
  /** Ventana de evaluación (días) */
  WINDOW_DAYS: 90,
  /** Retención total de registros (días) */
  RETENTION_DAYS: 365,
} as const
