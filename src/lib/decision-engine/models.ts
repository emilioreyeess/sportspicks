/**
 * 5 Sub-Modelos independientes de evaluación.
 *
 * Cada modelo recibe el mismo MatchSnapshot + PickProposal y devuelve su
 * propia probabilidad y confianza. NUNCA comparten estado.
 *
 * Cualquier modelo PUEDE abstenerse (`abstain: true`) cuando los datos
 * que necesita no están disponibles. La abstención NO penaliza al pick:
 * simplemente el consensus se calcula con los que sí se pronuncian.
 */

import type { MatchSnapshot, PickProposal, ModelOutput, ModelId } from "./types"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

function abstain(modelId: ModelId, reason: string): ModelOutput {
  return {
    modelId,
    probability: 0.5,
    confidence: 0,
    explanation: `Modelo ${modelId} se abstiene: ${reason}`,
    signals: {},
    abstain: true,
  }
}

function isGoalsMarket(market: string): boolean {
  return /over|under|btts|gol/i.test(market)
}

function isHandicapMarket(market: string): boolean {
  return /h(á|a)ndicap|spread/i.test(market)
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODELO A — Estadístico Puro (Poisson + xG + varianza)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Toma la probabilidad del modelo base Poisson como ancla y la modula
 * por la fiabilidad de la muestra (gamesPlayed) y la varianza esperada
 * del mercado (los mercados de goles son más estables que H2H).
 */
export function modelA_statisticalPure(m: MatchSnapshot, p: PickProposal): ModelOutput {
  // El base es la probabilidad del modelo Poisson ya calculado upstream
  if (!Number.isFinite(p.baseProb) || p.baseProb <= 0 || p.baseProb >= 1) {
    return abstain("A", "probabilidad base inválida")
  }

  const minGames = Math.min(m.homeGamesPlayed, m.awayGamesPlayed)
  if (minGames < 5) {
    return abstain("A", `muestra insuficiente (${minGames} partidos jugados)`)
  }

  // Confianza basada en muestra (5 partidos = 0.5, 10+ = 1.0)
  const sampleConfidence = clamp01((minGames - 4) / 6)

  // Los mercados de goles son más predecibles estadísticamente (varianza menor)
  const marketReliability = isGoalsMarket(p.market) ? 0.85 : isHandicapMarket(p.market) ? 0.70 : 0.75

  // Pull suave hacia la media si la probabilidad es extrema (regresión a la media)
  const extremityPenalty = Math.abs(p.baseProb - 0.5) > 0.3 ? 0.92 : 1.0

  const probability = clamp01(p.baseProb * extremityPenalty + 0.5 * (1 - extremityPenalty))
  const confidence = clamp01(sampleConfidence * marketReliability)

  return {
    modelId: "A",
    probability,
    confidence,
    explanation: `Modelo Poisson: prob ${(p.baseProb * 100).toFixed(1)}%, muestra ${minGames} partidos, xG total ${m.expectedGoals.toFixed(2)}`,
    signals: {
      baseProb: p.baseProb,
      sampleConfidence,
      marketReliability,
      expectedGoals: m.expectedGoals,
    },
    abstain: false,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODELO B — Contexto de Partido (motivación, jornada, derbi)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Modula la probabilidad base por el estado motivacional de los dos equipos.
 * Si el selection beneficia al equipo motivado → sube prob.
 * Si beneficia al equipo desmotivado → baja prob.
 */
export function modelB_context(m: MatchSnapshot, p: PickProposal): ModelOutput {
  const homeMotiv = m.homeMotivFactor   // p.ej. 1.10 = motivado, 0.90 = desmotivado
  const awayMotiv = m.awayMotivFactor
  const motivDelta = homeMotiv - awayMotiv  // -0.3 a +0.3 típicamente

  // Sin clasificación motivacional clara → abstención (ambos = 1.0 neutro)
  if (Math.abs(motivDelta) < 0.05) {
    return abstain("B", "contexto motivacional neutro en ambos equipos")
  }

  // Mapear la selección al equipo que beneficia
  const sel = p.selection.toLowerCase()
  let homeWeight = 0   // -1..+1, cuánto beneficia al home este selection
  if (/local|home|gana.*${m.homeName.toLowerCase()}/i.test(p.selection)) homeWeight = 1
  else if (/visitante|away|gana.*${m.awayName.toLowerCase()}/i.test(p.selection)) homeWeight = -1
  else if (/empate|draw/i.test(sel)) homeWeight = 0
  else if (/over|btts.*s(í|i)/i.test(sel)) homeWeight = 0.5    // beneficia goles → ambos motivados
  else if (/under|btts.*no/i.test(sel)) homeWeight = -0.3

  // Ajuste: cuánto sube/baja la probabilidad por contexto
  const contextShift = homeWeight * motivDelta * 0.5  // máx ±0.075
  const probability = clamp01(p.baseProb + contextShift)

  // Confianza: alta si la diferencia motivacional es marcada
  const confidence = clamp01(Math.abs(motivDelta) * 2)

  return {
    modelId: "B",
    probability,
    confidence,
    explanation: `Contexto: ${m.homeName} ${m.homeMotivStatus} (×${homeMotiv.toFixed(2)}), ${m.awayName} ${m.awayMotivStatus} (×${awayMotiv.toFixed(2)}). Ajuste neto ${contextShift >= 0 ? "+" : ""}${(contextShift * 100).toFixed(1)} pp.`,
    signals: { motivDelta, homeWeight, contextShift },
    abstain: false,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODELO C — Forma Reciente (rachas y fatiga)
// ═══════════════════════════════════════════════════════════════════════════════

const MS_DAY = 86_400_000

function fatigueScore(recentDates: string[], todayISO: string): number {
  // Días entre partidos en los últimos 3 — <3 días = fatiga
  if (recentDates.length < 2) return 0
  const today = new Date(todayISO).getTime()
  const last = new Date(recentDates[0]).getTime()
  const daysSinceLast = (today - last) / MS_DAY
  if (daysSinceLast < 3) return 0.7
  if (daysSinceLast < 4) return 0.4
  return 0
}

export function modelC_form(m: MatchSnapshot, p: PickProposal): ModelOutput {
  // Si no hay forma para ninguno → abstención
  if (!m.homeForm && !m.awayForm) {
    return abstain("C", "sin datos de forma reciente")
  }

  const formDelta = m.homeFormPoints - m.awayFormPoints  // -1 a +1

  const homeFatigue = fatigueScore(m.homeRecentDates, m.kickoffISO)
  const awayFatigue = fatigueScore(m.awayRecentDates, m.kickoffISO)

  // El selection ¿beneficia al equipo en mejor forma?
  const sel = p.selection.toLowerCase()
  let formAlignment = 0
  if (/local|home/i.test(sel) && formDelta > 0.1) formAlignment = formDelta
  else if (/visitante|away/i.test(sel) && formDelta < -0.1) formAlignment = -formDelta
  else if (/local|home/i.test(sel) && formDelta < -0.1) formAlignment = formDelta
  else if (/visitante|away/i.test(sel) && formDelta > 0.1) formAlignment = -formDelta

  // Goles: si ambos vienen marcando → over más probable
  const sumFormPts = m.homeFormPoints + m.awayFormPoints
  if (/over/i.test(sel)) formAlignment = (sumFormPts - 1.0) * 0.3
  if (/under/i.test(sel)) formAlignment = (1.0 - sumFormPts) * 0.3

  const fatiguePenalty = (homeFatigue + awayFatigue) * 0.05
  const shift = formAlignment * 0.08 - fatiguePenalty
  const probability = clamp01(p.baseProb + shift)

  // Confianza: alta si la forma diverge claramente
  const confidence = clamp01(Math.abs(formDelta) * 1.2 + 0.2)

  return {
    modelId: "C",
    probability,
    confidence,
    explanation: `Forma: ${m.homeName} ${m.homeForm} vs ${m.awayName} ${m.awayForm}. Delta ${(formDelta * 100).toFixed(0)}pp${(homeFatigue + awayFatigue) > 0 ? ` · fatiga detectada` : ""}.`,
    signals: { formDelta, homeFatigue, awayFatigue, shift },
    abstain: false,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODELO D — Mercado y Cuotas (edge, eficiencia del mercado)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * El mercado suele ser eficiente. Un edge razonable (3-12%) es buena señal.
 * Un edge enorme (>15%) es sospechoso (¿información perdida?).
 * Un edge negativo o muy bajo (<1%) descarta el pick.
 */
export function modelD_market(m: MatchSnapshot, p: PickProposal): ModelOutput {
  if (!Number.isFinite(p.odd) || p.odd < 1.05 || p.odd > 30) {
    return abstain("D", "cuota fuera de rango operativo")
  }

  const edge = p.rawEdge   // ya viene en pp (puntos porcentuales)
  const impliedPct = m.marketImpliedProb * 100

  // Probabilidad implícita del mercado es nuestro ancla
  let probability = m.marketImpliedProb

  // El mercado se cree X%. Si nuestro edge está en el sweet spot (3-12 pp),
  // confiamos en una corrección parcial — sumamos la mitad del edge.
  let confidence = 0.5
  if (edge >= 3 && edge <= 12) {
    probability = clamp01(m.marketImpliedProb + (edge / 100) * 0.5)
    confidence = 0.7
  } else if (edge > 12 && edge <= 20) {
    // Edge grande pero no irreal: aplicamos solo un tercio (cautela)
    probability = clamp01(m.marketImpliedProb + (edge / 100) * 0.33)
    confidence = 0.55
  } else if (edge > 20) {
    // Edge extremo: el mercado SABE algo que nosotros no
    return abstain("D", `edge extremo (+${edge.toFixed(1)}%) — el mercado conoce algo que nuestro modelo no`)
  } else if (edge < 1) {
    // Sin edge real → el mercado es eficiente, no hay valor
    return abstain("D", `edge insuficiente (${edge.toFixed(1)}%)`)
  } else {
    // Edge 1-3 pp: tibio, confianza baja
    probability = m.marketImpliedProb + (edge / 100) * 0.4
    confidence = 0.4
  }

  return {
    modelId: "D",
    probability,
    confidence,
    explanation: `Mercado: cuota ${p.odd.toFixed(2)} ⇒ implícita ${impliedPct.toFixed(1)}%. Edge ${edge >= 0 ? "+" : ""}${edge.toFixed(1)}pp ${edge >= 3 && edge <= 12 ? "(sweet spot)" : edge > 12 ? "(alto, cautela)" : "(tibio)"}.`,
    signals: { impliedProb: m.marketImpliedProb, edge, odd: p.odd },
    abstain: false,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODELO E — Comportamiento Histórico (H2H + tendencias)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Sin un dataset H2H persistente, usamos el patrón histórico aprendido
 * del Learning Engine (probAdjustment por market/league/selectionType).
 * Si el learning todavía no tiene datos, el modelo se abstiene.
 *
 * El consumidor pasa probAdjustment desde getHistoricalProbAdjustment() para
 * que este módulo permanezca síncrono y sin dependencias externas.
 */
export function modelE_history(
  m: MatchSnapshot,
  p: PickProposal,
  history: { probAdjustment: number; sourcePattern?: string },
): ModelOutput {
  if (Math.abs(history.probAdjustment) < 0.005) {
    return abstain("E", "sin patrón histórico relevante para este mercado/liga")
  }

  const probability = clamp01(p.baseProb + history.probAdjustment)
  // Confianza: proporcional al ajuste (mayor evidencia = mayor confianza)
  const confidence = clamp01(0.4 + Math.abs(history.probAdjustment) * 6)

  return {
    modelId: "E",
    probability,
    confidence,
    explanation: `Histórico: patrón "${history.sourcePattern ?? "agregado"}" sugiere ajuste ${history.probAdjustment >= 0 ? "+" : ""}${(history.probAdjustment * 100).toFixed(2)}pp para ${p.market} en ${m.leagueName}.`,
    signals: { adjustment: history.probAdjustment },
    abstain: false,
  }
}

// ─── Runner ───────────────────────────────────────────────────────────────────

/** Corre los 5 modelos y devuelve la colección ordenada A→E. */
export function runAllModels(
  m: MatchSnapshot,
  p: PickProposal,
  history: { probAdjustment: number; sourcePattern?: string },
): ModelOutput[] {
  return [
    modelA_statisticalPure(m, p),
    modelB_context(m, p),
    modelC_form(m, p),
    modelD_market(m, p),
    modelE_history(m, p, history),
  ]
}
