/**
 * Team crest helpers — resolución de bandera / siglas FIFA para selecciones.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Regla R2: para partidos de selección NO usamos escudos (las APIs públicas no
 * tienen logos fiables de selección). En su lugar renderizamos bandera emoji o,
 * como fallback garantizado, las siglas FIFA tipográficas ("ESP", "ARG"…).
 *
 * Este módulo es puro (sin React) — lo consume `TeamCrest.tsx`.
 */

import { inferTeamCode } from "@/lib/world-cup/elo"
import { WC_TEAMS_BY_CODE } from "@/lib/world-cup/static-data"
import { getMatchContext } from "@/lib/match-context"

export interface TeamCrest {
  /** Código FIFA de 3 letras si se reconoce la selección, e.g. "ESP". */
  code: string | null
  /** Bandera emoji si la selección está en el catálogo, e.g. "🇪🇸". */
  emoji: string | null
  /** Fallback tipográfico SIEMPRE presente: siglas FIFA o iniciales del club. */
  initials: string
}

/**
 * Deriva iniciales legibles de un nombre de equipo cuando no hay código FIFA
 * (típico en clubes). "Real Madrid" → "RM", "Arsenal" → "ARS", "PSG" → "PSG".
 * Nunca devuelve cadena vacía.
 */
export function deriveInitials(name: string | null | undefined): string {
  const clean = (name ?? "").trim()
  if (!clean) return "?"
  const words = clean.split(/\s+/).filter(Boolean)
  if (words.length >= 2) {
    // Multi-palabra: primera letra de las dos primeras palabras significativas
    return (words[0][0] + words[1][0]).toUpperCase()
  }
  // Una sola palabra: primeras 3 letras
  return clean.slice(0, 3).toUpperCase()
}

/**
 * Resuelve el crest de un equipo a partir de su nombre. NUNCA lanza.
 * - `code`/`emoji` no-null sólo si la selección se reconoce.
 * - `initials` siempre presente como último recurso visual.
 */
export function getTeamCrest(teamName: string | null | undefined): TeamCrest {
  const code = inferTeamCode(teamName)
  let emoji: string | null = null
  if (code) {
    emoji = WC_TEAMS_BY_CODE.get(code)?.flagEmoji ?? null
  }
  return {
    code,
    emoji,
    initials: code ?? deriveInitials(teamName),
  }
}

/**
 * Conveniencia: ¿el slug de liga corresponde a una competición de selecciones?
 * Reutiliza la clasificación central de contexto (club vs international_*).
 */
export function isInternationalSlug(slug: string | null | undefined): boolean {
  if (!slug) return false
  return getMatchContext(slug).context !== "club"
}
