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

/* ── Inferidor por nombre de competición (ESPN) ──────────────────────────────
   Mientras consumimos la API pública de ESPN (no API-Football), la única señal
   fiable del nombre de competición es el string que devuelve ESPN. Analizamos
   substrings característicos de fútbol de SELECCIONES para activar el fallback
   bandera/siglas del TeamCrest y evitar escudos rotos. */

const INTL_NAME_PATTERNS = [
  "friendly", "amistoso",
  "international", "internacional",
  "world cup", "mundial", "fifa",
  "nations league", "nations", "naciones",
  "copa america", "conmebol",          // acentos eliminados por normalización
  "euro", "eurocopa",
  "qualif", "clasificator", "clasificacion",
  "concacaf", "afcon", "africa cup", "asian cup", "gold cup",
  "seleccion",
]

/**
 * Infiere si una competición es de selecciones a partir del string que devuelve
 * ESPN (`league_name` o similar). Hace matching por substring tras normalizar
 * (lowercase + sin acentos).
 *
 * Exclusión deliberada: cualquier competición que contenga "club" se trata como
 * fútbol de clubes aunque incluya "world" (ej. "FIFA Club World Cup" /
 * "Mundial de Clubes") — esas SÍ tienen escudos válidos en ESPN.
 */
export function inferIsInternationalFromESPN(competition: string | null | undefined): boolean {
  if (!competition) return false
  const s = competition
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")   // quita diacríticos
    .trim()
  if (!s) return false
  if (s.includes("club")) return false  // Mundial de Clubes ≠ selecciones
  return INTL_NAME_PATTERNS.some((p) => s.includes(p))
}
