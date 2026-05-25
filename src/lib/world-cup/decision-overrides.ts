/**
 * World Cup 2026 — Overrides del Decision Engine para selecciones nacionales.
 *
 * Diferencia clave vs liga:
 *  - Forma de hace 6 meses pesa menos (cambios de plantilla, ciclo internacional)
 *  - Los amistosos preparatorios pesan MÁS aunque sean recientes
 *  - El contexto de torneo lo es TODO (eliminación directa, diferencia de goles
 *    en fase de grupos, "ambos consiguen el objetivo con un empate")
 *
 * Estos overrides MODIFICAN los pesos del consensus engine y añaden flags
 * de contexto que el ContradictionGate puede usar.
 */

import type { WeightsConfig } from "../learning/types"
import type { MatchContextFlags, WCGroupStanding, WCGroupTeamStanding } from "./types"

// ─── Pesos específicos para el Mundial ────────────────────────────────────────

export const WORLD_CUP_CONSENSUS_WEIGHTS: WeightsConfig["consensus"] = {
  // En seleccionados el modelo estadístico vale algo menos (muestras pequeñas
  // entre torneos), pero contexto y forma reciente valen más.
  stat:    0.22,
  context: 0.30,   // ↑ vs 0.20 por defecto
  form:    0.26,   // ↑ vs 0.20 por defecto
  market:  0.16,
  history: 0.06,   // ↓ los patrones de liga no aplican
}

/** Construye un WeightsConfig completo combinando el actual + override WC */
export function applyWorldCupWeightOverride(base: WeightsConfig): WeightsConfig {
  return {
    ...base,
    consensus: WORLD_CUP_CONSENSUS_WEIGHTS,
    lastAdjustedAt: new Date().toISOString(),
    adjustmentHistory: [
      ...base.adjustmentHistory.slice(-29),
      {
        date: new Date().toISOString().slice(0, 10),
        changes: [
          `consensus.context: ${base.consensus.context} → ${WORLD_CUP_CONSENSUS_WEIGHTS.context}`,
          `consensus.form: ${base.consensus.form} → ${WORLD_CUP_CONSENSUS_WEIGHTS.form}`,
          `consensus.history: ${base.consensus.history} → ${WORLD_CUP_CONSENSUS_WEIGHTS.history}`,
        ],
        triggeredBy: "world-cup-2026-override",
      },
    ],
  }
}

// ─── Detección "ambos equipos contentos con empate" ───────────────────────────

/**
 * En la última jornada de grupo, si A y B juegan entre sí y a ambos les
 * vale el empate para clasificar (top 2 directo o tercero clasificable),
 * el partido tiene un alto riesgo de empate "de conveniencia".
 *
 * En 2026: top 2 de cada grupo + 8 mejores terceros pasan a Round of 32.
 * Un tercero con ≥4 puntos típicamente clasifica.
 */
export function detectBothNeedDraw(args: {
  homeCode: string
  awayCode: string
  group: WCGroupStanding | null
  matchNumberInGroup: number   // 1..6 (6 = última jornada)
}): { bothNeedDraw: boolean; rationale: string } {
  if (args.matchNumberInGroup !== 6 || !args.group) {
    return { bothNeedDraw: false, rationale: "" }
  }

  const home = args.group.teams.find((t) => t.teamCode === args.homeCode)
  const away = args.group.teams.find((t) => t.teamCode === args.awayCode)
  if (!home || !away) return { bothNeedDraw: false, rationale: "" }

  // Empate les daría a ambos +1 punto. Simular escenario tras empate.
  const homeAfterDraw: WCGroupTeamStanding = { ...home, points: home.points + 1, played: home.played + 1, drawn: home.drawn + 1 }
  const awayAfterDraw: WCGroupTeamStanding = { ...away, points: away.points + 1, played: away.played + 1, drawn: away.drawn + 1 }

  // Calcular cómo quedaría el grupo con esos nuevos puntos
  const projected = args.group.teams.map((t) => {
    if (t.teamCode === args.homeCode) return homeAfterDraw
    if (t.teamCode === args.awayCode) return awayAfterDraw
    return t
  }).sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff)

  // ¿Ambos quedan en top 2 o con al menos 4 puntos (tercero seguro)?
  const homePos = projected.findIndex((t) => t.teamCode === args.homeCode) + 1
  const awayPos = projected.findIndex((t) => t.teamCode === args.awayCode) + 1
  const homeOk = homePos <= 2 || homeAfterDraw.points >= 4
  const awayOk = awayPos <= 2 || awayAfterDraw.points >= 4

  if (homeOk && awayOk) {
    return {
      bothNeedDraw: true,
      rationale: `Última jornada del grupo. Tras empate, ${args.homeCode} quedaría ${homePos}º (${homeAfterDraw.points} pts) y ${args.awayCode} ${awayPos}º (${awayAfterDraw.points} pts) — ambos clasifican.`,
    }
  }
  return { bothNeedDraw: false, rationale: "" }
}

// ─── Enriquecer MatchContextFlags con la lógica del Mundial ──────────────────

export function enrichContextFlagsForWorldCup(
  base: MatchContextFlags,
  args: { bothNeedDraw: boolean; bothNeedDrawRationale: string },
): MatchContextFlags & { bothNeedDrawRationale?: string } {
  return {
    ...base,
    bothNeedDraw: args.bothNeedDraw,
    bothNeedDrawRationale: args.bothNeedDrawRationale || undefined,
  }
}

// ─── Modelo C override — forma con énfasis en últimos 3 amistosos ────────────

/**
 * Devuelve un coeficiente 0-1 que multiplica el peso de cada partido reciente.
 * Para selecciones, los últimos 3 partidos preparatorios (mes anterior al
 * torneo) reciben peso 1.0 mientras que los de hace 6 meses pesan 0.4.
 *
 * Aplicado en `models.modelC_form` cuando el caller lo proporciona.
 */
export function recencyWeightForWorldCup(daysAgo: number): number {
  if (daysAgo <= 30) return 1.00
  if (daysAgo <= 60) return 0.85
  if (daysAgo <= 120) return 0.65
  if (daysAgo <= 180) return 0.50
  return 0.35
}

// ─── Modelo B override — bothNeedDraw → empuja prob hacia el empate ──────────

/**
 * Si `bothNeedDraw` está activo, sumamos un boost a la probabilidad del
 * mercado Draw (1X2) y al Under 2.5 (ambos juegan a no perder).
 *
 * Devuelve el shift a aplicar a `baseProb` según el selection.
 */
export function bothNeedDrawShift(selection: string, isActive: boolean): number {
  if (!isActive) return 0
  const sel = selection.toLowerCase()
  if (/empate|draw/.test(sel)) return +0.10
  if (/under/.test(sel))       return +0.07
  if (/over/.test(sel))        return -0.05
  if (/gana|local|visitante|home|away/.test(sel)) return -0.06
  return 0
}
