/**
 * Diccionario robusto NOMBRE → CÓDIGO FIFA para el Mundial 2026.
 *
 * La tabla `fixtures` de Supabase guarda los nombres en INGLÉS (API-Football),
 * mientras que WC_TEAMS los tiene en ESPAÑOL. El antiguo `matchEspnToCode` casaba
 * por substring contra el nombre ES y fallaba en idiomas distintos (South Africa
 * ≠ Sudáfrica, South Korea ≠ Corea del Sur…), dejando la vista vacía.
 *
 * Aquí mapeamos los 48 nombres EN reales de la BD a su código. Si un nombre no
 * está, `resolveWcCode` devuelve null → el caller usa el nombre CRUDO como
 * fallback visual (nunca rompe el render ni vacía el array).
 */
import { WC_TEAMS } from "./static-data"

function norm(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")   // quita acentos (ü→u, ç→c, í→i…)
    .replace(/[^a-z0-9 &]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

// Nombres EN de API-Football (los reales de la BD) → código FIFA.
const EN_TO_CODE: Record<string, string> = {
  "algeria": "ALG", "argentina": "ARG", "australia": "AUS", "austria": "AUT",
  "belgium": "BEL", "bosnia & herzegovina": "BIH", "bosnia and herzegovina": "BIH",
  "brazil": "BRA", "canada": "CAN", "cape verde islands": "CPV", "cape verde": "CPV",
  "colombia": "COL", "congo dr": "COD", "dr congo": "COD", "croatia": "CRO",
  "curacao": "CUW", "czechia": "CZE", "czech republic": "CZE", "ecuador": "ECU",
  "egypt": "EGY", "england": "ENG", "france": "FRA", "germany": "GER", "ghana": "GHA",
  "haiti": "HAI", "iran": "IRN", "iraq": "IRQ", "ivory coast": "CIV", "japan": "JPN",
  "jordan": "JOR", "mexico": "MEX", "morocco": "MAR", "netherlands": "NED",
  "new zealand": "NZL", "norway": "NOR", "panama": "PAN", "paraguay": "PAR",
  "portugal": "POR", "qatar": "QAT", "saudi arabia": "KSA", "scotland": "SCO",
  "senegal": "SEN", "south africa": "RSA", "south korea": "KOR", "korea republic": "KOR",
  "spain": "ESP", "sweden": "SWE", "switzerland": "SUI", "tunisia": "TUN",
  "turkiye": "TUR", "turkey": "TUR", "usa": "USA", "united states": "USA",
  "uruguay": "URU", "uzbekistan": "UZB",
}

// Índice por nombre ES de WC_TEAMS (por si la BD trajera español en algún caso).
const ES_TO_CODE: Record<string, string> = Object.fromEntries(
  WC_TEAMS.map((t) => [norm(t.name), t.code]),
)

/** Resuelve el código FIFA (EN o ES). Devuelve null si el nombre no se reconoce. */
export function resolveWcCode(name: string): string | null {
  const n = norm(name)
  return EN_TO_CODE[n] ?? ES_TO_CODE[n] ?? null
}

/** Diccionario de display EN→ES (para fallback de texto si no hay WCTeam). */
export const COUNTRY_ES: Record<string, string> = Object.fromEntries(
  WC_TEAMS.map((t) => {
    const code = t.code
    const en = Object.entries(EN_TO_CODE).find(([, c]) => c === code)?.[0]
    return [en ?? norm(t.name), t.name]
  }),
)
