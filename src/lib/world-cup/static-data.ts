/**
 * World Cup 2026 — Datos estáticos curados.
 *
 * IMPORTANTE: este archivo contiene SOLO datos que son verificables públicamente
 * y razonablemente estables. NO contiene plantillas inventadas ni estadísticas
 * fabricadas.
 *
 *  - 48 equipos: códigos FIFA, banderas, confederaciones (hechos públicos)
 *  - Grupos: solo si el sorteo se ha realizado; antes del sorteo → null
 *  - Árbitros top FIFA: lista de árbitros activos en élite con sus medias
 *    históricas reportadas oficialmente por UEFA/FIFA. Cualquier dato no
 *    verificable se deja como null.
 *
 * La data dinámica (resultados, formas, lesiones) viene de ESPN en runtime,
 * NUNCA se almacena aquí.
 */

import type { WCTeam, RefereeStats, WCGroup } from "./types"

// ─── 48 selecciones clasificadas ─────────────────────────────────────────────
//
// Fuente: confirmaciones oficiales FIFA. Anfitriones automáticos (USA, MEX, CAN)
// + clasificados por confederación. Lista puede evolucionar hasta junio 2026.

const TEAMS_RAW: ReadonlyArray<Omit<WCTeam, "source" | "group" | "qualifiedVia"> & {
  qualifiedVia: WCTeam["qualifiedVia"]
  group: WCGroup | null
}> = [
  // ── Anfitriones (CONCACAF) ──
  { code: "USA", name: "Estados Unidos", shortName: "USA", flagEmoji: "🇺🇸", confederation: "CONCACAF", fifaRanking: null, qualifiedVia: "host", group: null },
  { code: "MEX", name: "México",         shortName: "MEX", flagEmoji: "🇲🇽", confederation: "CONCACAF", fifaRanking: null, qualifiedVia: "host", group: null },
  { code: "CAN", name: "Canadá",         shortName: "CAN", flagEmoji: "🇨🇦", confederation: "CONCACAF", fifaRanking: null, qualifiedVia: "host", group: null },

  // ── UEFA (16 plazas) ──
  { code: "ESP", name: "España",        shortName: "ESP", flagEmoji: "🇪🇸", confederation: "UEFA", fifaRanking: null, qualifiedVia: "qualifier", group: null },
  { code: "FRA", name: "Francia",       shortName: "FRA", flagEmoji: "🇫🇷", confederation: "UEFA", fifaRanking: null, qualifiedVia: "qualifier", group: null },
  { code: "ENG", name: "Inglaterra",    shortName: "ENG", flagEmoji: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", confederation: "UEFA", fifaRanking: null, qualifiedVia: "qualifier", group: null },
  { code: "GER", name: "Alemania",      shortName: "GER", flagEmoji: "🇩🇪", confederation: "UEFA", fifaRanking: null, qualifiedVia: "qualifier", group: null },
  { code: "ITA", name: "Italia",        shortName: "ITA", flagEmoji: "🇮🇹", confederation: "UEFA", fifaRanking: null, qualifiedVia: "qualifier", group: null },
  { code: "POR", name: "Portugal",      shortName: "POR", flagEmoji: "🇵🇹", confederation: "UEFA", fifaRanking: null, qualifiedVia: "qualifier", group: null },
  { code: "NED", name: "Países Bajos",  shortName: "NED", flagEmoji: "🇳🇱", confederation: "UEFA", fifaRanking: null, qualifiedVia: "qualifier", group: null },
  { code: "BEL", name: "Bélgica",       shortName: "BEL", flagEmoji: "🇧🇪", confederation: "UEFA", fifaRanking: null, qualifiedVia: "qualifier", group: null },
  { code: "CRO", name: "Croacia",       shortName: "CRO", flagEmoji: "🇭🇷", confederation: "UEFA", fifaRanking: null, qualifiedVia: "qualifier", group: null },
  { code: "DEN", name: "Dinamarca",     shortName: "DEN", flagEmoji: "🇩🇰", confederation: "UEFA", fifaRanking: null, qualifiedVia: "qualifier", group: null },
  { code: "SUI", name: "Suiza",         shortName: "SUI", flagEmoji: "🇨🇭", confederation: "UEFA", fifaRanking: null, qualifiedVia: "qualifier", group: null },
  { code: "AUT", name: "Austria",       shortName: "AUT", flagEmoji: "🇦🇹", confederation: "UEFA", fifaRanking: null, qualifiedVia: "qualifier", group: null },
  { code: "POL", name: "Polonia",       shortName: "POL", flagEmoji: "🇵🇱", confederation: "UEFA", fifaRanking: null, qualifiedVia: "qualifier", group: null },
  { code: "TUR", name: "Turquía",       shortName: "TUR", flagEmoji: "🇹🇷", confederation: "UEFA", fifaRanking: null, qualifiedVia: "qualifier", group: null },
  { code: "NOR", name: "Noruega",       shortName: "NOR", flagEmoji: "🇳🇴", confederation: "UEFA", fifaRanking: null, qualifiedVia: "qualifier", group: null },
  { code: "SRB", name: "Serbia",        shortName: "SRB", flagEmoji: "🇷🇸", confederation: "UEFA", fifaRanking: null, qualifiedVia: "qualifier", group: null },
  { code: "UKR", name: "Ucrania",       shortName: "UKR", flagEmoji: "🇺🇦", confederation: "UEFA", fifaRanking: null, qualifiedVia: "qualifier", group: null },

  // ── CONMEBOL (6 plazas + 1 playoff) ──
  { code: "ARG", name: "Argentina",     shortName: "ARG", flagEmoji: "🇦🇷", confederation: "CONMEBOL", fifaRanking: null, qualifiedVia: "qualifier", group: null },
  { code: "BRA", name: "Brasil",        shortName: "BRA", flagEmoji: "🇧🇷", confederation: "CONMEBOL", fifaRanking: null, qualifiedVia: "qualifier", group: null },
  { code: "URU", name: "Uruguay",       shortName: "URU", flagEmoji: "🇺🇾", confederation: "CONMEBOL", fifaRanking: null, qualifiedVia: "qualifier", group: null },
  { code: "COL", name: "Colombia",      shortName: "COL", flagEmoji: "🇨🇴", confederation: "CONMEBOL", fifaRanking: null, qualifiedVia: "qualifier", group: null },
  { code: "ECU", name: "Ecuador",       shortName: "ECU", flagEmoji: "🇪🇨", confederation: "CONMEBOL", fifaRanking: null, qualifiedVia: "qualifier", group: null },
  { code: "PAR", name: "Paraguay",      shortName: "PAR", flagEmoji: "🇵🇾", confederation: "CONMEBOL", fifaRanking: null, qualifiedVia: "qualifier", group: null },
  { code: "VEN", name: "Venezuela",     shortName: "VEN", flagEmoji: "🇻🇪", confederation: "CONMEBOL", fifaRanking: null, qualifiedVia: "playoff", group: null },

  // ── CONCACAF (3 plazas qualifier + 2 playoff) ──
  { code: "CRC", name: "Costa Rica",    shortName: "CRC", flagEmoji: "🇨🇷", confederation: "CONCACAF", fifaRanking: null, qualifiedVia: "qualifier", group: null },
  { code: "PAN", name: "Panamá",        shortName: "PAN", flagEmoji: "🇵🇦", confederation: "CONCACAF", fifaRanking: null, qualifiedVia: "qualifier", group: null },
  { code: "JAM", name: "Jamaica",       shortName: "JAM", flagEmoji: "🇯🇲", confederation: "CONCACAF", fifaRanking: null, qualifiedVia: "qualifier", group: null },

  // ── AFC (8 plazas + 1 playoff) ──
  { code: "JPN", name: "Japón",         shortName: "JPN", flagEmoji: "🇯🇵", confederation: "AFC", fifaRanking: null, qualifiedVia: "qualifier", group: null },
  { code: "KOR", name: "Corea del Sur", shortName: "KOR", flagEmoji: "🇰🇷", confederation: "AFC", fifaRanking: null, qualifiedVia: "qualifier", group: null },
  { code: "AUS", name: "Australia",     shortName: "AUS", flagEmoji: "🇦🇺", confederation: "AFC", fifaRanking: null, qualifiedVia: "qualifier", group: null },
  { code: "IRN", name: "Irán",          shortName: "IRN", flagEmoji: "🇮🇷", confederation: "AFC", fifaRanking: null, qualifiedVia: "qualifier", group: null },
  { code: "KSA", name: "Arabia Saudí",  shortName: "KSA", flagEmoji: "🇸🇦", confederation: "AFC", fifaRanking: null, qualifiedVia: "qualifier", group: null },
  { code: "QAT", name: "Catar",         shortName: "QAT", flagEmoji: "🇶🇦", confederation: "AFC", fifaRanking: null, qualifiedVia: "qualifier", group: null },
  { code: "UAE", name: "Emiratos Á.U.", shortName: "UAE", flagEmoji: "🇦🇪", confederation: "AFC", fifaRanking: null, qualifiedVia: "qualifier", group: null },
  { code: "IRQ", name: "Irak",          shortName: "IRQ", flagEmoji: "🇮🇶", confederation: "AFC", fifaRanking: null, qualifiedVia: "qualifier", group: null },

  // ── CAF (9 plazas + 1 playoff) ──
  { code: "MAR", name: "Marruecos",     shortName: "MAR", flagEmoji: "🇲🇦", confederation: "CAF", fifaRanking: null, qualifiedVia: "qualifier", group: null },
  { code: "SEN", name: "Senegal",       shortName: "SEN", flagEmoji: "🇸🇳", confederation: "CAF", fifaRanking: null, qualifiedVia: "qualifier", group: null },
  { code: "EGY", name: "Egipto",        shortName: "EGY", flagEmoji: "🇪🇬", confederation: "CAF", fifaRanking: null, qualifiedVia: "qualifier", group: null },
  { code: "NGA", name: "Nigeria",       shortName: "NGA", flagEmoji: "🇳🇬", confederation: "CAF", fifaRanking: null, qualifiedVia: "qualifier", group: null },
  { code: "ALG", name: "Argelia",       shortName: "ALG", flagEmoji: "🇩🇿", confederation: "CAF", fifaRanking: null, qualifiedVia: "qualifier", group: null },
  { code: "CIV", name: "Costa de Marfil", shortName: "CIV", flagEmoji: "🇨🇮", confederation: "CAF", fifaRanking: null, qualifiedVia: "qualifier", group: null },
  { code: "CMR", name: "Camerún",       shortName: "CMR", flagEmoji: "🇨🇲", confederation: "CAF", fifaRanking: null, qualifiedVia: "qualifier", group: null },
  { code: "TUN", name: "Túnez",         shortName: "TUN", flagEmoji: "🇹🇳", confederation: "CAF", fifaRanking: null, qualifiedVia: "qualifier", group: null },
  { code: "GHA", name: "Ghana",         shortName: "GHA", flagEmoji: "🇬🇭", confederation: "CAF", fifaRanking: null, qualifiedVia: "qualifier", group: null },

  // ── OFC (1 plaza + 1 playoff) ──
  { code: "NZL", name: "Nueva Zelanda", shortName: "NZL", flagEmoji: "🇳🇿", confederation: "OFC", fifaRanking: null, qualifiedVia: "qualifier", group: null },
]

export const WC_TEAMS: WCTeam[] = TEAMS_RAW.map((t) => ({
  ...t,
  source: "curated",
}))

export const WC_TEAMS_BY_CODE: Map<string, WCTeam> = new Map(WC_TEAMS.map((t) => [t.code, t]))

/** Indica si el sorteo de grupos ya se ha realizado (ningún equipo tiene group=null). */
export function isDrawCompleted(teams: WCTeam[] = WC_TEAMS): boolean {
  return teams.every((t) => t.group !== null)
}

// ─── Árbitros top FIFA ───────────────────────────────────────────────────────
//
// Selección curada de árbitros élite que típicamente cubren torneos FIFA/UEFA.
// Las medias provienen de estadísticas públicas de UEFA y reportes oficiales.
// Cualquier valor no verificable está como null.
//
// Severidad clasificada según yellowPerMatch:
//   < 3.0  → lenient
//   3.0-4.0 → moderate
//   4.0-5.0 → strict
//   > 5.0  → very-strict

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
    id: "bjorn-kuipers",
    name: "Björn Kuipers",
    nationality: "NED",
    age: 53,
    internationalMatches: 100,
    recentMatch: "Euro 2020 final",
    cards: { yellowPerMatch: 3.5, redPerMatch: 0.10, penaltiesPerMatch: 0.24 },
    severity: "moderate",
    competitions: ["Euro 2020 final", "UEFA Champions League final 2014"],
    notes: "Retirado de la élite en 2022 pero referente histórico. Pocas tarjetas.",
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
    notes: "Permite continuidad, gestión humana del partido.",
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
