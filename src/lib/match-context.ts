/**
 * Match context — clasificación de competición y multiplicador de varianza.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * El motor predictivo trata MUY DISTINTO un Real Madrid–Barça (datos
 * abundantes, alineaciones estables, motivación alta) que un Estados Unidos–
 * Costa de Marfil amistoso en pretemporada (rotaciones masivas, varianza alta,
 * pocos datos H2H recientes).
 *
 * Este módulo centraliza esa clasificación. Devuelve un `MatchContextProfile`
 * que se usa en:
 *   · pipeline.ts          → decide si ingestar el partido con Elo fallback
 *   · supabase-ml.ts       → etiqueta la predicción con `context` para que el
 *                            Brier/peso se aísle del fútbol de clubes
 *   · decision-engine      → ajusta umbral de edge y quality_gate
 *   · match-model.ts       → relaja MIN_GAMES_FOR_ANALYSIS si hay Elo de ambos
 */

export type MatchContext =
  | "club"                       // Liga doméstica + UEFA clubs
  | "international_friendly"     // Amistoso de selecciones (fifa.friendly)
  | "international_competitive"  // Mundial, Eurocopa, Copa América, NL, clasifs.

export interface MatchContextProfile {
  context: MatchContext
  /** Multiplicador de significancia (0.0–1.5). Baja para amistosos (varianza
   *  alta por rotaciones), sube en torneo (motivación máxima). */
  significance: number
  /** Edge mínimo (puntos %) para considerar un pick. Por defecto 3.0 en clubes;
   *  más alto en amistosos para compensar la varianza. */
  minEdge: number
  /** Quality gate (0–100). Más estricto en amistosos. */
  qualityGate: number
  /** Peso del histórico a largo plazo (0–1). Bajo en amistosos por las
   *  rotaciones (el modelo se apoya más en Elo y forma reciente). */
  historyWeight: number
  /** True si el motor puede ingestar el partido cuando faltan datos de
   *  forma, apoyándose en Elo + FIFA ranking. */
  allowEloFallback: boolean
  /** Etiqueta legible para UI / logs. */
  label: string
}

/** Slugs ESPN que representan competiciones INTERNACIONALES competitivas. */
const INTL_COMPETITIVE_SLUGS = new Set<string>([
  "fifa.world", "FIFA.WC",
  "CONCACAF.WC", "CONMEBOL.WC", "AFC.WC", "CAF.WC", "UEFA.WC",
  "UEFA.EURO", "conmebol.america", "CONCACAF.NATIONS", "UEFA.NL",
  "afc.asian.cup", "caf.nations",
])

/** Slugs ESPN de amistosos puros. */
const INTL_FRIENDLY_SLUGS = new Set<string>([
  "fifa.friendly",
])

/* ── Perfiles base ────────────────────────────────────────────────────────── */

const PROFILES: Record<MatchContext, Omit<MatchContextProfile, "context">> = {
  // Clubes (liga regular). Es la calibración por defecto.
  club: {
    significance: 1.00,
    minEdge: 1.5,   // FASE 1: 3.0 → 1.5 (más volumen; admite value picks conservadores)
    qualityGate: 56,
    historyWeight: 1.00,
    allowEloFallback: false,
    label: "Liga de clubes",
  },
  // Amistosos: varianza alta por rotaciones, motivación errática. Subimos
  // el listón de edge y reducimos el peso del histórico — el modelo se apoya
  // más en Elo. NO descartamos el partido (lo queremos para calibrar pre-WC).
  international_friendly: {
    significance: 0.55,
    minEdge: 3.0,   // FASE 1: 5.0 → 3.0 (más volumen; sigue por encima de clubes por la varianza)
    qualityGate: 62,
    historyWeight: 0.40,
    allowEloFallback: true,
    label: "Amistoso internacional",
  },
  // Torneo o eliminatoria oficial: motivación máxima, alineaciones más estables
  // que en amistosos. Mantenemos edge estándar pero historyWeight algo menor
  // que clubes (las selecciones juegan menos seguido).
  international_competitive: {
    significance: 1.15,
    minEdge: 2.0,   // FASE 1: 3.5 → 2.0 (más volumen)
    qualityGate: 58,
    historyWeight: 0.75,
    allowEloFallback: true,
    label: "Competición oficial de selecciones",
  },
}

/* ── API pública ─────────────────────────────────────────────────────────── */

/**
 * Clasifica una competición ESPN en uno de los tres contextos y devuelve el
 * perfil de calibración aplicable. NUNCA lanza — slugs desconocidos se tratan
 * como "club" (calibración por defecto).
 *
 * @param slug   slug ESPN de la liga (e.g. "esp.1", "fifa.friendly", "UEFA.EURO")
 * @param hint   pista opcional del evento ESPN; si `event.season.type === 4`
 *               (postseason) o el nombre contiene "friendly" puede afinar la
 *               clasificación cuando el slug es ambiguo.
 */
export function getMatchContext(slug: string, hint?: {
  seasonType?: number | null
  name?: string | null
}): MatchContextProfile {
  const s = (slug || "").trim()
  let ctx: MatchContext

  if (INTL_FRIENDLY_SLUGS.has(s)) ctx = "international_friendly"
  else if (INTL_COMPETITIVE_SLUGS.has(s)) ctx = "international_competitive"
  else {
    // Heurística por nombre del evento — sólo se aplica si el slug no fue
    // clasificado explícitamente.
    const name = (hint?.name ?? "").toLowerCase()
    if (name.includes("friendly") || name.includes("amistoso")) {
      ctx = "international_friendly"
    } else {
      ctx = "club"
    }
  }

  return { context: ctx, ...PROFILES[ctx] }
}

/** True si el contexto corresponde a una competición de selecciones. */
export function isInternational(ctx: MatchContext): boolean {
  return ctx === "international_friendly" || ctx === "international_competitive"
}

/**
 * Devuelve la pareja (scope_type, scope_key) que usaremos en `team_form_weights`
 * y `model_performance` para aislar el aprendizaje. Esto es lo que permite que
 * un amistoso loco NO contamine los pesos del Brasileirão.
 */
export function contextScopeKey(ctx: MatchContext): { scopeType: "context"; scope: string } {
  return { scopeType: "context", scope: ctx }
}
