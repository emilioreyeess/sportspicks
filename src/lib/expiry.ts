/**
 * "Llegas Tarde" — evaluación de VALOR EXPIRADO de un pick (FASE 2).
 *
 * Un pick expira si:
 *   · la cuota actual cayó ≥5% respecto a la inicial  (current < initial * 0.95), o
 *   · el Edge es ≤ 0 (sin ventaja matemática).
 *
 * El modelo guarda UNA cuota por pick (la de generación) y no un feed en vivo de
 * cuota actual, así que la caída solo se evalúa si el caller aporta ambas; el Edge
 * se computa siempre (combinadas: prob − 100/cuota; retos: campo edge).
 */
export interface ExpiryInput {
  initialOdds?: number | null
  currentOdds?: number | null
  /** Edge en puntos porcentuales (p.ej. +3.5 o -1.2). */
  edgePct?: number | null
}

export interface ExpiryResult {
  expired: boolean
  oddsDropped: boolean
  edgeGone: boolean
  initialOdds: number | null
  currentOdds: number | null
}

export function evaluateExpiry({ initialOdds, currentOdds, edgePct }: ExpiryInput): ExpiryResult {
  const io = typeof initialOdds === "number" && isFinite(initialOdds) ? initialOdds : null
  const co = typeof currentOdds === "number" && isFinite(currentOdds) ? currentOdds : null
  const oddsDropped = io != null && co != null && co < io * 0.95
  const edgeGone = typeof edgePct === "number" && isFinite(edgePct) && edgePct <= 0
  return { expired: oddsDropped || edgeGone, oddsDropped, edgeGone, initialOdds: io, currentOdds: co }
}

/** Texto del banner "Llegas Tarde" según el motivo. */
export function expiryBanner(r: ExpiryResult): string {
  if (r.oddsDropped && r.initialOdds != null && r.currentOdds != null) {
    return `LLEGAS TARDE. La cuota ha caído de @${r.initialOdds.toFixed(2)} a @${r.currentOdds.toFixed(2)}.`
  }
  return "LLEGAS TARDE. El valor de este pick ha expirado (Edge ≤ 0)."
}

/** Edge implícito de un pick a partir de su prob. del modelo (0-100) y su cuota. */
export function edgeFromProbOdds(modelProbPct: number, odd: number): number {
  if (!odd || odd <= 1) return 0
  return Math.round((modelProbPct - 100 / odd) * 10) / 10
}
