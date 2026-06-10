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

type ApiFixtureItem = NonNullable<ApiFootballResponse["response"]>[number]

/** Fetch + filtro de fixtures válidos de UNA fecha (1 call, sin throttle). */
async function fetchValidFixtures(date: string, apiKey: string): Promise<ApiFixtureItem[]> {
  const res = await fetch(`${API_BASE}/fixtures?date=${encodeURIComponent(date)}`, {
    method: "GET",
    headers: { "x-apisports-key": apiKey, "Accept": "application/json" },
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`[footballApi] API respondió ${res.status}`)
  const json = (await res.json()) as ApiFootballResponse
  return (json.response ?? []).filter((item) => isMatchValid(item))
}

/** Construye un Fixture enriquecido a partir del item + standings ya cargados. */
function buildEnrichedFixture(
  item: ApiFixtureItem,
  standingsByLeague: Map<string, Map<number, StandingRow>>,
  nowIso: string,
): Fixture {
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
}

/**
 * CRON PATH (multi-fecha optimizado): fixtures de varias fechas EN PARALELO +
 * standings UNA sola vez por liga (dedupe GLOBAL entre fechas). hoy/+1/+2
 * comparten la mayoría de ligas → no re-pedimos sus standings por cada fecha.
 *
 * Coste API: D (fixtures, en paralelo) + L (ligas DISTINTAS en TODAS las fechas).
 * Antes: D + (L por cada fecha) en secuencial. El throttle ≤4/s sigue intacto en
 * standings (un único bucle global), así que se respeta el límite de 300 req/min.
 */
export async function fetchFixturesEnrichedForDates(
  dates: string[],
): Promise<{ date: string; fixtures: Fixture[] }[]> {
  const apiKey = process.env.FOOTBALL_API_KEY
  if (!apiKey) throw new Error("[footballApi] FOOTBALL_API_KEY no está configurada")

  // 1. Fixtures de TODAS las fechas EN PARALELO (1 call/fecha, sin throttle).
  const perDate = await Promise.all(
    dates.map(async (date) => ({ date, valid: await fetchValidFixtures(date, apiKey) })),
  )

  // 2. Unión de ligas distintas (id+temporada) presentes en cualquier fecha.
  const leagueKeys = new Map<string, { id: number; season: number }>()
  for (const { valid } of perDate) {
    for (const item of valid) {
      const id = item.league?.id, season = item.league?.season
      if (id != null && season != null) leagueKeys.set(`${id}:${season}`, { id, season })
    }
  }

  // 3. Standings throttled (≤4/s), UNA vez por liga (no se re-piden por fecha).
  const standingsByLeague = new Map<string, Map<number, StandingRow>>()
  for (const [, { id, season }] of leagueKeys) {
    const map = await fetchStandingsMap(id, season)
    if (map.size) standingsByLeague.set(`${id}`, map)
    await sleep(STANDINGS_THROTTLE_MS)
  }

  // 4. Construir fixtures enriquecidos, agrupados por fecha.
  const nowIso = new Date().toISOString()
  return perDate.map(({ date, valid }) => ({
    date,
    fixtures: valid.map((item) => buildEnrichedFixture(item, standingsByLeague, nowIso)),
  }))
}

/** Compat: enriquecido de UNA fecha (delegado al multi-fecha). */
export async function fetchFixturesEnriched(date: string): Promise<Fixture[]> {
  const [group] = await fetchFixturesEnrichedForDates([date])
  return group?.fixtures ?? []
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

// ─── CUOTAS desde API-Football (/odds) — fuente ÚNICA del motor de predicciones ──
// Mapeo oficial: response[0].bookmakers[].bets[] · bet "Match Winner" → 1X2,
// bet "Goals Over/Under" → Over/Under 2.5. CERO scraping de ESPN, CERO invención.

import type { RealOdds } from "@/lib/engine"

const _norm = (s: string) =>
  (s ?? "").toLowerCase().normalize("NFD")
    .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim()

/**
 * Cuotas 1X2 + Over/Under 2.5 de un fixture, leídas EXCLUSIVAMENTE de API-Football
 * (/odds). Toma el primer bookmaker que tenga cada mercado. Devuelve null si no hay
 * cuota real → el caller DEBE descartar el partido (anti-alucinación).
 */
export async function fetchFixtureOddsAF(fixtureId: number): Promise<RealOdds | null> {
  const apiKey = process.env.FOOTBALL_API_KEY
  if (!apiKey || !Number.isFinite(fixtureId)) return null
  try {
    const res = await fetch(`${API_BASE}/odds?fixture=${fixtureId}`, {
      headers: { "x-apisports-key": apiKey, "Accept": "application/json" }, cache: "no-store",
    })
    if (!res.ok) return null
    const json = await res.json() as any
    const bookmakers = json?.response?.[0]?.bookmakers ?? []
    if (!bookmakers.length) return null

    const dec = (v: any) => { const n = Number(v); return Number.isFinite(n) && n > 1 ? n : undefined }
    let home: number | undefined, draw: number | undefined, away: number | undefined
    let over25: number | undefined, under25: number | undefined, provider: string | undefined

    for (const bk of bookmakers) {
      for (const bet of (bk.bets ?? [])) {
        const name = String(bet.name ?? "").toLowerCase()
        if ((name === "match winner" || name === "1x2") && home == null && away == null) {
          for (const v of (bet.values ?? [])) {
            const val = String(v.value ?? "").toLowerCase(); const o = dec(v.odd)
            if (val === "home" || val === "1") home = o
            else if (val === "draw" || val === "x") draw = o
            else if (val === "away" || val === "2") away = o
          }
          if (home != null || away != null) provider = bk.name
        }
        if (name.includes("over/under") && over25 == null) {
          for (const v of (bet.values ?? [])) {
            const val = String(v.value ?? "").toLowerCase(); const o = dec(v.odd)
            if (val === "over 2.5") over25 = o
            else if (val === "under 2.5") under25 = o
          }
        }
      }
      if (home != null && away != null && over25 != null) break
    }
    if (home == null && away == null) return null
    return { provider: provider ?? "API-Football", home, draw, away, over25, under25 }
  } catch {
    return null
  }
}

/** Resuelve el fixture_id de API-Football casando nombres de equipo + fecha en nuestra tabla `fixtures`. */
export async function resolveFixtureIdByTeams(home: string, away: string, dateISO: string): Promise<number | null> {
  try {
    const sb = createServiceClient()
    const dayStart = `${dateISO}T00:00:00.000Z`, dayEnd = `${dateISO}T23:59:59.999Z`
    const { data } = await sb
      .from("fixtures")
      .select("fixture_id, home_team, away_team")
      .gte("match_date", dayStart).lte("match_date", dayEnd)
    if (!data?.length) return null
    const nh = _norm(home), na = _norm(away)
    const hit = data.find((f: any) => {
      const fh = _norm(f.home_team ?? ""), fa = _norm(f.away_team ?? "")
      const homeMatch = fh && nh && (fh.includes(nh) || nh.includes(fh))
      const awayMatch = fa && na && (fa.includes(na) || na.includes(fa))
      return homeMatch && awayMatch
    })
    return hit?.fixture_id ?? null
  } catch {
    return null
  }
}

// ─── Ingesta del MUNDIAL 2026 a la tabla `fixtures` (la que lee el bot) ─────────
// Trae TODOS los fixtures del Mundial (grupos + eliminatorias) de API-Football
// (/fixtures?league=1&season=YYYY) y los upserta con stats.league_id=1, para que
// getFixturesFromDb(world_cup) los vea. Cura la ceguera del bot ante el Mundial.

const FIFA_WC_LEAGUE = 1

export async function ingestWorldCupFixtures(season = 2026): Promise<{ count: number; error?: string }> {
  const apiKey = process.env.FOOTBALL_API_KEY
  if (!apiKey) return { count: 0, error: "FOOTBALL_API_KEY no configurada" }
  try {
    const res = await fetch(`${API_BASE}/fixtures?league=${FIFA_WC_LEAGUE}&season=${season}`, {
      headers: { "x-apisports-key": apiKey, "Accept": "application/json" }, cache: "no-store",
    })
    if (!res.ok) return { count: 0, error: `API respondió ${res.status}` }
    const json = await res.json() as ApiFootballResponse
    const items = json.response ?? []
    if (!items.length) return { count: 0 }

    const nowIso = new Date().toISOString()
    const rows: Fixture[] = items.map((item: any) => ({
      fixture_id: item.fixture.id,
      home_team:  item.teams?.home?.name ?? null,
      away_team:  item.teams?.away?.name ?? null,
      match_date: item.fixture?.date ?? null,
      status:     item.fixture?.status?.short ?? null,
      league:     item.league?.name ?? "FIFA World Cup",
      stats: {
        referee:     item.fixture?.referee ?? null,
        venue:       item.fixture?.venue?.name ?? null,
        round:       item.league?.round ?? null,
        league_id:   item.league?.id ?? FIFA_WC_LEAGUE,
        league_logo: item.league?.logo ?? null,
        season:      item.league?.season ?? season,
        goals:       { home: item.goals?.home ?? null, away: item.goals?.away ?? null },
        home:        { id: item.teams?.home?.id ?? null, logo: item.teams?.home?.logo ?? null, standing: null },
        away:        { id: item.teams?.away?.id ?? null, logo: item.teams?.away?.logo ?? null, standing: null },
        enriched_at: nowIso,
      } as any,
      updated_at: nowIso,
    }))

    await upsertFixtures(rows, { includeStats: true })
    return { count: rows.length }
  } catch (e) {
    return { count: 0, error: e instanceof Error ? e.message : String(e) }
  }
}

// ─── Convocatorias del Mundial (/players/squads) → tabla wc_squads ─────────────
// Recoge los team_id de los fixtures del Mundial ya ingestados y consulta
// /players/squads?team=ID (throttled). Degrada con gracia: si las listas aún no
// están publicadas, no escribe nada (no inventa jugadores).
export async function syncWorldCupSquads(): Promise<{ teams: number; players: number; error?: string }> {
  const apiKey = process.env.FOOTBALL_API_KEY
  if (!apiKey) return { teams: 0, players: 0, error: "FOOTBALL_API_KEY no configurada" }
  try {
    const sb = createServiceClient()
    const { data } = await sb
      .from("fixtures")
      .select("stats")
      .eq("stats->>league_id", String(FIFA_WC_LEAGUE))
      .limit(300)

    const ids = new Set<number>()
    for (const r of (data ?? [])) {
      const h = (r as any).stats?.home?.id, a = (r as any).stats?.away?.id
      if (h) ids.add(Number(h))
      if (a) ids.add(Number(a))
    }
    if (!ids.size) return { teams: 0, players: 0 }

    let teams = 0, players = 0
    for (const id of ids) {
      try {
        const res = await fetch(`${API_BASE}/players/squads?team=${id}`, {
          headers: { "x-apisports-key": apiKey, "Accept": "application/json" }, cache: "no-store",
        })
        if (!res.ok) { await sleep(STANDINGS_THROTTLE_MS); continue }
        const json = await res.json() as any
        const entry = json?.response?.[0]
        const list = (entry?.players ?? []).map((p: any) => ({
          id: p.id ?? null, name: p.name ?? null, number: p.number ?? null,
          position: p.position ?? null, age: p.age ?? null, photo: p.photo ?? null,
        }))
        if (list.length) {
          await sb.from("wc_squads").upsert({
            team_id: id, team_name: entry?.team?.name ?? null,
            players: list, updated_at: new Date().toISOString(),
          }, { onConflict: "team_id" })
          teams++; players += list.length
        }
        await sleep(STANDINGS_THROTTLE_MS)   // respeta 300 req/min
      } catch { /* best-effort por equipo */ }
    }
    return { teams, players }
  } catch (e) {
    return { teams: 0, players: 0, error: e instanceof Error ? e.message : String(e) }
  }
}

// ─── Cuotas del Mundial → fixtures.stats.odds (alimenta UI Partidos/Combinadas) ─
// Para cada fixture del Mundial en la tabla `fixtures`, trae sus cuotas reales de
// API-Football (/odds) y las MERGE-A en stats.odds (sin pisar standings/goles).
// Así la UI muestra lo mismo que lee el bot.
export async function ingestWorldCupOdds(): Promise<{ scanned: number; withOdds: number; updated: number; errors: number }> {
  const out = { scanned: 0, withOdds: 0, updated: 0, errors: 0 }
  const apiKey = process.env.FOOTBALL_API_KEY
  if (!apiKey) return out
  try {
    const sb = createServiceClient()
    const { data } = await sb
      .from("fixtures")
      .select("fixture_id, stats")
      .ilike("league", "%world cup%")
      .limit(200)
    const rows = data ?? []
    out.scanned = rows.length

    for (const r of rows) {
      const fid = Number((r as any).fixture_id)
      try {
        const odds = await fetchFixtureOddsAF(fid)
        if (!odds) { await sleep(STANDINGS_THROTTLE_MS); continue }
        out.withOdds++
        const stats = { ...((r as any).stats ?? {}), odds: { ...odds, updated_at: new Date().toISOString() } }
        const { error } = await sb.from("fixtures").update({ stats, updated_at: new Date().toISOString() }).eq("fixture_id", fid)
        if (error) out.errors++; else out.updated++
        await sleep(STANDINGS_THROTTLE_MS)   // respeta 300 req/min
      } catch {
        out.errors++
      }
    }
    return out
  } catch {
    return out
  }
}
