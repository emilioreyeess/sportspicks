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

/** Forma cruda mínima de la respuesta de API-Football que consumimos. */
interface ApiFootballFixture {
  fixture: { id: number; date: string; status: { short: string } }
  teams:   { home: { name: string }; away: { name: string } }
  league?: { name?: string | null; type?: string | null }
  statistics?: unknown
}

interface ApiFootballResponse {
  response: ApiFootballFixture[]
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
      await upsertFixtures(fresh)
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

// ── Upsert en Supabase ────────────────────────────────────────────────────────

/**
 * Upsert de fixtures por `fixture_id`. Best-effort: un fallo de escritura no
 * impide devolver los datos al caller.
 */
export async function upsertFixtures(fixtures: Fixture[]): Promise<void> {
  if (fixtures.length === 0) return
  try {
    const sb = createServiceClient()
    await sb.from("fixtures").upsert(fixtures, { onConflict: "fixture_id" })
  } catch (e) {
    console.warn("[footballApi] upsert falló:", e instanceof Error ? e.message : e)
  }
}
