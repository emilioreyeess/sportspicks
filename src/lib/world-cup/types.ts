/**
 * World Cup 2026 — Tipos centrales.
 *
 * Reglas de diseño:
 *  - Zero `any` exportado
 *  - Toda data tiene `source: "espn" | "curated" | "fifa-official"` para
 *    que la UI sepa cuándo confiar y cuándo mostrar disclaimer
 *  - Toda data tiene `fetchedAt` ISO para mostrar frescura
 *  - REGLA ABSOLUTA: si un dato no está disponible (ej. valor de mercado),
 *    el campo es `null` o se omite — NUNCA un placeholder inventado
 */

// ─── Códigos y enums base ─────────────────────────────────────────────────────

/** Confederaciones FIFA */
export type Confederation = "UEFA" | "CONMEBOL" | "CONCACAF" | "AFC" | "CAF" | "OFC"

/** Códigos de los 12 grupos del Mundial 2026 (48 equipos) */
export type WCGroup = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L"

/** Fase del torneo */
export type WCStage =
  | "group"
  | "round-of-32"
  | "round-of-16"
  | "quarter-final"
  | "semi-final"
  | "third-place"
  | "final"

/** Posiciones simplificadas */
export type PlayerPosition = "GK" | "DF" | "MF" | "FW"

/** Estado de la lesión / disponibilidad */
export type InjuryStatus = "fit" | "doubt" | "out"

/**
 * Tier de jugador — proxy honesto de "valor de mercado".
 * Evita inventar cifras: solo clasificamos por nivel observable.
 */
export type PlayerTier = "world-class" | "top-club" | "regular" | "youngster"

/** Severidad arbitral derivada de tarjetas por partido */
export type RefereeSeverity = "lenient" | "moderate" | "strict" | "very-strict"

/** Fuente del dato — la UI lo usa para mostrar etiquetas de transparencia */
export type DataSource = "espn" | "curated" | "fifa-official" | "computed"

// ─── Equipos ──────────────────────────────────────────────────────────────────

export interface WCTeam {
  /** Código FIFA 3-letras: "ESP", "ARG", "USA"... */
  code: string
  name: string
  shortName: string
  flagEmoji: string
  confederation: Confederation
  /** Ranking FIFA al momento del torneo (null si aún sin actualizar) */
  fifaRanking: number | null
  /** Grupo asignado tras el sorteo (null antes del sorteo) */
  group: WCGroup | null
  /** Si la selección viene del playoff intercontinental, etc. */
  qualifiedVia: "host" | "qualifier" | "playoff" | "pending"
  source: DataSource
}

// ─── Plantilla / Jugadores ────────────────────────────────────────────────────

export interface WCPlayer {
  id: string                     // ID interno (slug deterministic)
  espnId: string | null          // ID en ESPN si está mapeado
  name: string
  position: PlayerPosition
  shirtNumber: number | null
  age: number | null
  /** Club al momento del torneo */
  club: string | null
  clubCountry: string | null
  tier: PlayerTier
  caps: number | null            // partidos con la selección
  goals: number | null
  injuryStatus: InjuryStatus
  injuryNote: string | null      // nota humana ("rotura fibrilar, 4-6 semanas")
  /** Apercibido para próximo partido (1 amarilla de suspensión) */
  bookedForNext: boolean
}

export interface WCSquad {
  teamCode: string
  players: WCPlayer[]
  /** Total de internacionalidades acumuladas — proxy de experiencia */
  totalCaps: number
  /** Edad media (años, decimal) */
  avgAge: number
  /** Cuántos jugadores no fit (doubt + out) */
  injuredCount: number
  /** Cuántos top-tier (world-class + top-club) */
  topTierCount: number
  fetchedAt: string
  source: DataSource
  /** Lista de campos que ESPN no provee y rellenamos como null */
  knownGaps: string[]
}

// ─── Resultado / Forma ────────────────────────────────────────────────────────

export type MatchVenueLocation = "H" | "A" | "N"

export interface WCMatchResult {
  date: string                   // YYYY-MM-DD
  opponent: string               // nombre del rival
  opponentCode: string | null    // código si es selección, null si club
  homeAway: MatchVenueLocation
  goalsFor: number
  goalsAgainst: number
  result: "W" | "D" | "L"
  /** "World Cup Qualifying", "Friendly", "Nations League", etc. */
  competition: string
}

export interface WCTeamForm {
  teamCode: string
  /** Últimos 10 partidos, más reciente primero */
  last10: WCMatchResult[]
  goalsForAvg: number
  goalsAgainstAvg: number
  cleanSheets: number
  bttsCount: number
  over25Count: number
  bttsPct: number                // 0-1
  over25Pct: number              // 0-1
  /** Puntos de los últimos 5 (3 por W, 1 por D) sobre 15 */
  formPoints: number
  formString: string             // "WWDLW"
  /**
   * Cohesion score 0-100: porcentaje de los últimos 10 partidos en los que
   * el XI inicial repite al menos 7 nombres respecto al partido anterior.
   * Solo se computa si tenemos rosters por match. Si no → null.
   */
  cohesionScore: number | null
  fetchedAt: string
  source: DataSource
}

// ─── Árbitros ─────────────────────────────────────────────────────────────────

export interface RefereeCardStats {
  yellowPerMatch: number
  redPerMatch: number
  /** Penaltis pitados por partido. null si no disponible. */
  penaltiesPerMatch: number | null
}

export interface RefereeStats {
  id: string                     // slug
  name: string
  nationality: string
  age: number | null
  /** Partidos internacionales oficiales (UEFA + FIFA tournaments) */
  internationalMatches: number
  /** Partido reciente que cubrimos (para validar que está activo) */
  recentMatch: string | null
  cards: RefereeCardStats
  severity: RefereeSeverity
  /** Competiciones recientes oficiadas */
  competitions: string[]
  /** Notas de comportamiento ("muy estricto con tiempo perdido") */
  notes: string | null
  source: DataSource
  fetchedAt: string
}

// ─── Disciplina de jugadores ──────────────────────────────────────────────────

export interface PlayerDiscipline {
  playerId: string
  playerName: string
  teamCode: string
  /** Tarjetas amarillas esta temporada en su club */
  yellowSeason: number | null
  redSeason: number | null
  matchesPlayedSeason: number | null
  /** Tarjetas/partido — null si no hay datos */
  cardsPerMatch: number | null
  /** Apercibido para próximo partido del Mundial */
  bookedForNext: boolean
  source: DataSource
}

// ─── Calendario / Fixtures ────────────────────────────────────────────────────

export interface WCVenue {
  city: string
  country: string         // ISO short: USA / MEX / CAN
  stadium: string
}

export interface WCFixture {
  matchId: string                // estable: "wc26-A-1-MEX-FRA"
  stage: WCStage
  group: WCGroup | null
  /** Número de partido dentro del grupo (1..6) o eliminatoria (RO32-1...RO16-1...) */
  stageMatchNumber: number
  kickoffISO: string             // ISO 8601 con TZ
  venue: WCVenue
  homeCode: string
  awayCode: string
  /** ID del árbitro asignado (null si aún no designado) */
  refereeId: string | null
  status: "scheduled" | "live" | "final" | "postponed"
  result: {
    homeScore: number
    awayScore: number
    homeScoreHT: number | null
    awayScoreHT: number | null
    /** Penaltis solo en knockouts */
    homePenalties: number | null
    awayPenalties: number | null
  } | null
  source: DataSource
}

// ─── Standings de grupo ───────────────────────────────────────────────────────

export interface WCGroupTeamStanding {
  teamCode: string
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  goalDiff: number
  points: number
  position: number
  /** En 2026: top 2 + 8 mejores terceros pasan a R32 */
  qualificationStatus: "qualified-direct" | "qualified-as-third" | "in-contention" | "eliminated" | "pending"
}

export interface WCGroupStanding {
  group: WCGroup
  teams: WCGroupTeamStanding[]
  fetchedAt: string
  source: DataSource
}

// ─── Match Center (vista completa de un partido) ──────────────────────────────

export interface XgSnapshot {
  /** xG ofensivo (goles esperados marcados) en últimos 5 */
  xgFor5: number
  /** xG defensivo (goles esperados concedidos) */
  xgAgainst5: number
  /** Promedio real de goles marcados/concedidos para comparar contra xG */
  goalsFor5: number
  goalsAgainst5: number
}

export interface MatchContextFlags {
  /** Eliminatoria directa */
  isKnockout: boolean
  /** Ambos equipos consiguen el objetivo con un empate */
  bothNeedDraw: boolean
  /** Derbi/clásico continental (Brasil-Argentina, España-Portugal...) */
  isClassic: boolean
  /** Partido de máxima exigencia (semifinal, final) */
  highStakes: boolean
  /** Diferencias de altitud, calor extremo, etc. */
  environmentalFactor: string | null
}

export interface MatchCenter {
  fixture: WCFixture
  home: {
    team: WCTeam
    squad: WCSquad | null
    form: WCTeamForm | null
    /** Estrellas/titulares lesionados o sancionados */
    keyAbsences: WCPlayer[]
    xg: XgSnapshot | null
  }
  away: {
    team: WCTeam
    squad: WCSquad | null
    form: WCTeamForm | null
    keyAbsences: WCPlayer[]
    xg: XgSnapshot | null
  }
  referee: RefereeStats | null
  context: MatchContextFlags
  fetchedAt: string
}

// ─── Dark Horses ──────────────────────────────────────────────────────────────

export interface DarkHorse {
  teamCode: string
  teamName: string
  /** Score 0-100: edge detectado por el motor */
  edge: number
  /** Mercado donde se detecta el valor: "outright", "to-reach-quarters", "group-winner"... */
  marketType: string
  /** Cuota implícita del mercado vs probabilidad del modelo */
  marketImpliedProb: number     // 0-1
  modelProb: number             // 0-1
  reasons: string[]
  riskTier: "low" | "mid" | "high"
}

// ─── Respuestas de API públicas ───────────────────────────────────────────────

export interface TeamsResponse {
  teams: WCTeam[]
  byGroup: Partial<Record<WCGroup, WCTeam[]>>
  fetchedAt: string
  source: DataSource
  /** Indica si los grupos ya están sorteados */
  drawCompleted: boolean
}

export interface TeamDetailResponse {
  team: WCTeam
  squad: WCSquad | null
  form: WCTeamForm | null
  /** Fixtures pendientes en el torneo */
  upcomingFixtures: WCFixture[]
  pastFixtures: WCFixture[]
  discipline: PlayerDiscipline[]
  fetchedAt: string
}

export interface BracketResponse {
  groups: WCGroupStanding[]
  knockoutFixtures: WCFixture[]
  fetchedAt: string
  source: DataSource
}

export interface DarkHorsesResponse {
  darkHorses: DarkHorse[]
  computedAt: string
  /** Modelo + versión que generó el análisis */
  modelInfo: { engine: string; version: string }
  disclaimer: string
}
