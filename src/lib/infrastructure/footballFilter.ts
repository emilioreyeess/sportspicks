/**
 * footballFilter — blindaje de calidad de fixtures.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Descarta partidos que no deben entrar al pipeline cuantitativo. Hoy: los
 * amistosos ("Friendly"), cuyo resultado tiene poco valor predictivo (rotaciones
 * masivas, intensidad baja, motivación nula) y ensucian el modelo.
 *
 * Se aplica en `footballApi.getFixtures` ANTES del upsert, de modo que ningún
 * amistoso llega siquiera a la tabla `fixtures`.
 *
 * Función pura, sin dependencias de red ni cliente. Nunca lanza.
 */

/** Forma mínima necesaria para clasificar un partido (subset de API-Football). */
export interface MatchClassifiable {
  league?: {
    name?: string | null
    type?: string | null
  } | null
}

// Patrones que identifican un amistoso en el nombre/tipo de competición de
// API-Football (normalizado: lowercase + sin acentos).
const FRIENDLY_PATTERNS = [
  "friendly", "friendlies",
  "amistoso", "amistosos",
  "club friendlies",
]

function normalize(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
}

/**
 * ¿El partido es válido para el pipeline? `false` si es un amistoso.
 *
 * Defensivo: si no hay info de liga, lo consideramos válido (no descartamos por
 * falta de datos — preferimos un falso positivo a perder un partido real).
 */
export function isMatchValid(match: MatchClassifiable | null | undefined): boolean {
  if (!match || !match.league) return true

  const name = normalize(match.league.name)
  const type = normalize(match.league.type)

  // API-Football marca los amistosos típicamente con league.name "Friendlies"
  // o "Club Friendlies". El campo type suele ser "Cup"/"League", no fiable solo.
  if (FRIENDLY_PATTERNS.some((p) => name.includes(p))) return false
  if (FRIENDLY_PATTERNS.some((p) => type.includes(p))) return false

  return true
}

/** Filtra una lista, descartando los amistosos. */
export function filterValidMatches<T extends MatchClassifiable>(matches: T[]): T[] {
  return matches.filter((m) => isMatchValid(m))
}
