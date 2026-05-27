/**
 * The Odds API — cuotas reales para el Mundial 2026.
 *
 * Docs: https://the-odds-api.com/lp/documentation/
 * Registro gratis: https://the-odds-api.com → 500 req/mes plan free
 * Variable de entorno: ODDS_API_KEY
 *
 * Sport key del Mundial 2026: "soccer_fifa_world_cup"
 * Mercados soportados: h2h (1X2), totals (O/U), spreads (hándicap)
 *
 * Estrategia de caché:
 *   - Cuotas de un partido: TTL 2h (cambian poco antes del partido)
 *   - Lista de eventos: TTL 6h
 *   - Si la API falla → null (el motor usa probabilidades del modelo Poisson)
 */

import { cacheGet, cacheSet } from "./cache"

const BASE = "https://api.the-odds-api.com/v4"
const SPORT = "soccer_fifa_world_cup"

// Bookmakers preferidos en orden (el primero disponible se usa como referencia)
const PREFERRED_BOOKMAKERS = ["pinnacle", "bet365", "betfair", "draftkings", "fanduel", "unibet"]

function getKey(): string | null {
  return process.env.ODDS_API_KEY ?? null
}

export function isOddsEnabled(): boolean {
  return getKey() !== null
}

async function oddsFetch<T = unknown>(path: string, params: Record<string, string> = {}): Promise<T | null> {
  const key = getKey()
  if (!key) return null

  const url = new URL(`${BASE}/${path}`)
  url.searchParams.set("apiKey", key)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)

  try {
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(8_000),
      next: { revalidate: 0 },
    })
    if (res.status === 401) { console.error("[OddsAPI] Invalid key"); return null }
    if (res.status === 429) { console.error("[OddsAPI] Quota exhausted"); return null }
    if (!res.ok) return null
    return await res.json() as T
  } catch {
    return null
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OddsOutcome {
  name: string   // "Home" | "Draw" | "Away" | "Over" | "Under"
  price: number  // decimal odds
  point?: number // para O/U y hándicap
}

export interface OddsMarket {
  key: string          // "h2h" | "totals" | "spreads"
  last_update: string
  outcomes: OddsOutcome[]
}

export interface OddsBookmaker {
  key: string
  title: string
  markets: OddsMarket[]
}

export interface OddsEvent {
  id: string           // The Odds API event ID
  commence_time: string // ISO
  home_team: string
  away_team: string
  bookmakers: OddsBookmaker[]
}

// ─── Parsed odds (normalizado para uso interno) ───────────────────────────────

export interface MatchOdds {
  eventId: string
  homeTeam: string
  awayTeam: string
  kickoffISO: string
  bookmaker: string    // fuente de las cuotas
  // 1X2
  home:  number | null
  draw:  number | null
  away:  number | null
  // Over/Under 2.5
  over25:  number | null
  under25: number | null
  // Probabilidades implícitas (sin margen de la casa)
  impliedHome:  number | null  // 0-1
  impliedDraw:  number | null
  impliedAway:  number | null
  impliedOver25: number | null
  source: "the-odds-api"
  fetchedAt: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Elimina el margen de la casa (overround) y normaliza a probabilidades reales */
function removeMargin(odds: number[]): number[] {
  const overround = odds.reduce((s, o) => s + 1 / o, 0)
  return odds.map((o) => (1 / o) / overround)
}

function findOutcome(outcomes: OddsOutcome[], name: string): number | null {
  return outcomes.find((o) => o.name.toLowerCase().includes(name.toLowerCase()))?.price ?? null
}

function findTotalOutcome(outcomes: OddsOutcome[], name: string, point: number): number | null {
  return outcomes.find((o) =>
    o.name.toLowerCase().includes(name.toLowerCase()) && Math.abs((o.point ?? 0) - point) < 0.01
  )?.price ?? null
}

function parseEvent(event: OddsEvent): MatchOdds | null {
  // Buscar el mejor bookmaker disponible
  let bk: OddsBookmaker | undefined
  for (const preferred of PREFERRED_BOOKMAKERS) {
    bk = event.bookmakers.find((b) => b.key === preferred)
    if (bk) break
  }
  if (!bk && event.bookmakers.length > 0) bk = event.bookmakers[0]
  if (!bk) return null

  const h2h = bk.markets.find((m) => m.key === "h2h")
  const totals = bk.markets.find((m) => m.key === "totals")

  const home  = h2h ? findOutcome(h2h.outcomes, event.home_team) ?? findOutcome(h2h.outcomes, "home") : null
  const draw  = h2h ? findOutcome(h2h.outcomes, "draw") : null
  const away  = h2h ? findOutcome(h2h.outcomes, event.away_team) ?? findOutcome(h2h.outcomes, "away") : null
  const over25  = totals ? findTotalOutcome(totals.outcomes, "over",  2.5) : null
  const under25 = totals ? findTotalOutcome(totals.outcomes, "under", 2.5) : null

  // Probabilidades implícitas sin margen
  let impliedHome = null, impliedDraw = null, impliedAway = null
  if (home && draw && away) {
    const [ih, id, ia] = removeMargin([home, draw, away])
    impliedHome = Math.round(ih * 1000) / 1000
    impliedDraw = Math.round(id * 1000) / 1000
    impliedAway = Math.round(ia * 1000) / 1000
  }

  let impliedOver25 = null
  if (over25 && under25) {
    const [io] = removeMargin([over25, under25])
    impliedOver25 = Math.round(io * 1000) / 1000
  }

  return {
    eventId:    event.id,
    homeTeam:   event.home_team,
    awayTeam:   event.away_team,
    kickoffISO: event.commence_time,
    bookmaker:  bk.title,
    home,  draw,  away,
    over25, under25,
    impliedHome, impliedDraw, impliedAway, impliedOver25,
    source: "the-odds-api",
    fetchedAt: new Date().toISOString(),
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Todas las cuotas del Mundial disponibles ahora mismo */
export async function getWCOdds(): Promise<MatchOdds[]> {
  const CACHE_KEY = "odds:wc:all:v1"
  const TTL = 2 * 3600  // 2h

  const cached = await cacheGet<MatchOdds[]>(CACHE_KEY)
  if (cached) return cached

  const events = await oddsFetch<OddsEvent[]>(`sports/${SPORT}/odds`, {
    regions: "eu,uk",
    markets: "h2h,totals",
    oddsFormat: "decimal",
    bookmakers: PREFERRED_BOOKMAKERS.join(","),
  })

  if (!events || events.length === 0) return []

  const parsed = events
    .map(parseEvent)
    .filter((x): x is MatchOdds => x !== null)

  await cacheSet(CACHE_KEY, parsed, TTL)
  return parsed
}

/**
 * Cuotas de un partido específico, identificado por los nombres de los equipos.
 * The Odds API usa nombres completos ("Spain", "Uruguay") — hacemos fuzzy match.
 */
export async function getMatchOdds(homeCode: string, awayCode: string): Promise<MatchOdds | null> {
  const CACHE_KEY = `odds:wc:match:${homeCode}-${awayCode}`
  const TTL = 2 * 3600

  const cached = await cacheGet<MatchOdds>(CACHE_KEY)
  if (cached) return cached

  const all = await getWCOdds()
  if (all.length === 0) return null

  // Normalizar nombre de equipo para matching
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "")

  // Mapeo de códigos FIFA → nombre en inglés (como aparece en The Odds API)
  const CODE_TO_NAME: Record<string, string[]> = {
    ESP: ["spain"], ARG: ["argentina"], BRA: ["brazil"], FRA: ["france"],
    ENG: ["england"], GER: ["germany"], POR: ["portugal"], NED: ["netherlands"],
    URU: ["uruguay"], MEX: ["mexico"], USA: ["united states", "usa"],
    MAR: ["morocco"], SEN: ["senegal"], CRO: ["croatia"], DEN: ["denmark"],
    BEL: ["belgium"], SUI: ["switzerland"], KOR: ["south korea", "korea"],
    JPN: ["japan"], AUS: ["australia"], CAN: ["canada"], POL: ["poland"],
    TUR: ["turkey"], CZE: ["czech republic", "czechia"], AUT: ["austria"],
    RSA: ["south africa"], NOR: ["norway"], SWE: ["sweden"], COL: ["colombia"],
    CHI: ["chile"], PAR: ["paraguay"], ECU: ["ecuador"], PER: ["peru"],
    IRN: ["iran"], QAT: ["qatar"], KSA: ["saudi arabia"], IRQ: ["iraq"],
    SCO: ["scotland"], WAL: ["wales"], HAI: ["haiti"], BIH: ["bosnia"],
    GHA: ["ghana"], CIV: ["ivory coast", "cote d'ivoire"], TUN: ["tunisia"],
    NZL: ["new zealand"], CRC: ["costa rica"], PAN: ["panama"],
    UZB: ["uzbekistan"], JOR: ["jordan"], ALG: ["algeria"],
  }

  const homeNames = CODE_TO_NAME[homeCode] ?? [norm(homeCode)]
  const awayNames = CODE_TO_NAME[awayCode] ?? [norm(awayCode)]

  const match = all.find((m) => {
    const mHome = norm(m.homeTeam)
    const mAway = norm(m.awayTeam)
    const homeMatch = homeNames.some((n) => mHome.includes(n) || n.includes(mHome))
    const awayMatch = awayNames.some((n) => mAway.includes(n) || n.includes(mAway))
    return homeMatch && awayMatch
  })

  if (match) await cacheSet(CACHE_KEY, match, TTL)
  return match ?? null
}

/** Cuota implícita → probabilidad sin margen de 1 sola cuota (para uso rápido) */
export function oddToImplied(odd: number | null): number | null {
  if (!odd || odd <= 1) return null
  return Math.round((1 / odd) * 1000) / 1000
}
