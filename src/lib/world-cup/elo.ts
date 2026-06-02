/**
 * Elo / FIFA-rank fallback para selecciones.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Cuando un amistoso internacional carece de los datos profundos que el motor
 * Poisson necesita (histórico H2H reciente, promedios de córners de selección,
 * forma estable), nos apoyamos en dos señales VERIFICABLES:
 *
 *   1. FIFA ranking            → convertido a un Elo seed estimado
 *   2. Forma reciente (últimos 5) → si está disponible, ajusta el Elo seed
 *
 * Con ambos Elo calculamos:
 *   · P(home win) / P(draw) / P(away win)   — fórmula Elo clásica
 *   · lambdas Poisson aproximadas           — para tener una expectativa de goles
 *
 * Filosofía anti-hallucination: si tampoco hay FIFA rank para un equipo,
 * devolvemos null en lugar de inventarnos un Elo. NUNCA forzamos un pronóstico
 * sobre la nada.
 */

import { WC_TEAMS } from "@/lib/world-cup/static-data"

/* ── Tabla rápida code → FIFA rank ─────────────────────────────────────────
   Los 48 mundialistas vienen ya en static-data.ts. Para otras selecciones
   relevantes (Italia, Inglaterra, Croacia, etc.) añadimos un mini-cache.
   Si falta, devolvemos null y el motor usará otros fallbacks o saltará. */

const ADDITIONAL_FIFA: Record<string, number> = {
  ITA: 9,   // Italia
  ENG: 4,   // Inglaterra
  CRO: 10,  // Croacia
  COL: 13,  // Colombia
  POR: 6,   // Portugal
  DEN: 19,  // Dinamarca
  SRB: 27,  // Serbia
  POL: 32,  // Polonia
  CHI: 41,  // Chile
  PER: 49,  // Perú
  VEN: 56,  // Venezuela
  BOL: 84,  // Bolivia
  HUN: 36,  // Hungría
  AUT: 26,  // Austria
  NOR: 33,  // Noruega — añadida explícitamente porque AUT/AUS ya conviven en WC
}

/** Devuelve el FIFA ranking conocido para un código de selección o null. */
export function getFifaRank(code: string): number | null {
  const c = (code || "").toUpperCase()
  if (!c) return null
  const fromWc = WC_TEAMS.find((t) => t.code === c)
  if (fromWc?.fifaRanking != null) return fromWc.fifaRanking
  if (ADDITIONAL_FIFA[c] != null) return ADDITIONAL_FIFA[c]
  return null
}

/** Mapa de aliases nombre ESPN → código FIFA. Solo selecciones (no clubes). */
const NAME_TO_CODE: Record<string, string> = {
  "estados unidos": "USA", "usa": "USA",
  "españa": "ESP", "espana": "ESP", "spain": "ESP",
  "francia": "FRA", "france": "FRA",
  "alemania": "GER", "germany": "GER",
  "inglaterra": "ENG", "england": "ENG",
  "italia": "ITA", "italy": "ITA",
  "argentina": "ARG",
  "brasil": "BRA", "brazil": "BRA",
  "uruguay": "URU",
  "portugal": "POR",
  "paises bajos": "NED", "países bajos": "NED", "holanda": "NED", "netherlands": "NED",
  "belgica": "BEL", "bélgica": "BEL", "belgium": "BEL",
  "croacia": "CRO", "croatia": "CRO",
  "colombia": "COL",
  "mexico": "MEX", "méxico": "MEX",
  "japon": "JPN", "japón": "JPN", "japan": "JPN",
  "corea del sur": "KOR", "south korea": "KOR",
  "marruecos": "MAR", "morocco": "MAR",
  "senegal": "SEN",
  "canada": "CAN", "canadá": "CAN",
  "suiza": "SUI", "switzerland": "SUI",
  "dinamarca": "DEN", "denmark": "DEN",
  "polonia": "POL", "poland": "POL",
  "noruega": "NOR", "norway": "NOR",
  "austria": "AUT",
  "turquia": "TUR", "turquía": "TUR", "turkey": "TUR",
  "ecuador": "ECU",
  "paraguay": "PAR",
  "chile": "CHI",
  "peru": "PER", "perú": "PER",
  "venezuela": "VEN",
  "bolivia": "BOL",
  "australia": "AUS",
  "iran": "IRN", "irán": "IRN",
  "egipto": "EGY", "egypt": "EGY",
  "ghana": "GHA",
  "costa de marfil": "CIV", "ivory coast": "CIV",
  "tunez": "TUN", "túnez": "TUN", "tunisia": "TUN",
  "sudafrica": "RSA", "sudáfrica": "RSA",
  "catar": "QAT", "qatar": "QAT",
  "arabia saudi": "KSA", "arabia saudí": "KSA", "saudi arabia": "KSA",
  "chequia": "CZE", "czech republic": "CZE",
  "suecia": "SWE", "sweden": "SWE",
  "escocia": "SCO", "scotland": "SCO",
  "bosnia-herzegovina": "BIH", "bosnia": "BIH",
  "haiti": "HAI", "haití": "HAI",
  "curazao": "CUW",
  "serbia": "SRB",
  "hungria": "HUN", "hungría": "HUN", "hungary": "HUN",
}

/**
 * Mapea un nombre legible ESPN (ej "Estados Unidos", "España") al código
 * FIFA de 3 letras. Devuelve null si no hay match — el caller decide si
 * cae a otro fallback o salta el partido.
 */
export function inferTeamCode(name: string | null | undefined): string | null {
  if (!name) return null
  const norm = name.toLowerCase().trim()
  if (NAME_TO_CODE[norm]) return NAME_TO_CODE[norm]
  // Match parcial — útil cuando ESPN añade sufijos tipo "Brasil U23".
  for (const [alias, code] of Object.entries(NAME_TO_CODE)) {
    if (norm.startsWith(alias) || norm.includes(` ${alias} `)) return code
  }
  return null
}

/* ── FIFA rank → Elo seed ──────────────────────────────────────────────────
   Mapeo monotónico estándar usado por la mayoría de modelos públicos:
     rank 1   → 2100
     rank 10  → ~1950
     rank 50  → ~1700
     rank 100 → ~1500
     rank 200 → ~1350
   Curva log compresiva para que diferencias en el top sean más sensibles. */

const ELO_BASE = 2100
const ELO_LOG_FACTOR = 130

export function eloFromFifaRank(rank: number | null | undefined): number | null {
  if (rank == null || !isFinite(rank) || rank <= 0) return null
  // Math.log(1) = 0 → rank 1 = ELO_BASE
  const elo = ELO_BASE - Math.log(rank) * ELO_LOG_FACTOR
  return Math.round(elo)
}

/** Ajusta el Elo seed con la forma reciente (W=+12, D=0, L=-12 por partido). */
export function eloAdjustedByForm(seedElo: number, form: string[] | null | undefined): number {
  if (!form || form.length === 0) return seedElo
  let delta = 0
  for (const r of form) {
    if (r === "W") delta += 12
    else if (r === "L") delta -= 12
  }
  return Math.round(seedElo + delta)
}

/* ── Probabilidades Elo 1X2 ───────────────────────────────────────────────
   Fórmula Elo clásica para fútbol (Hyder/Hvattum):
     P(home_advantage) → +60 Elo points al local en amistosos en suelo neutral
                          → +90 en partidos oficiales en casa
     P(home win raw)   = 1 / (1 + 10 ^ ((awayElo - homeElo - HA) / 400))
   El empate se modela como una banda alrededor de la igualdad Elo. */

const ELO_DIVISOR = 400

export interface EloProbabilities {
  pHome: number
  pDraw: number
  pAway: number
  /** Diferencia neta Elo (con home advantage aplicado). Útil para logging. */
  eloDiff: number
  /** Goles esperados aproximados — para alimentar Poisson cuando hay fallback. */
  lambdaHome: number
  lambdaAway: number
}

/**
 * @param homeAdv  Elo points que se suman al local (60 amistoso neutral,
 *                 90 oficial en casa, 0 sede mundialista neutra).
 * @param leagueAvgGoals  media de goles por equipo del entorno (default 1.3
 *                 para selecciones — menor que clubes).
 */
export function eloProbabilities(
  homeElo: number,
  awayElo: number,
  opts: { homeAdv?: number; leagueAvgGoals?: number } = {},
): EloProbabilities {
  const homeAdv = opts.homeAdv ?? 60
  const avg = opts.leagueAvgGoals ?? 1.3

  const eloDiff = (homeElo + homeAdv) - awayElo

  // Probabilidad de NO-empate del local (sin restar empate todavía)
  const pHomeRaw = 1 / (1 + Math.pow(10, -eloDiff / ELO_DIVISOR))

  // Banda de empate: máx 0.30 cuando los Elo son idénticos, decae cuando la
  // diferencia crece. Se inspira en datos empíricos: en fútbol internacional
  // los empates son ~25-30% cuando los equipos son parejos.
  const drawBand = 0.30 * Math.exp(-Math.pow(eloDiff / 250, 2))
  const pDraw = Math.max(0.10, Math.min(0.32, drawBand))

  // Repartimos el resto entre home/away según pHomeRaw
  const remain = 1 - pDraw
  const pHome = pHomeRaw * remain
  const pAway = (1 - pHomeRaw) * remain

  // Lambdas Poisson aproximadas: el equipo dominante saca ~1.5x avg, el otro
  // ~0.7x avg, escalado por la diff Elo (clamp 0.5x..2.2x).
  const strength = clamp(Math.pow(10, eloDiff / 800), 0.5, 2.2)
  const lambdaHome = avg * strength
  const lambdaAway = avg / strength

  return {
    pHome: round3(pHome),
    pDraw: round3(pDraw),
    pAway: round3(pAway),
    eloDiff: Math.round(eloDiff),
    lambdaHome: round3(lambdaHome),
    lambdaAway: round3(lambdaAway),
  }
}

/* ── Estimación combinada por código de selección ────────────────────────── */

export interface EloMatchEstimate extends EloProbabilities {
  homeElo: number
  awayElo: number
  /** Razón legible para auditoría. */
  reasoning: string
}

/**
 * Estimación 1X2 + lambdas para un partido de selecciones a partir de los
 * códigos ESPN/FIFA. Devuelve null si NO podemos obtener Elo de uno de los
 * dos (sin invención).
 *
 * @param homeForm/awayForm  opcional — array W/D/L últimos partidos
 * @param neutralVenue  true si el partido no se juega en casa del "home"
 */
export function estimateFromElo(
  homeCode: string,
  awayCode: string,
  opts: {
    homeForm?: string[] | null
    awayForm?: string[] | null
    neutralVenue?: boolean
    competitive?: boolean
  } = {},
): EloMatchEstimate | null {
  const homeRank = getFifaRank(homeCode)
  const awayRank = getFifaRank(awayCode)
  if (homeRank == null || awayRank == null) return null

  const homeSeed = eloFromFifaRank(homeRank)
  const awaySeed = eloFromFifaRank(awayRank)
  if (homeSeed == null || awaySeed == null) return null

  const homeElo = eloAdjustedByForm(homeSeed, opts.homeForm)
  const awayElo = eloAdjustedByForm(awaySeed, opts.awayForm)

  // Home advantage: 0 si neutral, 60 amistoso normal, 90 si es oficial en casa
  const homeAdv = opts.neutralVenue ? 0 : opts.competitive ? 90 : 60

  const probs = eloProbabilities(homeElo, awayElo, { homeAdv })

  const reasoning =
    `Fallback Elo: ${homeCode} (FIFA #${homeRank}, Elo ${homeElo}) vs ` +
    `${awayCode} (FIFA #${awayRank}, Elo ${awayElo}). ` +
    `Δ=${probs.eloDiff} con home_adv=${homeAdv}. ` +
    `Forma reciente aplicada: ${(opts.homeForm ?? []).join("")} / ${(opts.awayForm ?? []).join("")}`

  return {
    ...probs,
    homeElo,
    awayElo,
    reasoning,
  }
}

/* ── Utils ───────────────────────────────────────────────────────────────── */

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}
function round3(v: number): number {
  return Math.round(v * 1000) / 1000
}
