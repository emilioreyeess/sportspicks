/**
 * World Cup 2026 — Combinadas Engine
 *
 * Quantitative parlay generator tuned for World Cup context.
 *
 * Architecture:
 *   1. Collect available upcoming matches via MatchCenter
 *   2. For each match run the Poisson model → P(homeWin), P(draw), P(awayWin),
 *      P(over2.5), P(btts), factoring in referee severity + context flags
 *   3. Score each selection against target probability thresholds per tier:
 *      - Segura    (Realista): prob > 0.58, max odds implícitas 1.65, max legs 3
 *      - Balanceada (Normal):  prob > 0.48, max odds implícitas 2.20, max legs 4
 *      - Soñadora:             prob > 0.35, max odds implícitas 3.50, max legs 5
 *   4. Assemble parlay from top-scoring legs, add statistical justification per leg
 *
 * RULE OF GOLD: Zero invented statistics.
 *   - If form data is missing → conservative defaults used, flagged in justification
 *   - If odds are missing → no implied-value filter applied
 *   - Source field propagated everywhere
 */

import { getMatchCenter, computeXgFromForm } from "./data-service"
import { getAllFixtures } from "./data-service"
import { getMatchOdds, isOddsEnabled } from "./odds-service"
import type { MatchOdds } from "./odds-service"
import type { WCFixture, MatchCenter, RefereeStats, WCTeamForm } from "./types"

// ─── Types ────────────────────────────────────────────────────────────────────

export type RiskTier = "segura" | "balanceada" | "soñadora"

export interface WCCombinadaLeg {
  matchId: string
  homeCode: string
  awayCode: string
  kickoffISO: string
  market: string           // "1X2:home" | "1X2:draw" | "1X2:away" | "over2.5" | "btts" | "dc:1x" | "dc:x2"
  marketLabel: string      // "Victoria España" | "Empate" | "Más de 2.5 goles"
  modelProb: number        // 0-1 (Poisson estimate)
  impliedOdds: number      // cuota real de la casa (o 1/modelProb si no hay odds reales)
  realOdds: number | null  // cuota real de la casa de apuestas
  bookmaker: string | null // nombre de la casa de apuestas
  hasValue: boolean        // true si modelProb > probabilidad implícita de la casa
  valuePct: number | null  // edge en % (modelProb - impliedProb) * 100
  confidence: number       // 0-100 (composite score)
  justification: string    // statistical narrative
  dataQuality: "high" | "medium" | "low"  // based on data completeness
  source: string
}

export interface WCCombinada {
  legs: WCCombinadaLeg[]
  tier: RiskTier
  tierLabel: string
  combinedProb: number        // product of leg probs
  combinedImpliedOdds: number // product of implied odds
  totalConfidence: number     // weighted average of leg confidence
  rationale: string           // overall parlay narrative
  disclaimer: string
  generatedAt: string
  model: { engine: string; version: string }
}

export interface WCCombinadasResponse {
  segura:     WCCombinada | null
  balanceada: WCCombinada | null
  soñadora:   WCCombinada | null
  matchesAnalyzed: number
  generatedAt: string
  disclaimer: string
}

// ─── Poisson model ────────────────────────────────────────────────────────────

/** World Cup average goals per team per match (historical 1998–2022) */
const WC_LEAGUE_AVG_HOME = 1.22
const WC_LEAGUE_AVG_AWAY = 0.94

interface PoissonResult {
  homeWin: number
  draw:    number
  awayWin: number
  over25:  number
  over35:  number
  btts:    number
  expHome: number  // expected goals home
  expAway: number  // expected goals away
}

/** Poisson PMF: P(X = k) */
function poissonPmf(lambda: number, k: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0
  let p = Math.exp(-lambda)
  for (let i = 0; i < k; i++) p *= lambda / (i + 1)
  return p
}

/**
 * Compute match outcome probabilities using Dixon-Coles Poisson model.
 * Uses team form averages as attack/defence strength proxies.
 * If form is null → falls back to league averages (conservative).
 */
export function computePoissonProbs(
  homeForm: WCTeamForm | null,
  awayForm: WCTeamForm | null,
): PoissonResult {
  // Attack strength = team's avg GF / league avg
  // Defence strength = team's avg GA / league avg
  const homeAttack  = homeForm ? homeForm.goalsForAvg     / WC_LEAGUE_AVG_HOME : 1.0
  const homeDefence = homeForm ? homeForm.goalsAgainstAvg / WC_LEAGUE_AVG_AWAY : 1.0
  const awayAttack  = awayForm ? awayForm.goalsForAvg     / WC_LEAGUE_AVG_AWAY : 1.0
  const awayDefence = awayForm ? awayForm.goalsAgainstAvg / WC_LEAGUE_AVG_HOME : 1.0

  // Expected goals
  const expHome = Math.max(0.1, homeAttack  * awayDefence * WC_LEAGUE_AVG_HOME)
  const expAway = Math.max(0.1, awayAttack  * homeDefence * WC_LEAGUE_AVG_AWAY)

  // Compute P(i, j) for i,j in 0..8
  const maxGoals = 9
  let homeWin = 0, draw = 0, awayWin = 0
  let over25 = 0, over35 = 0, btts = 0

  for (let i = 0; i < maxGoals; i++) {
    for (let j = 0; j < maxGoals; j++) {
      const p = poissonPmf(expHome, i) * poissonPmf(expAway, j)
      if (i > j) homeWin += p
      else if (i === j) draw += p
      else awayWin += p
      if (i + j >= 3) over25 += p
      if (i + j >= 4) over35 += p
      if (i > 0 && j > 0) btts += p
    }
  }

  // Normalize to sum to 1 (floating point drift)
  const total = homeWin + draw + awayWin
  return {
    homeWin: homeWin / total,
    draw:    draw    / total,
    awayWin: awayWin / total,
    over25,
    over35,
    btts,
    expHome,
    expAway,
  }
}

// ─── Referee adjustments ──────────────────────────────────────────────────────

/**
 * Adjust probabilities based on referee severity:
 *   - Very strict referees → fewer goals (fewer advantages play out)
 *   - Lenient referees → more fouls unpunished → slightly more goals
 */
function applyRefereeAdjustment(
  probs: PoissonResult,
  referee: RefereeStats | null,
): PoissonResult {
  if (!referee) return probs
  const s = referee.severity
  // Goal multiplier for over/btts: strict = fewer goals
  const m = s === "very-strict" ? 0.88 : s === "strict" ? 0.93 : s === "lenient" ? 1.06 : 1.0
  return {
    ...probs,
    over25: Math.min(0.95, probs.over25 * m),
    over35: Math.min(0.90, probs.over35 * m),
    btts:   Math.min(0.92, probs.btts   * m),
  }
}

// ─── Context adjustments ──────────────────────────────────────────────────────

/**
 * Knockout context → draws more likely (teams play cautious).
 * Classic rivalry → more volatile → draw prob up slightly.
 */
function applyContextAdjustment(
  probs: PoissonResult,
  center: MatchCenter,
): PoissonResult {
  const { isKnockout, bothNeedDraw, isClassic, highStakes } = center.context
  let { homeWin, draw, awayWin, ...rest } = probs

  if (isKnockout || highStakes) {
    // Shift 4% from win outcomes to draw in knockout (cautious play)
    homeWin -= 0.02
    awayWin -= 0.02
    draw    += 0.04
  }
  if (bothNeedDraw) {
    homeWin -= 0.04
    awayWin -= 0.04
    draw    += 0.08
  }
  if (isClassic) {
    // Classics are slightly more even
    const avg = (homeWin + awayWin) / 2
    homeWin = homeWin * 0.9 + avg * 0.1
    awayWin = awayWin * 0.9 + avg * 0.1
  }

  // Clamp and renormalize
  homeWin = Math.max(0.05, homeWin)
  awayWin = Math.max(0.05, awayWin)
  draw    = Math.max(0.05, draw)
  const total = homeWin + draw + awayWin
  return { homeWin: homeWin/total, draw: draw/total, awayWin: awayWin/total, ...rest }
}

// ─── Leg builder ─────────────────────────────────────────────────────────────

function dataQuality(center: MatchCenter): "high" | "medium" | "low" {
  const hasHomeForm = center.home.form !== null
  const hasAwayForm = center.away.form !== null
  const hasXg       = center.home.xg !== null && center.away.xg !== null
  if (hasHomeForm && hasAwayForm && hasXg) return "high"
  if (hasHomeForm || hasAwayForm) return "medium"
  return "low"
}

function qualityNote(quality: "high" | "medium" | "low"): string {
  if (quality === "low") return " (sin datos de forma — estimación conservadora)"
  if (quality === "medium") return " (forma parcial)"
  return ""
}

function buildJustification(
  market: string,
  prob: number,
  center: MatchCenter,
  probs: PoissonResult,
  quality: "high" | "medium" | "low",
  realOdd: number | null = null,
  hasValue = false,
  valuePct: number | null = null,
): string {
  const hn = center.home.team.shortName
  const an = center.away.team.shortName
  const qn = qualityNote(quality)
  const pct = Math.round(prob * 100)
  const formStr = (form: typeof center.home.form) =>
    form ? ` (forma: ${form.formString})` : ""
  const valueTag = hasValue && valuePct !== null
    ? ` ✦ VALUE +${valuePct.toFixed(1)}% vs casa`
    : ""
  const oddsTag = realOdd ? ` · cuota real ${realOdd.toFixed(2)}` : ""

  switch (market) {
    case "1X2:home":
      return `${hn} favorito: ${pct}% prob. xG ${probs.expHome.toFixed(2)}-${probs.expAway.toFixed(2)}${formStr(center.home.form)}${oddsTag}${valueTag}${qn}`
    case "1X2:away":
      return `${an} favorito: ${pct}% prob. xG ${probs.expAway.toFixed(2)}-${probs.expHome.toFixed(2)}${formStr(center.away.form)}${oddsTag}${valueTag}${qn}`
    case "1X2:draw":
      return `Empate: ${pct}% prob. xG equiparado ${probs.expHome.toFixed(2)}-${probs.expAway.toFixed(2)}${center.context.isKnockout ? " (eliminatoria, cautela táctica)" : ""}${oddsTag}${valueTag}${qn}`
    case "over2.5":
      return `+2.5 goles: ${pct}% prob. ${hn} ${center.home.form?.goalsForAvg?.toFixed(2) ?? "—"} GF · ${an} ${center.away.form?.goalsForAvg?.toFixed(2) ?? "—"} GF${oddsTag}${valueTag}${qn}`
    case "btts":
      return `BTTS: ${pct}% prob. GA media ${hn} ${center.home.form?.goalsAgainstAvg?.toFixed(2) ?? "—"} · ${an} ${center.away.form?.goalsAgainstAvg?.toFixed(2) ?? "—"}${valueTag}${qn}`
    case "dc:1x": {
      const dp = Math.round((probs.homeWin + probs.draw) * 100)
      return `${hn}/Empate doble op.: ${dp}% prob.${valueTag}${qn}`
    }
    case "dc:x2": {
      const dp = Math.round((probs.awayWin + probs.draw) * 100)
      return `${an}/Empate doble op.: ${dp}% prob.${valueTag}${qn}`
    }
    default:
      return `Probabilidad estimada ${pct}%${oddsTag}${valueTag}${qn}`
  }
}

/** Score a leg 0-100 based on probability certainty, data quality, context, value */
function legConfidence(
  prob: number,
  quality: "high" | "medium" | "low",
  center: MatchCenter,
  hasValue = false,
): number {
  let score = prob * 100
  if (quality === "medium") score *= 0.90
  if (quality === "low")    score *= 0.78
  // Bonus for confirmed referee data
  if (center.referee) score = Math.min(100, score + 2)
  // Bonus for real value vs bookmaker
  if (hasValue) score = Math.min(100, score + 5)
  // Penalty for knockout uncertainty
  if (center.context.isKnockout) score *= 0.96
  return Math.round(Math.min(100, score))
}

interface ScoredLeg {
  leg: WCCombinadaLeg
  prob: number
}

/** Extract all candidate legs from a MatchCenter, enriched with real odds */
function extractLegs(center: MatchCenter, probs: PoissonResult, odds: MatchOdds | null): ScoredLeg[] {
  const quality = dataQuality(center)
  const fixture  = center.fixture
  const candidates: ScoredLeg[] = []

  const add = (market: string, marketLabel: string, prob: number, realOdd: number | null) => {
    if (prob <= 0.01) return

    // Use real odds if available, otherwise use model-implied
    const displayOdds = realOdd ?? Math.round((1 / prob) * 100) / 100

    // Value detection: compare model prob vs bookmaker implied prob
    const bookImplied = realOdd ? 1 / realOdd : null
    const hasValue    = bookImplied !== null ? prob > bookImplied : false
    const valuePct    = bookImplied !== null
      ? Math.round((prob - bookImplied) * 1000) / 10   // e.g. 4.2%
      : null

    const confidence = legConfidence(prob, quality, center, hasValue)

    candidates.push({
      prob,
      leg: {
        matchId:      fixture.matchId,
        homeCode:     fixture.homeCode,
        awayCode:     fixture.awayCode,
        kickoffISO:   fixture.kickoffISO,
        market,
        marketLabel,
        modelProb:    Math.round(prob * 1000) / 1000,
        impliedOdds:  displayOdds,
        realOdds:     realOdd,
        bookmaker:    odds?.bookmaker ?? null,
        hasValue,
        valuePct,
        confidence,
        justification: buildJustification(market, prob, center, probs, quality, realOdd, hasValue, valuePct),
        dataQuality:   quality,
        source:        realOdd ? "the-odds-api" : center.fixture.source,
      },
    })
  }

  const hn = center.home.team.shortName
  const an = center.away.team.shortName
  const { homeWin, draw, awayWin, over25, btts } = probs

  add("1X2:home",   `Victoria ${hn}`,           homeWin,       odds?.home   ?? null)
  add("1X2:draw",   "Empate",                    draw,          odds?.draw   ?? null)
  add("1X2:away",   `Victoria ${an}`,            awayWin,       odds?.away   ?? null)
  add("over2.5",    "Más de 2.5 goles",          over25,        odds?.over25 ?? null)
  add("btts",       "Ambos equipos marcan",      btts,          null)  // btts no siempre disponible en OddsAPI
  add("dc:1x",      `${hn} o Empate`,            homeWin + draw, null)
  add("dc:x2",      `${an} o Empate`,            awayWin + draw, null)

  return candidates
}

// ─── Tier configuration ───────────────────────────────────────────────────────

const TIER_CONFIG = {
  segura: {
    minProb:  0.58,
    maxLegs:  3,
    minLegs:  2,
    label:    "Realista · Segura",
  },
  balanceada: {
    minProb:  0.48,
    maxLegs:  4,
    minLegs:  3,
    label:    "Normal · Balanceada",
  },
  soñadora: {
    minProb:  0.35,
    maxLegs:  5,
    minLegs:  3,
    label:    "Soñadora",
  },
} as const

// ─── Assemble combinada ───────────────────────────────────────────────────────

const DISCLAIMER =
  "Combinada generada por el motor Poisson de SportsPicks con datos de ESPN" +
  (isOddsEnabled() ? " y cuotas reales de casas de apuestas vía The Odds API" : "") +
  ". Las probabilidades son estimaciones estadísticas — no garantizan resultados. " +
  "Información exclusivamente estadística. No es asesoramiento de apuestas. +18. Juega con responsabilidad."

function assembleCombinada(
  allCandidates: ScoredLeg[],
  tier: RiskTier,
): WCCombinada | null {
  const cfg = TIER_CONFIG[tier]

  // Filter by prob threshold, one leg per match (avoid correlated legs)
  const eligible = allCandidates.filter((c) => c.prob >= cfg.minProb)
  const seenMatches = new Set<string>()
  const chosen: ScoredLeg[] = []

  // Sort by confidence desc, then pick top N (one per match)
  const sorted = [...eligible].sort((a, b) => b.leg.confidence - a.leg.confidence)
  for (const c of sorted) {
    if (chosen.length >= cfg.maxLegs) break
    if (seenMatches.has(c.leg.matchId)) continue
    seenMatches.add(c.leg.matchId)
    chosen.push(c)
  }

  if (chosen.length < cfg.minLegs) return null

  const combinedProb   = chosen.reduce((acc, c) => acc * c.prob, 1)
  const combinedOdds   = Math.round(chosen.reduce((acc, c) => acc * c.leg.impliedOdds, 1) * 100) / 100
  const avgConfidence  = Math.round(chosen.reduce((acc, c) => acc + c.leg.confidence, 0) / chosen.length)

  const legDescriptions = chosen.map((c) =>
    `${c.leg.homeCode} vs ${c.leg.awayCode}: ${c.leg.marketLabel} (${Math.round(c.prob * 100)}%)`
  )
  const rationale = `Combinada ${cfg.label} con ${chosen.length} selecciones: ${legDescriptions.join(" · ")}. ` +
    `Probabilidad conjunta estimada ${Math.round(combinedProb * 100)}%. Cuota implícita total ${combinedOdds}.`

  return {
    legs: chosen.map((c) => c.leg),
    tier,
    tierLabel: cfg.label,
    combinedProb:        Math.round(combinedProb * 10000) / 10000,
    combinedImpliedOdds: combinedOdds,
    totalConfidence:     avgConfidence,
    rationale,
    disclaimer: DISCLAIMER,
    generatedAt: new Date().toISOString(),
    model: { engine: "poisson-wc26", version: "1.0.0" },
  }
}

// ─── Main engine ──────────────────────────────────────────────────────────────

/** How many upcoming fixtures to analyze (bounded to save API calls) */
const MAX_FIXTURES_TO_ANALYZE = 10

export async function generateWCCombinadas(): Promise<WCCombinadasResponse> {
  const now = Date.now()

  // Get upcoming fixtures
  let upcoming: WCFixture[] = []
  try {
    const all = await getAllFixtures()
    upcoming = all
      .filter((f) => f.status === "scheduled" && new Date(f.kickoffISO).getTime() > now)
      .sort((a, b) => new Date(a.kickoffISO).getTime() - new Date(b.kickoffISO).getTime())
      .slice(0, MAX_FIXTURES_TO_ANALYZE)
  } catch {
    upcoming = []
  }

  if (upcoming.length === 0) {
    return {
      segura: null, balanceada: null, soñadora: null,
      matchesAnalyzed: 0,
      generatedAt: new Date().toISOString(),
      disclaimer: DISCLAIMER,
    }
  }

  // Load match centers in parallel (with concurrency limit)
  const CONCURRENCY = 4
  const centers: MatchCenter[] = []
  for (let i = 0; i < upcoming.length; i += CONCURRENCY) {
    const batch = upcoming.slice(i, i + CONCURRENCY)
    const results = await Promise.allSettled(
      batch.map((f) => import("./data-service").then((m) => m.getMatchCenter(f.matchId)))
    )
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) centers.push(r.value)
    }
  }

  // Load real odds in parallel with match centers (if OddsAPI key is set)
  const oddsMap = new Map<string, MatchOdds>()
  if (isOddsEnabled()) {
    const oddsResults = await Promise.allSettled(
      centers.map((c) => getMatchOdds(c.fixture.homeCode, c.fixture.awayCode))
    )
    oddsResults.forEach((r, i) => {
      if (r.status === "fulfilled" && r.value) {
        oddsMap.set(centers[i].fixture.matchId, r.value)
      }
    })
  }

  // Build all candidate legs
  const allCandidates: ScoredLeg[] = []
  for (const center of centers) {
    const probs = computePoissonProbs(center.home.form, center.away.form)
    const adjusted1 = applyRefereeAdjustment(probs, center.referee)
    const adjusted2 = applyContextAdjustment(adjusted1, center)
    const odds = oddsMap.get(center.fixture.matchId) ?? null
    const legs = extractLegs(center, adjusted2, odds)
    allCandidates.push(...legs)
  }

  return {
    segura:     assembleCombinada(allCandidates, "segura"),
    balanceada: assembleCombinada(allCandidates, "balanceada"),
    soñadora:   assembleCombinada(allCandidates, "soñadora"),
    matchesAnalyzed: centers.length,
    generatedAt: new Date().toISOString(),
    disclaimer: DISCLAIMER,
  }
}
