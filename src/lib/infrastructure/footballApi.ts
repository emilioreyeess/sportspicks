/**
 * footballApi — caché de fixtures de API-Football (v3.football.api-sports.io).
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Backend-only (service_role). Estrategia read-through:
 *   1. Lee `fixtures` de Supabase para la fecha pedida.
 *   2. Si hay datos frescos (< STALE_TTL), los devuelve sin tocar la API.
 *   3. Si está vacío o desactualizado, hace fetch a API-Football, upsert en BD
 *      y devuelve los datos frescos.
 *
 * Esto reduce drásticamente las llamadas a API-Football (cuota limitada) y
 * acelera el hot path. Degrada con gracia: si la API falla pero hay datos
 * stale en BD, devuelve los stale en vez de romper.
 *
 * Requiere env var: FOOTBALL_API_KEY (nunca NEXT_PUBLIC_).
 */

import { createServiceClient } from "@/lib/supabase/client"
import { isMatchValid } from "@/lib/infrastructure/footballFilter"

const API_BASE = "https://v3.football.api-sports.io"

/** Antigüedad máxima de un fixture cacheado antes de refrescar (6h). */
const FIXTURES_STALE_TTL_MS = 6 * 60 * 60 * 1000

// ── Tipos de dominio ──────────────────────────────────────────────────────────

export interface Fixture {
  fixture_id: number
  home_team:  string | null
  away_team:  string | null
  match_date: string | null   // ISO timestamptz
  status:     string | null
  league:     string | null   // nombre de la competición (API-Football league.name)
  stats:      unknown          // jsonb — forma libre de API-Football
  updated_at: string
}

/** Forma cruda de la respuesta de /fixtures de API-Football que consumimos. */
interface ApiFootballFixture {
  fixture: {
    id: number; date: string
    referee?: string | null
    venue?: { name?: string | null; city?: string | null }
    status: { short: string; long?: string }
  }
  teams:   { home: { id?: number; name: string; logo?: string | null }; away: { id?: number; name: string; logo?: string | null } }
  league?: { id?: number; name?: string | null; type?: string | null; season?: number; round?: string | null; logo?: string | null }
  goals?:  { home: number | null; away: number | null }
  score?:  unknown
  statistics?: unknown
}

interface ApiFootballResponse {
  response: ApiFootballFixture[]
}

/** Fila de clasificación por equipo (de /standings de API-Football). */
export interface StandingRow {
  rank:         number
  points:       number
  form:         string | null   // ej. "WWDLW"
  played:       number
  win:          number
  draw:         number
  lose:         number
  goalsFor:     number
  goalsAgainst: number
  goalsDiff:    number
}

/** Ficha técnica enriquecida que guardamos en fixtures.stats (JSONB). */
export interface FixtureStats {
  referee:     string | null
  venue:       string | null
  round:       string | null
  league_id:   number | null
  league_logo: string | null
  season:      number | null
  goals:       { home: number | null; away: number | null }
  home:        { id: number | null; logo: string | null; standing: StandingRow | null }
  away:        { id: number | null; logo: string | null; standing: StandingRow | null }
  enriched_at: string
}

// ── Lectura cacheada ──────────────────────────────────────────────────────────

/**
 * Devuelve los fixtures de una fecha (YYYY-MM-DD). Read-through:
 * usa la caché de Supabase si está fresca; si no, refresca desde API-Football.
 *
 * @param date  Fecha en formato "YYYY-MM-DD".
 */
export async function getFixtures(date: string): Promise<Fixture[]> {
  const sb = createServiceClient()

  // Ventana [date 00:00, date+1 00:00) en UTC para el filtro por match_date.
  const dayStart = `${date}T00:00:00.000Z`
  const dayEnd   = `${date}T23:59:59.999Z`

  // 1. Intento de lectura desde caché.
  let cached: Fixture[] = []
  try {
    const { data, error } = await sb
      .from("fixtures")
      .select("*")
      .gte("match_date", dayStart)
      .lte("match_date", dayEnd)
      .order("match_date", { ascending: true })
    if (!error && data) cached = data as Fixture[]
  } catch {
    cached = []
  }

  // 2. ¿Está fresca? (todas las filas dentro del TTL)
  const now = Date.now()
  const isFresh =
    cached.length > 0 &&
    cached.every((f) => now - new Date(f.updated_at).getTime() < FIXTURES_STALE_TTL_MS)

  if (isFresh) return cached

  // 3. Refrescar desde API-Football. Si falla, caemos a lo stale (si existe).
  try {
    const fresh = await fetchFixturesFromApi(date)
    if (fresh.length > 0) {
      // includeStats:false → no pisa el stats enriquecido que escribe el cron.
      await upsertFixtures(fresh, { includeStats: false })
      return fresh
    }
  } catch (e) {
    console.warn("[footballApi] fetch falló, usando caché stale:", e instanceof Error ? e.message : e)
  }

  return cached  // stale-but-better-than-nothing (puede ser [])
}

// ── Fetch a API-Football ──────────────────────────────────────────────────────

/**
 * Hace el fetch real a API-Football para una fecha y lo normaliza a `Fixture[]`.
 * Lanza si falta la API key o la respuesta no es OK — el caller decide el fallback.
 */
export async function fetchFixturesFromApi(date: string): Promise<Fixture[]> {
  const apiKey = process.env.FOOTBALL_API_KEY
  if (!apiKey) {
    throw new Error("[footballApi] FOOTBALL_API_KEY no está configurada")
  }

  const url = `${API_BASE}/fixtures?date=${encodeURIComponent(date)}`
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "x-apisports-key": apiKey,
      "Accept": "application/json",
    },
    // Sin caché de fetch de Next: la capa de caché es nuestra tabla `fixtures`.
    cache: "no-store",
  })

  if (!res.ok) {
    throw new Error(`[footballApi] API respondió ${res.status}`)
  }

  const json = (await res.json()) as ApiFootballResponse
  const nowIso = new Date().toISOString()

  // Blindaje: descarta amistosos ANTES de mapear/upsert → nunca tocan la BD.
  const valid = (json.response ?? []).filter((item) => isMatchValid(item))

  return valid.map((item) => ({
    fixture_id: item.fixture.id,
    home_team:  item.teams?.home?.name ?? null,
    away_team:  item.teams?.away?.name ?? null,
    match_date: item.fixture?.date ?? null,
    status:     item.fixture?.status?.short ?? null,
    league:     item.league?.name ?? null,
    stats:      item.statistics ?? null,
    updated_at: nowIso,
  }))
}

// ── Standings (plan Pro) ───────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** Pausa entre llamadas a /standings para no superar 300 req/min (~5/s). 250ms ⇒ ≤4/s. */
const STANDINGS_THROTTLE_MS = 250

interface ApiStandingTeam {
  rank: number
  team: { id: number }
  points: number
  goalsDiff: number
  form: string | null
  all: { played: number; win: number; draw: number; lose: number; goals: { for: number; against: number } }
}

/**
 * Clasificación de una liga+temporada → Map<teamId, StandingRow>.
 * Aplana todos los grupos. Devuelve mapa vacío si falla (best-effort).
 */
export async function fetchStandingsMap(leagueId: number, season: number): Promise<Map<number, StandingRow>> {
  const out = new Map<number, StandingRow>()
  const apiKey = process.env.FOOTBALL_API_KEY
  if (!apiKey) return out

  try {
    const url = `${API_BASE}/standings?league=${leagueId}&season=${season}`
    const res = await fetch(url, {
      method: "GET",
      headers: { "x-apisports-key": apiKey, "Accept": "application/json" },
      cache: "no-store",
    })
    if (!res.ok) return out

    const json = await res.json() as { response?: Array<{ league?: { standings?: ApiStandingTeam[][] } }> }
    const groups = json.response?.[0]?.league?.standings ?? []
    for (const group of groups) {
      for (const t of group) {
        if (!t?.team?.id) continue
        out.set(t.team.id, {
          rank:         t.rank,
          points:       t.points,
          form:         t.form ?? null,
          played:       t.all?.played ?? 0,
          win:          t.all?.win ?? 0,
          draw:         t.all?.draw ?? 0,
          lose:         t.all?.lose ?? 0,
          goalsFor:     t.all?.goals?.for ?? 0,
          goalsAgainst: t.all?.goals?.against ?? 0,
          goalsDiff:    t.goalsDiff ?? 0,
        })
      }
    }
  } catch (e) {
    console.warn(`[footballApi] standings ${leagueId}/${season} falló:`, e instanceof Error ? e.message : e)
  }
  return out
}

/**
 * CRON PATH — fetch enriquecido (plan Pro): fixtures de `date` + standings de
 * cada liga con partidos ese día, mergeados en fixtures.stats (JSONB).
 * Throttle entre llamadas a /standings para respetar 300 req/min.
 *
 * Coste API: 1 (fixtures) + N (ligas distintas con partidos). Muy por debajo
 * del límite diario del plan Pro (7500/día).
 */
export async function fetchFixturesEnriched(date: string): Promise<Fixture[]> {
  const apiKey = process.env.FOOTBALL_API_KEY
  if (!apiKey) throw new Error("[footballApi] FOOTBALL_API_KEY no está configurada")

  // 1. Fixtures del día (con liga, equipos, árbitro, sede, ronda, goles).
  const res = await fetch(`${API_BASE}/fixtures?date=${encodeURIComponent(date)}`, {
    method: "GET",
    headers: { "x-apisports-key": apiKey, "Accept": "application/json" },
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`[footballApi] API respondió ${res.status}`)
  const json = (await res.json()) as ApiFootballResponse
  const valid = (json.response ?? []).filter((item) => isMatchValid(item))

  // 2. Ligas distintas (id + temporada) con partidos hoy → standings.
  const leagueKeys = new Map<string, { id: number; season: number }>()
  for (const item of valid) {
    const id = item.league?.id, season = item.league?.season
    if (id != null && season != null) leagueKeys.set(`${id}:${season}`, { id, season })
  }

  // 3. Fetch de standings throttled (≤4/s) → mapa global por liga.
  const standingsByLeague = new Map<string, Map<number, StandingRow>>()
  for (const [key, { id, season }] of leagueKeys) {
    const map = await fetchStandingsMap(id, season)
    if (map.size) standingsByLeague.set(`${id}`, map)
    await sleep(STANDINGS_THROTTLE_MS)
  }

  // 4. Construir fixtures con stats enriquecido.
  const nowIso = new Date().toISOString()
  return valid.map((item) => {
    const leagueId = item.league?.id ?? null
    const homeId = item.teams?.home?.id ?? null
    const awayId = item.teams?.away?.id ?? null
    const table = leagueId != null ? standingsByLeague.get(`${leagueId}`) : undefined

    const stats: FixtureStats = {
      referee:     item.fixture?.referee ?? null,
      venue:       item.fixture?.venue?.name ?? null,
      round:       item.league?.round ?? null,
      league_id:   leagueId,
      league_logo: item.league?.logo ?? null,
      season:      item.league?.season ?? null,
      goals:       { home: item.goals?.home ?? null, away: item.goals?.away ?? null },
      home:        { id: homeId, logo: item.teams?.home?.logo ?? null, standing: homeId != null ? table?.get(homeId) ?? null : null },
      away:        { id: awayId, logo: item.teams?.away?.logo ?? null, standing: awayId != null ? table?.get(awayId) ?? null : null },
      enriched_at: nowIso,
    }

    return {
      fixture_id: item.fixture.id,
      home_team:  item.teams?.home?.name ?? null,
      away_team:  item.teams?.away?.name ?? null,
      match_date: item.fixture?.date ?? null,
      status:     item.fixture?.status?.short ?? null,
      league:     item.league?.name ?? null,
      stats,
      updated_at: nowIso,
    }
  })
}

// ── Upsert en Supabase ────────────────────────────────────────────────────────

/**
 * Upsert de fixtures por `fixture_id`. Best-effort: un fallo de escritura no
 * impide devolver los datos al caller.
 *
 * `includeStats=false` (read-through ligero) omite la columna `stats` del upsert,
 * de modo que NO pisa el `stats` enriquecido que escribe el cron.
 */
export async function upsertFixtures(
  fixtures: Fixture[],
  opts: { includeStats?: boolean } = {},
): Promise<void> {
  if (fixtures.length === 0) return
  const includeStats = opts.includeStats ?? true
  try {
    const sb = createServiceClient()
    const rows = includeStats
      ? fixtures
      : fixtures.map(({ stats, ...rest }) => rest)   // omite stats → preserva el del cron
    await sb.from("fixtures").upsert(rows, { onConflict: "fixture_id" })
  } catch (e) {
    console.warn("[footballApi] upsert falló:", e instanceof Error ? e.message : e)
  }
}
