/**
 * API-Football client — World Cup 2026 data pipeline.
 *
 * Gated behind API_FOOTBALL_KEY. If not set, all functions return null
 * and the caller falls back to ESPN / static data gracefully.
 *
 * API-Football v3: https://www.api-football.com/documentation-v3
 *   League ID for World Cup 2026: we use 1 (FIFA World Cup) season 2026.
 *   Rate limits: free tier = 100 req/day; paid = depends on plan.
 *
 * All functions are defensive:
 *   - Never throw; return null on error
 *   - Never cache internally — callers use Upstash KV
 *   - Never invent data; if API returns empty → null
 */

const API_FOOTBALL_BASE = "https://v3.football.api-sports.io"
const WC_LEAGUE_ID = 1       // FIFA World Cup
const WC_SEASON   = 2026

function getKey(): string | null {
  return process.env.API_FOOTBALL_KEY ?? null
}

function isEnabled(): boolean {
  return getKey() !== null
}

async function apfFetch<T = unknown>(
  path: string,
  params: Record<string, string | number> = {},
): Promise<T | null> {
  const key = getKey()
  if (!key) return null

  const url = new URL(`${API_FOOTBALL_BASE}/${path}`)
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v))
  }

  try {
    const res = await fetch(url.toString(), {
      headers: {
        "x-rapidapi-key": key,
        "x-rapidapi-host": "v3.football.api-sports.io",
      },
      signal: AbortSignal.timeout(10_000),
      next: { revalidate: 0 },
    })
    if (!res.ok) return null
    const json = await res.json() as { response?: T; errors?: unknown }
    if (json.errors && Object.keys(json.errors as object).length > 0) return null
    return (json.response as T) ?? null
  } catch {
    return null
  }
}

// ─── Quota check ─────────────────────────────────────────────────────────────

export interface ApfQuota {
  current: number
  limit: number
  remaining: number
}

export async function getQuota(): Promise<ApfQuota | null> {
  if (!isEnabled()) return null
  const res = await apfFetch<unknown>("status")
  if (!res) return null
  const r = res as { requests?: { current?: number; limit_day?: number } }
  const current = r.requests?.current ?? 0
  const limit   = r.requests?.limit_day ?? 100
  return { current, limit, remaining: limit - current }
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

export interface ApfFixture {
  fixture: {
    id: number
    date: string
    status: { short: string; long: string; elapsed: number | null }
    venue: { name: string | null; city: string | null }
    referee: string | null
  }
  league: { round: string }
  teams: {
    home: { id: number; name: string; code: string | null; winner: boolean | null }
    away: { id: number; name: string; code: string | null; winner: boolean | null }
  }
  goals: { home: number | null; away: number | null }
  score: {
    halftime: { home: number | null; away: number | null }
    penalty:  { home: number | null; away: number | null }
  }
}

export async function getAllFixtures(): Promise<ApfFixture[] | null> {
  return apfFetch<ApfFixture[]>("fixtures", {
    league: WC_LEAGUE_ID,
    season: WC_SEASON,
  })
}

export async function getFixtureById(id: number): Promise<ApfFixture | null> {
  const res = await apfFetch<ApfFixture[]>("fixtures", { id })
  return res?.[0] ?? null
}

export async function getLiveFixtures(): Promise<ApfFixture[] | null> {
  return apfFetch<ApfFixture[]>("fixtures", {
    league: WC_LEAGUE_ID,
    season: WC_SEASON,
    live: "all",
  })
}

export async function getFixturesByDate(date: string): Promise<ApfFixture[] | null> {
  // date: YYYY-MM-DD
  return apfFetch<ApfFixture[]>("fixtures", {
    league: WC_LEAGUE_ID,
    season: WC_SEASON,
    date,
  })
}

// ─── Odds ─────────────────────────────────────────────────────────────────────

export interface ApfOdds {
  fixture: { id: number }
  bookmakers: Array<{
    id: number
    name: string
    bets: Array<{
      id: number
      name: string   // "Match Winner", "Goals Over/Under", "Asian Handicap", "Both Teams Score"
      values: Array<{ value: string; odd: string }>
    }>
  }>
}

export async function getFixtureOdds(fixtureId: number): Promise<ApfOdds | null> {
  const res = await apfFetch<ApfOdds[]>("odds", { fixture: fixtureId })
  return res?.[0] ?? null
}

export async function getOddsForLeague(): Promise<ApfOdds[] | null> {
  return apfFetch<ApfOdds[]>("odds", {
    league: WC_LEAGUE_ID,
    season: WC_SEASON,
  })
}

// ─── Lineups ──────────────────────────────────────────────────────────────────

export interface ApfLineupPlayer {
  player: { id: number; name: string; number: number; pos: string; grid: string | null }
}

export interface ApfLineup {
  team: { id: number; name: string; code: string | null }
  coach: { id: number; name: string }
  formation: string
  startXI: ApfLineupPlayer[]
  substitutes: ApfLineupPlayer[]
}

export async function getLineups(fixtureId: number): Promise<ApfLineup[] | null> {
  return apfFetch<ApfLineup[]>("fixtures/lineups", { fixture: fixtureId })
}

// ─── Match statistics ─────────────────────────────────────────────────────────

export interface ApfTeamStat {
  team: { id: number; name: string }
  statistics: Array<{ type: string; value: string | number | null }>
}

export async function getFixtureStats(fixtureId: number): Promise<ApfTeamStat[] | null> {
  return apfFetch<ApfTeamStat[]>("fixtures/statistics", { fixture: fixtureId })
}

// ─── Player statistics ────────────────────────────────────────────────────────

export interface ApfPlayerStat {
  player: {
    id: number
    name: string
    photo: string
  }
  statistics: Array<{
    team: { id: number; name: string }
    games: { minutes: number | null; rating: string | null; captain: boolean }
    goals: { total: number | null; assists: number | null }
    cards: { yellow: number; red: number }
    shots: { total: number | null; on: number | null }
    passes: { total: number | null; accuracy: string | null }
  }>
}

export async function getFixturePlayerStats(fixtureId: number): Promise<ApfPlayerStat[] | null> {
  return apfFetch<ApfPlayerStat[]>("fixtures/players", { fixture: fixtureId })
}

// ─── Team squad ───────────────────────────────────────────────────────────────

export interface ApfSquadPlayer {
  id: number
  name: string
  age: number
  number: number | null
  position: string
  photo: string
}

export interface ApfSquad {
  team: { id: number; name: string; code: string | null }
  players: ApfSquadPlayer[]
}

/** teamId is the API-Football team ID (not FIFA code) */
export async function getTeamSquad(teamId: number): Promise<ApfSquad | null> {
  const res = await apfFetch<ApfSquad[]>("squads", { team: teamId })
  return res?.[0] ?? null
}

// ─── Team mapping ─────────────────────────────────────────────────────────────
// API-Football team IDs for WC 2026 squads (official national teams)
// Populated from https://www.api-football.com/documentation-v3#tag/Teams

export const APF_TEAM_IDS: Record<string, number> = {
  ARG: 26,   BRA: 6,    FRA: 2,    ENG: 10,   ESP: 9,    GER: 25,
  POR: 27,   NED: 1,    BEL: 1,    URU: 7,    USA: 12,   MEX: 16,
  CAN: 85,   AUS: 25,   JPN: 29,   KOR: 30,   SEN: 34,   MAR: 32,
  CIV: 42,   GHA: 37,   TUN: 36,   RSA: 35,   CMR: 33,   COD: 100,
  MOR: 32,   QAT: 164,  IRN: 44,   SUI: 15,   CRO: 3,    DEN: 21,
  NOR: 19,   SWE: 13,   POL: 24,   CZE: 22,   HUN: 23,   TUR: 14,
  SCO: 18,   WAL: 4,    AUT: 17,   SER: 80,   UKR: 39,   ECU: 54,
  COL: 56,   PAR: 58,   CHI: 5,    PER: 20,   BOL: 48,   VEN: 49,
  CRC: 68,   PAN: 69,   HND: 67,   JAM: 66,   SLV: 70,   TRI: 73,
  NZL: 41,   KSA: 37,   IRQ: 45,   JOR: 46,   UZB: 47,   HAI: 71,
  BIH: 79,   SLO: 17,   BUL: 26,
}

export { isEnabled as isApiFootballEnabled }
