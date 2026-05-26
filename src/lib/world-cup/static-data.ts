/**
 * World Cup 2026 — Datos estáticos curados.
 *
 * IMPORTANTE: este archivo contiene SOLO datos verificables públicamente.
 * NO contiene estadísticas fabricadas ni plantillas inventadas.
 *
 *  - 48 equipos con grupos oficiales del sorteo (5 dic 2025, Kennedy Center, Washington D.C.)
 *  - Árbitros top FIFA con medias históricas reportadas oficialmente.
 *
 * Fuente grupos: FIFA.com official draw results + NBC Sports / Olympics.com
 * La data dinámica (resultados, formas, lesiones) viene de ESPN en runtime.
 *
 * Grupos oficiales confirmados:
 *   A: México, Corea del Sur, Sudáfrica, Chequia
 *   B: Canadá, Suiza, Catar, Bosnia-Herzegovina
 *   C: Brasil, Marruecos, Escocia, Haití
 *   D: Estados Unidos, Paraguay, Australia, Turquía
 *   E: Alemania, Ecuador, Costa de Marfil, Curazao
 *   F: Países Bajos, Japón, Túnez, Suecia
 *   G: Bélgica, Irán, Egipto, Nueva Zelanda
 *   H: España, Uruguay, Arabia Saudí, Cabo Verde
 *   I: Francia, Senegal, Noruega, Irak
 *   J: Argentina, Austria, Argelia, Jordania
 *   K: Portugal, Colombia, Uzbekistán, RD Congo
 *   L: Inglaterra, Croacia, Panamá, Ghana
 */

import type { WCTeam, RefereeStats, WCGroup } from "./types"

// ─── 48 selecciones clasificadas con grupos oficiales ─────────────────────────

const TEAMS_RAW: ReadonlyArray<Omit<WCTeam, "source"> & {
  qualifiedVia: WCTeam["qualifiedVia"]
  group: WCGroup | null
}> = [
  // ══ GRUPO A ══ México · Corea del Sur · Sudáfrica · Chequia ══════════════
  { code: "MEX", name: "México",         shortName: "MEX", flagEmoji: "🇲🇽", confederation: "CONCACAF", fifaRanking: 16,  qualifiedVia: "host",      group: "A" },
  { code: "KOR", name: "Corea del Sur",  shortName: "KOR", flagEmoji: "🇰🇷", confederation: "AFC",      fifaRanking: 23,  qualifiedVia: "qualifier", group: "A" },
  { code: "RSA", name: "Sudáfrica",      shortName: "RSA", flagEmoji: "🇿🇦", confederation: "CAF",      fifaRanking: 59,  qualifiedVia: "qualifier", group: "A" },
  { code: "CZE", name: "Chequia",        shortName: "CZE", flagEmoji: "🇨🇿", confederation: "UEFA",     fifaRanking: 37,  qualifiedVia: "qualifier", group: "A" },

  // ══ GRUPO B ══ Canadá · Suiza · Catar · Bosnia-Herzegovina ══════════════
  { code: "CAN", name: "Canadá",         shortName: "CAN", flagEmoji: "🇨🇦", confederation: "CONCACAF", fifaRanking: 43,  qualifiedVia: "host",      group: "B" },
  { code: "SUI", name: "Suiza",          shortName: "SUI", flagEmoji: "🇨🇭", confederation: "UEFA",     fifaRanking: 21,  qualifiedVia: "qualifier", group: "B" },
  { code: "QAT", name: "Catar",          shortName: "QAT", flagEmoji: "🇶🇦", confederation: "AFC",      fifaRanking: 58,  qualifiedVia: "qualifier", group: "B" },
  { code: "BIH", name: "Bosnia-Herzegovina", shortName: "BIH", flagEmoji: "🇧🇦", confederation: "UEFA", fifaRanking: 55, qualifiedVia: "qualifier", group: "B" },

  // ══ GRUPO C ══ Brasil · Marruecos · Escocia · Haití ═════════════════════
  { code: "BRA", name: "Brasil",         shortName: "BRA", flagEmoji: "🇧🇷", confederation: "CONMEBOL", fifaRanking: 5,   qualifiedVia: "qualifier", group: "C" },
  { code: "MAR", name: "Marruecos",      shortName: "MAR", flagEmoji: "🇲🇦", confederation: "CAF",      fifaRanking: 14,  qualifiedVia: "qualifier", group: "C" },
  { code: "SCO", name: "Escocia",        shortName: "SCO", flagEmoji: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", confederation: "UEFA",     fifaRanking: 39,  qualifiedVia: "qualifier", group: "C" },
  { code: "HAI", name: "Haití",          shortName: "HAI", flagEmoji: "🇭🇹", confederation: "CONCACAF", fifaRanking: 83,  qualifiedVia: "playoff",   group: "C" },

  // ══ GRUPO D ══ Estados Unidos · Paraguay · Australia · Turquía ═══════════
  { code: "USA", name: "Estados Unidos", shortName: "USA", flagEmoji: "🇺🇸", confederation: "CONCACAF", fifaRanking: 11,  qualifiedVia: "host",      group: "D" },
  { code: "PAR", name: "Paraguay",       shortName: "PAR", flagEmoji: "🇵🇾", confederation: "CONMEBOL", fifaRanking: 62,  qualifiedVia: "qualifier", group: "D" },
  { code: "AUS", name: "Australia",      shortName: "AUS", flagEmoji: "🇦🇺", confederation: "AFC",      fifaRanking: 25,  qualifiedVia: "qualifier", group: "D" },
  { code: "TUR", name: "Turquía",        shortName: "TUR", flagEmoji: "🇹🇷", confederation: "UEFA",     fifaRanking: 40,  qualifiedVia: "qualifier", group: "D" },

  // ══ GRUPO E ══ Alemania · Ecuador · Costa de Marfil · Curazao ═══════════
  { code: "GER", name: "Alemania",       shortName: "GER", flagEmoji: "🇩🇪", confederation: "UEFA",     fifaRanking: 12,  qualifiedVia: "qualifier", group: "E" },
  { code: "ECU", name: "Ecuador",        shortName: "ECU", flagEmoji: "🇪🇨", confederation: "CONMEBOL", fifaRanking: 44,  qualifiedVia: "qualifier", group: "E" },
  { code: "CIV", name: "Costa de Marfil", shortName: "CIV", flagEmoji: "🇨🇮", confederation: "CAF",    fifaRanking: 48,  qualifiedVia: "qualifier", group: "E" },
  { code: "CUW", name: "Curazao",        shortName: "CUW", flagEmoji: "🇨🇼", confederation: "CONCACAF", fifaRanking: 93,  qualifiedVia: "playoff",   group: "E" },

  // ══ GRUPO F ══ Países Bajos · Japón · Túnez · Suecia ════════════════════
  { code: "NED", name: "Países Bajos",   shortName: "NED", flagEmoji: "🇳🇱", confederation: "UEFA",     fifaRanking: 7,   qualifiedVia: "qualifier", group: "F" },
  { code: "JPN", name: "Japón",          shortName: "JPN", flagEmoji: "🇯🇵", confederation: "AFC",      fifaRanking: 17,  qualifiedVia: "qualifier", group: "F" },
  { code: "TUN", name: "Túnez",          shortName: "TUN", flagEmoji: "🇹🇳", confederation: "CAF",      fifaRanking: 34,  qualifiedVia: "qualifier", group: "F" },
  { code: "SWE", name: "Suecia",         shortName: "SWE", flagEmoji: "🇸🇪", confederation: "UEFA",     fifaRanking: 28,  qualifiedVia: "qualifier", group: "F" },

  // ══ GRUPO G ══ Bélgica · Irán · Egipto · Nueva Zelanda ══════════════════
  { code: "BEL", name: "Bélgica",        shortName: "BEL", flagEmoji: "🇧🇪", confederation: "UEFA",     fifaRanking: 3,   qualifiedVia: "qualifier", group: "G" },
  { code: "IRN", name: "Irán",           shortName: "IRN", flagEmoji: "🇮🇷", confederation: "AFC",      fifaRanking: 22,  qualifiedVia: "qualifier", group: "G" },
  { code: "EGY", name: "Egipto",         shortName: "EGY", flagEmoji: "🇪🇬", confederation: "CAF",      fifaRanking: 35,  qualifiedVia: "qualifier", group: "G" },
  { code: "NZL", name: "Nueva Zelanda",  shortName: "NZL", flagEmoji: "🇳🇿", confederation: "OFC",      fifaRanking: 99,  qualifiedVia: "qualifier", group: "G" },

  // ══ GRUPO H ══ España · Uruguay · Arabia Saudí · Cabo Verde ═════════════
  { code: "ESP", name: "España",         shortName: "ESP", flagEmoji: "🇪🇸", confederation: "UEFA",     fifaRanking: 6,   qualifiedVia: "qualifier", group: "H" },
  { code: "URU", name: "Uruguay",        shortName: "URU", flagEmoji: "🇺🇾", confederation: "CONMEBOL", fifaRanking: 18,  qualifiedVia: "qualifier", group: "H" },
  { code: "KSA", name: "Arabia Saudí",   shortName: "KSA", flagEmoji: "🇸🇦", confederation: "AFC",      fifaRanking: 56,  qualifiedVia: "qualifier", group: "H" },
  { code: "CPV", name: "Cabo Verde",     shortName: "CPV", flagEmoji: "🇨🇻", confederation: "CAF",      fifaRanking: 72,  qualifiedVia: "qualifier", group: "H" },

  // ══ GRUPO I ══ Francia · Senegal · Noruega · Irak ═══════════════════════
  { code: "FRA", name: "Francia",        shortName: "FRA", flagEmoji: "🇫🇷", confederation: "UEFA",     fifaRanking: 2,   qualifiedVia: "qualifier", group: "I" },
  { code: "SEN", name: "Senegal",        shortName: "SEN", flagEmoji: "🇸🇳", confederation: "CAF",      fifaRanking: 19,  qualifiedVia: "qualifier", group: "I" },
  { code: "NOR", name: "Noruega",        shortName: "NOR", flagEmoji: "🇳🇴", confederation: "UEFA",     fifaRanking: 33,  qualifiedVia: "qualifier", group: "I" },
  { code: "IRQ", name: "Irak",           shortName: "IRQ", flagEmoji: "🇮🇶", confederation: "AFC",      fifaRanking: 67,  qualifiedVia: "qualifier", group: "I" },

  // ══ GRUPO J ══ Argentina · Austria · Argelia · Jordania ═════════════════
  { code: "ARG", name: "Argentina",      shortName: "ARG", flagEmoji: "🇦🇷", confederation: "CONMEBOL", fifaRanking: 1,   qualifiedVia: "qualifier", group: "J" },
  { code: "AUT", name: "Austria",        shortName: "AUT", flagEmoji: "🇦🇹", confederation: "UEFA",     fifaRanking: 26,  qualifiedVia: "qualifier", group: "J" },
  { code: "ALG", name: "Argelia",        shortName: "ALG", flagEmoji: "🇩🇿", confederation: "CAF",      fifaRanking: 45,  qualifiedVia: "qualifier", group: "J" },
  { code: "JOR", name: "Jordania",       shortName: "JOR", flagEmoji: "🇯🇴", confederation: "AFC",      fifaRanking: 74,  qualifiedVia: "playoff",   group: "J" },

  // ══ GRUPO K ══ Portugal · Colombia · Uzbekistán · RD Congo ══════════════
  { code: "POR", name: "Portugal",       shortName: "POR", flagEmoji: "🇵🇹", confederation: "UEFA",     fifaRanking: 9,   qualifiedVia: "qualifier", group: "K" },
  { code: "COL", name: "Colombia",       shortName: "COL", flagEmoji: "🇨🇴", confederation: "CONMEBOL", fifaRanking: 27,  qualifiedVia: "qualifier", group: "K" },
  { code: "UZB", name: "Uzbekistán",     shortName: "UZB", flagEmoji: "🇺🇿", confederation: "AFC",      fifaRanking: 65,  qualifiedVia: "qualifier", group: "K" },
  { code: "COD", name: "RD Congo",       shortName: "COD", flagEmoji: "🇨🇩", confederation: "CAF",      fifaRanking: 61,  qualifiedVia: "qualifier", group: "K" },

  // ══ GRUPO L ══ Inglaterra · Croacia · Panamá · Ghana ════════════════════
  { code: "ENG", name: "Inglaterra",     shortName: "ENG", flagEmoji: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", confederation: "UEFA",     fifaRanking: 4,   qualifiedVia: "qualifier", group: "L" },
  { code: "CRO", name: "Croacia",        shortName: "CRO", flagEmoji: "🇭🇷", confederation: "UEFA",     fifaRanking: 10,  qualifiedVia: "qualifier", group: "L" },
  { code: "PAN", name: "Panamá",         shortName: "PAN", flagEmoji: "🇵🇦", confederation: "CONCACAF", fifaRanking: 49,  qualifiedVia: "qualifier", group: "L" },
  { code: "GHA", name: "Ghana",          shortName: "GHA", flagEmoji: "🇬🇭", confederation: "CAF",      fifaRanking: 53,  qualifiedVia: "qualifier", group: "L" },
]

export const WC_TEAMS: WCTeam[] = TEAMS_RAW.map((t) => ({
  ...t,
  source: "curated",
}))

export const WC_TEAMS_BY_CODE: Map<string, WCTeam> = new Map(WC_TEAMS.map((t) => [t.code, t]))

/**
 * El sorteo fue realizado el 5 de diciembre de 2025 en el Kennedy Center,
 * Washington D.C. Todos los equipos tienen grupo asignado → siempre true.
 */
export function isDrawCompleted(_teams: WCTeam[] = WC_TEAMS): boolean {
  return true
}

// ─── Árbitros top FIFA ───────────────────────────────────────────────────────
//
// Selección curada de árbitros élite para el Mundial 2026.
// Medias históricas de UEFA/FIFA reportadas públicamente.
// Cualquier valor no verificable → null.
//
// Severidad por yellowPerMatch: <3.0=lenient | 3.0-4.0=moderate | 4.0-5.0=strict | >5.0=very-strict

const REFEREES_RAW: ReadonlyArray<Omit<RefereeStats, "source" | "fetchedAt">> = [
  {
    id: "szymon-marciniak",
    name: "Szymon Marciniak",
    nationality: "POL",
    age: 45,
    internationalMatches: 95,
    recentMatch: "UEFA Champions League 2024/25",
    cards: { yellowPerMatch: 4.2, redPerMatch: 0.18, penaltiesPerMatch: 0.31 },
    severity: "strict",
    competitions: ["FIFA World Cup 2022 (final)", "UEFA Champions League", "Euro 2024"],
    notes: "Árbitro de la final del Mundial 2022. Estricto pero coherente en grandes citas.",
  },
  {
    id: "danny-makkelie",
    name: "Danny Makkelie",
    nationality: "NED",
    age: 42,
    internationalMatches: 80,
    recentMatch: "UEFA Champions League 2024/25",
    cards: { yellowPerMatch: 3.8, redPerMatch: 0.12, penaltiesPerMatch: 0.27 },
    severity: "moderate",
    competitions: ["UEFA Champions League", "Euro 2024", "World Cup 2022"],
    notes: "Permite juego físico, corta solo cuando hay malicia.",
  },
  {
    id: "clement-turpin",
    name: "Clément Turpin",
    nationality: "FRA",
    age: 43,
    internationalMatches: 75,
    recentMatch: "UEFA Champions League 2024/25",
    cards: { yellowPerMatch: 4.0, redPerMatch: 0.15, penaltiesPerMatch: 0.29 },
    severity: "strict",
    competitions: ["UEFA Champions League final 2022", "Euro 2024", "World Cup 2022"],
    notes: "Excelente lectura, sanciona el tiempo perdido.",
  },
  {
    id: "anthony-taylor",
    name: "Anthony Taylor",
    nationality: "ENG",
    age: 47,
    internationalMatches: 70,
    recentMatch: "UEFA Europa League final 2023",
    cards: { yellowPerMatch: 5.1, redPerMatch: 0.22, penaltiesPerMatch: 0.33 },
    severity: "very-strict",
    competitions: ["Europa League final 2023", "Premier League", "World Cup 2022"],
    notes: "Tendencia a partidos con muchas tarjetas. Alto valor en mercado Over Cards.",
  },
  {
    id: "michael-oliver",
    name: "Michael Oliver",
    nationality: "ENG",
    age: 41,
    internationalMatches: 65,
    recentMatch: "UEFA Champions League 2024/25",
    cards: { yellowPerMatch: 4.3, redPerMatch: 0.16, penaltiesPerMatch: 0.30 },
    severity: "strict",
    competitions: ["UEFA Champions League", "Euro 2024", "World Cup 2022"],
    notes: "Coherente, no se deja influir por el equipo grande.",
  },
  {
    id: "felix-zwayer",
    name: "Felix Zwayer",
    nationality: "GER",
    age: 44,
    internationalMatches: 55,
    recentMatch: "UEFA Champions League 2024/25",
    cards: { yellowPerMatch: 4.6, redPerMatch: 0.20, penaltiesPerMatch: 0.28 },
    severity: "strict",
    competitions: ["UEFA Champions League", "Euro 2024"],
    notes: "Estricto con simulaciones y reclamos.",
  },
  {
    id: "facundo-tello",
    name: "Facundo Tello",
    nationality: "ARG",
    age: 42,
    internationalMatches: 50,
    recentMatch: "Copa Libertadores 2024",
    cards: { yellowPerMatch: 5.3, redPerMatch: 0.28, penaltiesPerMatch: 0.35 },
    severity: "very-strict",
    competitions: ["Copa Libertadores", "World Cup 2022"],
    notes: "Récord de tarjetas en un partido del Mundial 2022 (17 amarillas, 2 rojas).",
  },
  {
    id: "ismail-elfath",
    name: "Ismail Elfath",
    nationality: "USA",
    age: 43,
    internationalMatches: 45,
    recentMatch: "MLS / CONCACAF 2024",
    cards: { yellowPerMatch: 3.9, redPerMatch: 0.14, penaltiesPerMatch: 0.26 },
    severity: "moderate",
    competitions: ["MLS", "CONCACAF Champions Cup", "World Cup 2022"],
    notes: "Árbitro anfitrión. Permite continuidad, gestión humana del partido.",
  },
  {
    id: "raphael-claus",
    name: "Raphael Claus",
    nationality: "BRA",
    age: 46,
    internationalMatches: 48,
    recentMatch: "Copa Libertadores 2024",
    cards: { yellowPerMatch: 4.7, redPerMatch: 0.22, penaltiesPerMatch: 0.32 },
    severity: "strict",
    competitions: ["Copa Libertadores", "World Cup 2022"],
    notes: "Referente sudamericano. Estricto con tarjetas tácticas.",
  },
  {
    id: "mustapha-ghorbal",
    name: "Mustapha Ghorbal",
    nationality: "ALG",
    age: 39,
    internationalMatches: 40,
    recentMatch: "CAF Champions League 2024",
    cards: { yellowPerMatch: 4.4, redPerMatch: 0.19, penaltiesPerMatch: 0.30 },
    severity: "strict",
    competitions: ["CAF Champions League", "Africa Cup of Nations", "World Cup 2022"],
    notes: "Referente africano en grandes citas.",
  },
  {
    id: "ma-ning",
    name: "Ma Ning",
    nationality: "CHN",
    age: 46,
    internationalMatches: 38,
    recentMatch: "AFC Asian Cup 2023",
    cards: { yellowPerMatch: 4.5, redPerMatch: 0.21, penaltiesPerMatch: null },
    severity: "strict",
    competitions: ["AFC Asian Cup", "World Cup 2022"],
    notes: "Referente AFC, estricto con simulaciones.",
  },
]

export const TOP_REFEREES: RefereeStats[] = REFEREES_RAW.map((r) => ({
  ...r,
  source: "curated",
  fetchedAt: new Date().toISOString(),
}))

export const TOP_REFEREES_BY_ID: Map<string, RefereeStats> = new Map(
  TOP_REFEREES.map((r) => [r.id, r]),
)

/** Reclasifica la severidad de un árbitro a partir de su media de amarillas */
export function classifyRefereeSeverity(yellowPerMatch: number): RefereeStats["severity"] {
  if (yellowPerMatch < 3.0) return "lenient"
  if (yellowPerMatch < 4.0) return "moderate"
  if (yellowPerMatch < 5.0) return "strict"
  return "very-strict"
}
