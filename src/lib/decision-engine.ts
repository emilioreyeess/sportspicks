/**
 * DECISION ENGINE — Motor profesional de validación de picks.
 *
 * Filosofía: mejor NO publicar un pick que publicar uno débil.
 *
 * Capas (ejecutadas en orden, cualquiera puede bloquear):
 *  1. Data validation       → datos completos o se rechaza
 *  2. Consensus engine      → 5 sub-modelos independientes, prob ponderada + agreement
 *  3. Uncertainty engine    → datos faltantes / contexto débil → score
 *  4. Contradiction engine  → conflictos internos en la propia tesis del pick
 *  5. Final quality gate    → combina todos los scores, rechaza si alguno falla
 *  6. Professional defense  → "¿lo defendería un analista pro?"
 *
 * Salida: PickEvaluation con pass/fail y trazabilidad completa (para auditoría).
 *
 * Learning engine: interfaz preparada para Phase 2 cuando se conecte una DB
 * (Vercel KV / Postgres). Ahora mismo no-op — sin DB el "aprendizaje" sería falso.
 */

import type { TeamForm, Motivation, ModelOut, RealOdds } from "@/lib/engine"
import { impliedPct } from "@/lib/engine"
import { getCurrentWeightsSync, getHistoricalProbAdjustmentSync } from "@/lib/learning"

// ═══════════════════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════════════════

/** Estructura de un partido completo (subset de MatchModel del pipeline) */
export interface EvalMatch {
  id: string
  homeName: string
  awayName: string
  slug: string
  kickoff: string
  odds: RealOdds
  home: TeamForm
  away: TeamForm
  homeMotiv: Motivation
  awayMotiv: Motivation
  mdl: ModelOut
}

/** Candidato a pick que se va a evaluar */
export interface EvalCandidate {
  market: string
  selection: string
  key: "home" | "draw" | "away" | "over25" | "under25" | "spreadHome" | "spreadAway"
  prob: number             // prob inicial del modelo Poisson
  contextScore: number     // score de contexto del pipeline (0-100)
  odd: number
  edge: number             // % edge inicial (prob*100 - implied)
  baseQuality: number      // quality_score del pipeline antes del motor
}

export interface SubModelResult {
  name: "stat" | "context" | "form" | "market" | "history"
  prob: number             // 0-1
  confidence: number       // 0-1
  rationale: string
}

export interface ConsensusResult {
  prob: number             // media ponderada por confianza
  agreement: number        // 0-1 (1 = todos coinciden)
  models: SubModelResult[]
}

export interface UncertaintyReport {
  score: number            // 0-100 (más = peor)
  reasons: string[]
}

export interface ContradictionReport {
  score: number            // 0-100 (más = peor)
  conflicts: string[]
}

export interface DataValidation {
  ok: boolean
  missing: string[]
}

export interface QualityGateResult {
  pass: boolean
  reasons: string[]        // motivos de rechazo si pass=false
  scores: {
    quality: number
    confidence: number     // prob de consenso × 100
    uncertainty: number
    consensus: number      // agreement × 100
    contradiction: number
  }
}

export interface PickEvaluation {
  pass: boolean
  rejectReasons: string[]
  consensus: ConsensusResult
  uncertainty: UncertaintyReport
  contradiction: ContradictionReport
  dataValid: DataValidation
  gate: QualityGateResult
  professionallyDefendable: boolean
}

// ═══════════════════════════════════════════════════════════════════════════════
// UMBRALES (calibrados para "menos pero mejores")
// ═══════════════════════════════════════════════════════════════════════════════

const GATE = {
  minQuality:            58,
  minConfidence:         52,   // prob consenso × 100
  maxUncertainty:        40,
  minConsensusAgreement: 0.60, // 60% de acuerdo
  maxContradiction:      35,
}

const PROFESSIONAL_BAR = {
  minQuality:     65,
  maxUncertainty: 28,
  minAgreement:   0.70,
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. DATA VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

export function validateData(m: EvalMatch, c: EvalCandidate): DataValidation {
  const missing: string[] = []
  if (!m.kickoff || isNaN(new Date(m.kickoff).getTime())) missing.push("kickoff inválido")
  if (!m.homeName || !m.awayName)                          missing.push("nombres de equipo")
  if (!m.odds || !m.odds.provider)                         missing.push("proveedor de cuotas")
  if (!c.odd || !isFinite(c.odd) || c.odd < 1.05)          missing.push("cuota válida")
  if (!m.home.gamesPlayed || m.home.gamesPlayed < 3)       missing.push("muestra del local")
  if (!m.away.gamesPlayed || m.away.gamesPlayed < 3)       missing.push("muestra del visitante")
  return { ok: missing.length === 0, missing }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. CONSENSUS ENGINE — 5 sub-modelos independientes
// ═══════════════════════════════════════════════════════════════════════════════

/** A: Estadístico puro — la probabilidad del modelo Poisson, ya computada */
function modelStat(c: EvalCandidate, m: EvalMatch): SubModelResult {
  const sampleScore = (Math.min(m.home.gamesPlayed, 10) + Math.min(m.away.gamesPlayed, 10)) / 20
  return {
    name: "stat",
    prob: c.prob,
    confidence: Math.max(0.35, sampleScore),
    rationale: `Poisson ajustado: ${(c.prob * 100).toFixed(1)}%`,
  }
}

/** B: Contexto — motivación + clasificación */
function modelContext(c: EvalCandidate, m: EvalMatch): SubModelResult {
  const motivDiff = m.homeMotiv.factor - m.awayMotiv.factor
  let prob = c.prob
  if (c.key === "home" || c.key === "spreadHome")  prob += motivDiff * 0.12
  if (c.key === "away" || c.key === "spreadAway")  prob -= motivDiff * 0.12
  if (c.key === "draw") prob += (1 - Math.abs(motivDiff) * 2) * 0.04  // empate refuerza si motivaciones similares
  prob = Math.max(0.05, Math.min(0.95, prob))
  const knownContext =
    !m.homeMotiv.status.startsWith("Sin información") &&
    !m.awayMotiv.status.startsWith("Sin información")
  return {
    name: "context",
    prob,
    confidence: knownContext ? 0.75 : 0.30,
    rationale: `Motivación ${m.homeMotiv.factor.toFixed(2)} vs ${m.awayMotiv.factor.toFixed(2)} → ${(prob * 100).toFixed(1)}%`,
  }
}

/** C: Forma — últimos partidos */
function modelForm(c: EvalCandidate, m: EvalMatch): SubModelResult {
  const formDiff = m.home.formPoints - m.away.formPoints
  let prob = c.prob
  if (c.key === "home" || c.key === "spreadHome")  prob += formDiff * 0.15
  if (c.key === "away" || c.key === "spreadAway")  prob -= formDiff * 0.15
  // Para Over/Under, la forma ofensiva combinada importa
  if (c.key === "over25") {
    const attack = (m.home.over25Pct + m.away.over25Pct) / 2
    prob = c.prob * 0.6 + attack * 0.4
  }
  if (c.key === "under25") {
    const defense = (m.home.cleanSheetPct + m.away.cleanSheetPct) / 2
    prob = c.prob * 0.6 + Math.min(0.9, 0.45 + defense * 0.8) * 0.4
  }
  prob = Math.max(0.05, Math.min(0.95, prob))
  const sampleConf = Math.min(1, Math.min(m.home.gamesPlayed, m.away.gamesPlayed) / 6)
  return {
    name: "form",
    prob,
    confidence: Math.max(0.30, sampleConf),
    rationale: `Forma: local ${m.home.form || "—"} vs visitante ${m.away.form || "—"} → ${(prob * 100).toFixed(1)}%`,
  }
}

/** D: Mercado — la cuota es señal de los apostadores profesionales */
function modelMarket(c: EvalCandidate, m: EvalMatch): SubModelResult {
  // Probabilidad implícita simple (sin descontar margen — irrelevante para consenso)
  const prob = 1 / c.odd
  const trustedBook = /draftkings|pinnacle|bet365/i.test(m.odds.provider || "")
  return {
    name: "market",
    prob,
    confidence: trustedBook ? 0.80 : 0.60,
    rationale: `Mercado ${m.odds.provider} ${c.odd.toFixed(2)} (implícita ${impliedPct(c.odd)}%)`,
  }
}

/** E: Histórico — usa patterns reales del Learning Engine (Vercel KV) */
function modelHistory(c: EvalCandidate, m: EvalMatch): SubModelResult {
  // Normaliza el tipo de selección para hacer matching con patterns
  const selectionType =
    c.selection.startsWith("Gana ") ? `1X2-${c.key}` :
    c.selection === "Empate" ? "1X2-draw" :
    c.selection === "Over 2.5 Goles"  ? "Over25" :
    c.selection === "Under 2.5 Goles" ? "Under25" :
    c.market === "Hándicap" ? `Handicap-${c.key}` :
    c.market

  const { adjustment, sourcePattern } = getHistoricalProbAdjustmentSync({
    market: c.market,
    league: m.slug,
    selectionType,
  })

  const adjustedProb = Math.max(0.05, Math.min(0.95, c.prob + adjustment))

  // Si tenemos un patrón significativo aplicable, confianza alta. Si no, baja.
  const hasPattern = adjustment !== 0
  return {
    name: "history",
    prob: adjustedProb,
    confidence: hasPattern ? 0.65 : 0.20,
    rationale: hasPattern
      ? `Patrón histórico ${sourcePattern}: ajuste ${(adjustment * 100 >= 0 ? "+" : "")}${(adjustment * 100).toFixed(1)}pts → ${(adjustedProb * 100).toFixed(1)}%`
      : "Sin patrón histórico significativo todavía (Learning Engine acumulando datos)",
  }
}

export function runConsensus(c: EvalCandidate, m: EvalMatch): ConsensusResult {
  const models = [
    modelStat(c, m),
    modelContext(c, m),
    modelForm(c, m),
    modelMarket(c, m),
    modelHistory(c, m),
  ]

  // Pesos dinámicos del Learning Engine (se calibran a diario en el daily job)
  // El peso final = weight_config × confidence_propia. Así un modelo con
  // confianza baja (datos pobres) sigue valiendo poco aunque su peso config sea alto.
  const w = getCurrentWeightsSync().consensus
  const weightByName: Record<SubModelResult["name"], number> = {
    stat:    w.stat,
    context: w.context,
    form:    w.form,
    market:  w.market,
    history: w.history,
  }

  const effective = models.map((x) => ({ ...x, effW: weightByName[x.name] * x.confidence }))
  const sumW = effective.reduce((s, x) => s + x.effW, 0)
  const prob = sumW > 0
    ? effective.reduce((s, x) => s + x.prob * x.effW, 0) / sumW
    : c.prob

  // Acuerdo: cuanto menor sea la desviación entre las probs, más acuerdo
  const mean = models.reduce((s, x) => s + x.prob, 0) / models.length
  const variance = models.reduce((s, x) => s + (x.prob - mean) ** 2, 0) / models.length
  const std = Math.sqrt(variance)
  const agreement = Math.max(0, Math.min(1, 1 - std * 4))

  return { prob, agreement, models }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. UNCERTAINTY ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

export function computeUncertainty(m: EvalMatch, c: EvalCandidate): UncertaintyReport {
  const reasons: string[] = []
  let score = 0

  const minGames = Math.min(m.home.gamesPlayed, m.away.gamesPlayed)
  if (minGames < 5)      { score += 35; reasons.push(`Muy pocos partidos (${minGames})`) }
  else if (minGames < 8) { score += 18; reasons.push(`Muestra limitada (${minGames} partidos)`) }

  if (!m.home.form || !m.away.form) {
    score += 20
    reasons.push("Forma reciente incompleta")
  }

  if (m.homeMotiv.status.startsWith("Sin información") ||
      m.awayMotiv.status.startsWith("Sin información")) {
    score += 15
    reasons.push("Contexto de motivación ausente")
  }

  // Cuota fuera de rango cómodo
  if (c.odd > 3.5)  { score += 10; reasons.push(`Cuota alta (${c.odd.toFixed(2)}) implica baja prob`) }
  if (c.odd < 1.25) { score += 8;  reasons.push(`Cuota muy corta (${c.odd.toFixed(2)}) margen pequeño`) }

  // Tiempo hasta kickoff: si faltan menos de 30 min las cuotas pueden moverse mucho
  const minsToKick = (new Date(m.kickoff).getTime() - Date.now()) / 60000
  if (minsToKick < 30 && minsToKick > 0) {
    score += 12
    reasons.push("Pre-partido inmediato — cuotas inestables")
  }
  if (minsToKick < 0) {
    score += 50
    reasons.push("Partido ya iniciado")
  }

  return { score: Math.min(100, Math.round(score)), reasons }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. CONTRADICTION DETECTOR
// ═══════════════════════════════════════════════════════════════════════════════

export function detectContradictions(
  c: EvalCandidate,
  m: EvalMatch,
  consensus: ConsensusResult,
): ContradictionReport {
  const conflicts: string[] = []
  let score = 0
  const expTotal = m.mdl.lambdaHome + m.mdl.lambdaAway

  // ── Over 2.5 con xG bajo o defensas fuertes
  if (c.selection === "Over 2.5 Goles") {
    if (expTotal < 2.6) {
      score += 35; conflicts.push(`Over 2.5 con xG combinado bajo (${expTotal.toFixed(2)})`)
    }
    if (m.home.cleanSheetPct > 0.45 || m.away.cleanSheetPct > 0.45) {
      score += 18; conflicts.push("Al menos una defensa con CS alto")
    }
  }

  // ── Under 2.5 con ataques fuertes
  if (c.selection === "Under 2.5 Goles") {
    if (expTotal > 2.7) {
      score += 35; conflicts.push(`Under 2.5 con xG combinado alto (${expTotal.toFixed(2)})`)
    }
    if (m.home.over25Pct > 0.55 && m.away.over25Pct > 0.55) {
      score += 18; conflicts.push("Ambos equipos con Over% reciente alto")
    }
  }

  // ── Ganador con forma reciente mala
  if (c.market === "1X2") {
    if ((c.key === "home" || c.key === "spreadHome") && m.home.formPoints < 0.35 && c.prob > 0.5) {
      score += 25; conflicts.push("Local favorito pese a mala forma reciente")
    }
    if ((c.key === "away" || c.key === "spreadAway") && m.away.formPoints < 0.35 && c.prob > 0.5) {
      score += 25; conflicts.push("Visitante favorito pese a mala forma reciente")
    }
  }

  // ── Empate con motivaciones muy desiguales
  if (c.key === "draw") {
    const motivGap = Math.abs(m.homeMotiv.factor - m.awayMotiv.factor)
    if (motivGap > 0.15) {
      score += 20; conflicts.push(`Empate con motivaciones desiguales (gap ${motivGap.toFixed(2)})`)
    }
  }

  // ── Modelos discrepan mucho
  if (consensus.agreement < 0.55) {
    score += 22
    conflicts.push(`Modelos en desacuerdo (acuerdo ${(consensus.agreement * 100).toFixed(0)}%)`)
  }

  // ── El mercado dice una cosa y el modelo otra muy distinta
  const marketProb = 1 / c.odd
  const gap = Math.abs(consensus.prob - marketProb)
  if (gap > 0.18) {
    score += 15
    conflicts.push(`Edge enorme (${(gap * 100).toFixed(1)}%) — sospechoso, podría ser ruido`)
  }

  return { score: Math.min(100, Math.round(score)), conflicts }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. FINAL QUALITY GATE
// ═══════════════════════════════════════════════════════════════════════════════

export function finalQualityGate(args: {
  qualityScore: number
  consensus: ConsensusResult
  uncertainty: UncertaintyReport
  contradiction: ContradictionReport
  dataValid: DataValidation
}): QualityGateResult {
  const { qualityScore, consensus, uncertainty, contradiction, dataValid } = args
  const reasons: string[] = []

  const confidence = Math.round(consensus.prob * 100)
  const consensusPct = Math.round(consensus.agreement * 100)

  if (!dataValid.ok)                            reasons.push(`Datos incompletos: ${dataValid.missing.join(", ")}`)
  if (qualityScore < GATE.minQuality)           reasons.push(`Quality bajo (${qualityScore}/${GATE.minQuality})`)
  if (confidence < GATE.minConfidence)          reasons.push(`Confianza baja (${confidence}%/${GATE.minConfidence}%)`)
  if (uncertainty.score > GATE.maxUncertainty)  reasons.push(`Incertidumbre alta (${uncertainty.score}/${GATE.maxUncertainty})`)
  if (consensus.agreement < GATE.minConsensusAgreement) reasons.push(`Consenso bajo (${consensusPct}%/${Math.round(GATE.minConsensusAgreement * 100)}%)`)
  if (contradiction.score > GATE.maxContradiction)      reasons.push(`Contradicciones (${contradiction.score}/${GATE.maxContradiction})`)

  return {
    pass: reasons.length === 0,
    reasons,
    scores: {
      quality:       qualityScore,
      confidence,
      uncertainty:   uncertainty.score,
      consensus:     consensusPct,
      contradiction: contradiction.score,
    },
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. PROFESSIONAL DEFENSE — "¿lo defendería un analista pro?"
// ═══════════════════════════════════════════════════════════════════════════════

export function professionalDefense(gate: QualityGateResult): boolean {
  if (!gate.pass) return false
  if (gate.scores.quality       < PROFESSIONAL_BAR.minQuality)        return false
  if (gate.scores.uncertainty   > PROFESSIONAL_BAR.maxUncertainty)    return false
  if (gate.scores.consensus     < PROFESSIONAL_BAR.minAgreement * 100) return false
  return true
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVALUATE — la función pública que orquesta todo
// ═══════════════════════════════════════════════════════════════════════════════

export function evaluatePick(c: EvalCandidate, m: EvalMatch): PickEvaluation {
  const dataValid     = validateData(m, c)
  const consensus     = runConsensus(c, m)
  const uncertainty   = computeUncertainty(m, c)
  const contradiction = detectContradictions(c, m, consensus)
  const gate          = finalQualityGate({
    qualityScore: c.baseQuality, consensus, uncertainty, contradiction, dataValid,
  })
  const professionallyDefendable = professionalDefense(gate)
  return {
    pass: gate.pass,
    rejectReasons: gate.reasons,
    consensus, uncertainty, contradiction, dataValid, gate,
    professionallyDefendable,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEARNING ENGINE — interfaz lista para Phase 2 (necesita persistencia real)
// ═══════════════════════════════════════════════════════════════════════════════

export interface PickRecord {
  pickId: string
  date: string
  market: string
  selection: string
  league: string
  odd: number
  edge: number
  qualityScore: number
  modelProb: number
  consensusProb: number
  result?: "WIN" | "LOSS" | "VOID" | "PENDING"
}

export interface MarketPerformance {
  market: string
  league?: string
  samples: number
  winRate: number
  avgOdd: number
  roi: number       // %
}

export interface LearningEngine {
  recordPick(p: PickRecord): Promise<void>
  recordResult(pickId: string, result: "WIN" | "LOSS" | "VOID"): Promise<void>
  /** Ajuste de prob recomendado para (mercado × liga). Rango sugerido -0.10 a +0.10 */
  getPatternAdjustment(market: string, league: string): Promise<number>
  getMarketPerformance(market: string, league?: string): Promise<MarketPerformance | null>
}

/** Implementación no-op — Phase 2: enchufar Vercel KV / Postgres / Supabase */
export const learningEngine: LearningEngine = {
  async recordPick()              { /* TODO Phase 2 */ },
  async recordResult()            { /* TODO Phase 2 */ },
  async getPatternAdjustment()    { return 0 },
  async getMarketPerformance()    { return null },
}
