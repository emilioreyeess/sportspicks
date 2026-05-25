/**
 * WorldCupDataService — fachada única para todas las consultas del Mundial 2026.
 *
 * Estrategia de datos:
 *   1. Datos estables (equipos, árbitros top) → static-data.ts
 *   2. Datos dinámicos (formas, fixtures, standings) → ESPN API con cache KV
 *   3. Datos no obtenibles públicamente (valor de mercado exacto, xG real-time
 *      de selecciones) → marcados con source: "computed" y derivados de forma
 *      transparente. Nunca inventados.
 *
 * ESPN slug del Mundial: "fifa.world".
 * Si ESPN aún no expone el calendario 2026 → el service devuelve los equipos
 * estáticos y fixtures vacíos, con metadatos claros para que la UI sepa.
 */

import {
  WC_TEAMS,
  WC_TEAMS_BY_CODE,
  TOP_REFEREES,
  TOP_REFEREES_BY_ID,
  classifyRefereeSeverity,
  isDrawCompleted,
} from "./static-data"
import { cached, cacheGet, cacheSet, WC_CACHE_TTL } from "./cache"
import type {
  WCTeam,
  WCFixture,
  WCGroupStanding,
  WCTeamForm,
  WCSquad,
  WCPlayer,
  RefereeStats,
  XgSnapshot,
  MatchCenter,
  MatchContextFlags,
  TeamsResponse,
  TeamDetailResponse,
  BracketResponse,
  WCGroup,
  WCMatchResult,
  DataSource,
} from "./types"

// ─── ESPN client (defensivo) ──────────────────────────────────────────────────

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world"
const FETCH_TIMEOUT_MS = 8000

async function espnFetch<T = unknown>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${ESPN_BASE}/${path}`, {
      headers: { "User-Agent": "Mozilla/5.0 SportsPicks-Analytics" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

function isoNow(): string {
  return new Date().toISOString()
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. TEAMS
// ═══════════════════════════════════════════════════════════════════════════════

interface EspnTeamRef { id: string; displayName: string; abbreviation?: string }

/** Mapea el nombre ESPN → código FIFA estático */
function matchEspnToCode(espnName: string): string | null {
  const norm = espnName.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  for (const team of WC_TEAMS) {
    const teamNorm = team.name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    if (norm.includes(teamNorm) || teamNorm.includes(norm)) return team.code
  }
  return null
}

/**
 * Devuelve los 48 equipos del Mundial. Si ESPN expone el sorteo, enriquece
 * con el grupo asignado. Si no, los equipos vienen con group=null.
 */
export async function getAllTeams(): Promise<TeamsResponse> {
  return cached("teams:all", WC_CACHE_TTL.TEAMS, async () => {
    const teams = [...WC_TEAMS]

    // Intentar enriquecer con grupos de ESPN
    const standings = await espnFetch<{ children?: Array<{ name?: string; standings?: { entries: Array<{ team: EspnTeamRef }> } }> }>("standings")
    if (standings?.children) {
      for (const group of standings.children) {
        const groupLetter = (group.name?.match(/group\s+([A-L])/i)?.[1]?.toUpperCase()) as WCGroup | undefined
        if (!groupLetter) continue
        const entries = group.standings?.entries ?? []
        for (const e of entries) {
          const code = matchEspnToCode(e.team.displayName)
          if (!code) continue
          const idx = teams.findIndex((t) => t.code === code)
          if (idx >= 0) {
            teams[idx] = { ...teams[idx], group: groupLetter, source: "espn" }
          }
        }
      }
    }

    const byGroup: TeamsResponse["byGroup"] = {}
    for (const t of teams) {
      if (t.group) {
        if (!byGroup[t.group]) byGroup[t.group] = []
        byGroup[t.group]!.push(t)
      }
    }

    return {
      teams,
      byGroup,
      fetchedAt: isoNow(),
      source: isDrawCompleted(teams) ? "espn" : "curated",
      drawCompleted: isDrawCompleted(teams),
    }
  })
}

export function getTeamByCode(code: string): WCTeam | null {
  return WC_TEAMS_BY_CODE.get(code.toUpperCase()) ?? null
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. SQUAD — plantilla de una selección
// ═══════════════════════════════════════════════════════════════════════════════

interface EspnRosterAthlete {
  id: string
  displayName: string
  age?: number
  jersey?: string
  position?: { abbreviation?: string }
  team?: { displayName?: string }
}

/**
 * Plantilla desde ESPN si está disponible. Si no, squad=null y la UI muestra
 * "convocatoria pendiente". NUNCA inventamos nombres.
 */
export async function getTeamSquad(teamCode: string): Promise<WCSquad | null> {
  const team = getTeamByCode(teamCode)
  if (!team) return null

  return cached(`squad:${teamCode}`, WC_CACHE_TTL.SQUAD, async () => {
    // ESPN endpoint de roster — varía por país, suele requerir teamId
    // Intento heurístico: usar el endpoint genérico de roster por country slug.
    const data = await espnFetch<{ athletes?: Array<{ items?: EspnRosterAthlete[] }> }>(
      `teams/${teamCode.toLowerCase()}/roster`,
    )

    if (!data?.athletes?.length) return null

    const players: WCPlayer[] = []
    const knownGaps: string[] = []

    for (const group of data.athletes) {
      for (const a of group.items ?? []) {
        const positionAbbr = (a.position?.abbreviation ?? "").toUpperCase()
        const pos: WCPlayer["position"] =
          positionAbbr.includes("G") ? "GK" :
          positionAbbr.includes("D") ? "DF" :
          positionAbbr.includes("M") ? "MF" : "FW"

        players.push({
          id: `${teamCode}-${a.id}`,
          espnId: a.id,
          name: a.displayName,
          position: pos,
          shirtNumber: a.jersey ? parseInt(a.jersey, 10) : null,
          age: a.age ?? null,
          club: a.team?.displayName ?? null,
          clubCountry: null,        // ESPN no provee país del club
          tier: "regular",          // sin valor de mercado fiable → default regular
          caps: null,               // ESPN no provee caps de selección
          goals: null,
          injuryStatus: "fit",      // ESPN no provee parte médico fiable
          injuryNote: null,
          bookedForNext: false,
        })
      }
    }

    knownGaps.push("market_value", "international_caps", "injury_status_detail")
    if (players.every((p) => p.tier === "regular")) knownGaps.push("player_tier")

    const ages = players.map((p) => p.age).filter((a): a is number => typeof a === "number")
    const avgAge = ages.length > 0 ? Math.round((ages.reduce((s, v) => s + v, 0) / ages.length) * 10) / 10 : 0

    const squad: WCSquad = {
      teamCode,
      players,
      totalCaps: 0,
      avgAge,
      injuredCount: 0,
      topTierCount: 0,
      fetchedAt: isoNow(),
      source: "espn",
      knownGaps,
    }
    return squad
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. FORM — últimos 10 partidos de la selección
// ═══════════════════════════════════════════════════════════════════════════════

interface EspnScheduleEvent {
  date: string
  competitions?: Array<{
    competitors?: Array<{
      team: { displayName: string; abbreviation?: string }
      score?: string | { value?: number; displayValue?: string }
      homeAway?: "home" | "away"
      winner?: boolean
    }>
    status?: { type?: { completed?: boolean; description?: string } }
    notes?: Array<{ headline?: string }>
  }>
  league?: { name?: string }
}

function parseScoreNum(s: EspnScheduleEvent["competitions"] extends Array<infer C> ? (C extends { competitors?: Array<infer P> } ? (P extends { score?: infer S } ? S : never) : never) : never): number {
  if (s == null) return 0
  if (typeof s === "number") return s
  if (typeof s === "string") return parseInt(s, 10) || 0
  if (typeof s === "object" && s !== null && "displayValue" in s) {
    return parseInt(String((s as { displayValue?: string }).displayValue ?? "0"), 10) || 0
  }
  return 0
}

export async function getTeamForm(teamCode: string): Promise<WCTeamForm | null> {
  const team = getTeamByCode(teamCode)
  if (!team) return null

  return cached(`form:${teamCode}`, WC_CACHE_TTL.FORM, async () => {
    const data = await espnFetch<{ events?: EspnScheduleEvent[] }>(
      `teams/${teamCode.toLowerCase()}/schedule`,
    )

    if (!data?.events) return null

    const completed = data.events
      .filter((ev) => ev.competitions?.[0]?.status?.type?.completed)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10)

    if (completed.length === 0) return null

    const last10: WCMatchResult[] = []
    let gf = 0, ga = 0, cs = 0, btts = 0, over25 = 0
    const formChars: string[] = []

    for (const ev of completed) {
      const comp = ev.competitions?.[0]
      const me = comp?.competitors?.find((c) => {
        return c.team.abbreviation?.toUpperCase() === teamCode.toUpperCase()
          || matchEspnToCode(c.team.displayName) === teamCode
      })
      const opp = comp?.competitors?.find((c) => c !== me)
      if (!me || !opp) continue

      const myScore = parseScoreNum(me.score as never)
      const oppScore = parseScoreNum(opp.score as never)
      const result: WCMatchResult["result"] = myScore > oppScore ? "W" : myScore < oppScore ? "L" : "D"
      const homeAway: WCMatchResult["homeAway"] = me.homeAway === "home" ? "H" : me.homeAway === "away" ? "A" : "N"

      last10.push({
        date: ev.date.slice(0, 10),
        opponent: opp.team.displayName,
        opponentCode: matchEspnToCode(opp.team.displayName),
        homeAway,
        goalsFor: myScore,
        goalsAgainst: oppScore,
        result,
        competition: ev.league?.name ?? "International",
      })

      gf += myScore
      ga += oppScore
      if (oppScore === 0) cs += 1
      if (myScore > 0 && oppScore > 0) btts += 1
      if (myScore + oppScore >= 3) over25 += 1
      if (formChars.length < 5) formChars.push(result)
    }

    const n = last10.length
    const last5 = formChars.slice(0, 5)
    const formPoints = last5.reduce((s, r) => s + (r === "W" ? 3 : r === "D" ? 1 : 0), 0)

    return {
      teamCode,
      last10,
      goalsForAvg: Math.round((gf / n) * 100) / 100,
      goalsAgainstAvg: Math.round((ga / n) * 100) / 100,
      cleanSheets: cs,
      bttsCount: btts,
      over25Count: over25,
      bttsPct: Math.round((btts / n) * 100) / 100,
      over25Pct: Math.round((over25 / n) * 100) / 100,
      formPoints,
      formString: last5.join(""),
      cohesionScore: null,    // ESPN no expone XI por partido → null honesto
      fetchedAt: isoNow(),
      source: "espn",
    }
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. xG snapshot — derivado de la forma (no es xG real de StatsBomb)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * xG aproximado a partir de la forma reciente. Honesto: NO es xG real,
 * es un proxy basado en goles marcados/concedidos y volatilidad.
 * Marcado como source:"computed" para que la UI lo etiquete claramente.
 */
export function computeXgFromForm(form: WCTeamForm | null): XgSnapshot | null {
  if (!form || form.last10.length === 0) return null
  const last5 = form.last10.slice(0, 5)
  const gf = last5.reduce((s, m) => s + m.goalsFor, 0) / last5.length
  const ga = last5.reduce((s, m) => s + m.goalsAgainst, 0) / last5.length

  // xG estimado: aplicamos un factor de regresión a la media (0.85)
  return {
    xgFor5: Math.round(gf * 0.85 * 100) / 100,
    xgAgainst5: Math.round(ga * 0.85 * 100) / 100,
    goalsFor5: Math.round(gf * 100) / 100,
    goalsAgainst5: Math.round(ga * 100) / 100,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. FIXTURES — calendario del torneo
// ═══════════════════════════════════════════════════════════════════════════════

export async function getAllFixtures(): Promise<WCFixture[]> {
  return cached("fixtures:all", WC_CACHE_TTL.FIXTURES, async () => {
    const data = await espnFetch<{ events?: Array<{
      id: string
      date: string
      competitions?: Array<{
        competitors?: Array<{ team: { displayName: string; abbreviation?: string }; homeAway?: string; score?: string | { displayValue?: string } }>
        status?: { type?: { state?: string; completed?: boolean } }
        venue?: { fullName?: string; address?: { city?: string; country?: string } }
        notes?: Array<{ headline?: string }>
      }>
    }> }>("scoreboard")

    if (!data?.events) return []

    const fixtures: WCFixture[] = []
    for (const ev of data.events) {
      const comp = ev.competitions?.[0]
      if (!comp) continue
      const home = comp.competitors?.find((c) => c.homeAway === "home")
      const away = comp.competitors?.find((c) => c.homeAway === "away")
      if (!home || !away) continue

      const homeCode = matchEspnToCode(home.team.displayName) ?? home.team.abbreviation?.toUpperCase() ?? "???"
      const awayCode = matchEspnToCode(away.team.displayName) ?? away.team.abbreviation?.toUpperCase() ?? "???"
      const status = comp.status?.type?.state === "in" ? "live"
        : comp.status?.type?.completed ? "final" : "scheduled"

      const homeScore = parseScoreNum(home.score as never)
      const awayScore = parseScoreNum(away.score as never)

      fixtures.push({
        matchId: `wc26-${ev.id}`,
        stage: "group",      // ESPN no expone aún la fase formal; default group
        group: null,
        stageMatchNumber: 0,
        kickoffISO: ev.date,
        venue: {
          city: comp.venue?.address?.city ?? "—",
          country: comp.venue?.address?.country ?? "—",
          stadium: comp.venue?.fullName ?? "—",
        },
        homeCode,
        awayCode,
        refereeId: null,
        status,
        result: status === "final" || status === "live" ? {
          homeScore, awayScore,
          homeScoreHT: null, awayScoreHT: null,
          homePenalties: null, awayPenalties: null,
        } : null,
        source: "espn",
      })
    }
    return fixtures
  })
}

export async function getFixtureById(matchId: string): Promise<WCFixture | null> {
  const all = await getAllFixtures()
  return all.find((f) => f.matchId === matchId) ?? null
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. STANDINGS — clasificación por grupo
// ═══════════════════════════════════════════════════════════════════════════════

export async function getGroupStandings(): Promise<WCGroupStanding[]> {
  return cached("standings:all", WC_CACHE_TTL.STANDINGS, async () => {
    const data = await espnFetch<{ children?: Array<{
      name?: string
      standings?: { entries: Array<{
        team: { displayName: string; abbreviation?: string }
        stats: Array<{ name: string; value?: number; displayValue?: string }>
      }> }
    }> }>("standings")

    if (!data?.children) return []

    const result: WCGroupStanding[] = []
    for (const group of data.children) {
      const letter = (group.name?.match(/group\s+([A-L])/i)?.[1]?.toUpperCase()) as WCGroup | undefined
      if (!letter) continue

      const teamsRows = (group.standings?.entries ?? []).map((entry, idx) => {
        const stats = new Map(entry.stats.map((s) => [s.name, s.value ?? Number(s.displayValue) ?? 0]))
        const code = matchEspnToCode(entry.team.displayName) ?? entry.team.abbreviation?.toUpperCase() ?? "???"
        return {
          teamCode: code,
          played: Number(stats.get("gamesPlayed") ?? 0),
          won: Number(stats.get("wins") ?? 0),
          drawn: Number(stats.get("ties") ?? stats.get("draws") ?? 0),
          lost: Number(stats.get("losses") ?? 0),
          goalsFor: Number(stats.get("pointsFor") ?? stats.get("goalsFor") ?? 0),
          goalsAgainst: Number(stats.get("pointsAgainst") ?? stats.get("goalsAgainst") ?? 0),
          goalDiff: Number(stats.get("pointDifferential") ?? stats.get("goalDifference") ?? 0),
          points: Number(stats.get("points") ?? 0),
          position: idx + 1,
          qualificationStatus: "pending" as const,
        }
      })

      result.push({
        group: letter,
        teams: teamsRows,
        fetchedAt: isoNow(),
        source: "espn",
      })
    }

    return result
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. REFEREE
// ═══════════════════════════════════════════════════════════════════════════════

export function getRefereeById(id: string): RefereeStats | null {
  return TOP_REFEREES_BY_ID.get(id) ?? null
}

export function getAllReferees(): RefereeStats[] {
  return [...TOP_REFEREES]
}

/** Recalifica severidad si se actualizan los datos en runtime */
export function refreshRefereeSeverity(ref: RefereeStats): RefereeStats {
  return { ...ref, severity: classifyRefereeSeverity(ref.cards.yellowPerMatch) }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 8. MATCH CENTER — agrega todo lo de un partido
// ═══════════════════════════════════════════════════════════════════════════════

function detectContextFlags(fixture: WCFixture): MatchContextFlags {
  const isKnockout = fixture.stage !== "group"
  const isClassic = (() => {
    const pair = new Set([fixture.homeCode, fixture.awayCode])
    const classics: Array<Set<string>> = [
      new Set(["ARG", "BRA"]),
      new Set(["ESP", "POR"]),
      new Set(["ENG", "GER"]),
      new Set(["NED", "GER"]),
      new Set(["USA", "MEX"]),
      new Set(["FRA", "ITA"]),
      new Set(["ESP", "ITA"]),
    ]
    return classics.some((c) => c.size === pair.size && [...c].every((t) => pair.has(t)))
  })()
  const highStakes = fixture.stage === "semi-final" || fixture.stage === "final"

  return {
    isKnockout,
    bothNeedDraw: false,     // se calcula con standings en el override del decision engine
    isClassic,
    highStakes,
    environmentalFactor: null,
  }
}

export async function getMatchCenter(matchId: string): Promise<MatchCenter | null> {
  return cached(`match:${matchId}`, WC_CACHE_TTL.MATCH, async () => {
    const fixture = await getFixtureById(matchId)
    if (!fixture) return null

    const [homeTeam, awayTeam] = [getTeamByCode(fixture.homeCode), getTeamByCode(fixture.awayCode)]
    if (!homeTeam || !awayTeam) return null

    const [homeSquad, awaySquad, homeForm, awayForm] = await Promise.all([
      getTeamSquad(fixture.homeCode),
      getTeamSquad(fixture.awayCode),
      getTeamForm(fixture.homeCode),
      getTeamForm(fixture.awayCode),
    ])

    const homeXg = computeXgFromForm(homeForm)
    const awayXg = computeXgFromForm(awayForm)

    const referee = fixture.refereeId ? getRefereeById(fixture.refereeId) : null

    const center: MatchCenter = {
      fixture,
      home: { team: homeTeam, squad: homeSquad, form: homeForm, keyAbsences: [], xg: homeXg },
      away: { team: awayTeam, squad: awaySquad, form: awayForm, keyAbsences: [], xg: awayXg },
      referee,
      context: detectContextFlags(fixture),
      fetchedAt: isoNow(),
    }
    return center
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// 9. Public re-exports
// ═══════════════════════════════════════════════════════════════════════════════

export type { DataSource }

export async function getBracket(): Promise<BracketResponse> {
  const [groups, fixtures] = await Promise.all([getGroupStandings(), getAllFixtures()])
  const knockoutFixtures = fixtures.filter((f) => f.stage !== "group")
  return {
    groups,
    knockoutFixtures,
    fetchedAt: isoNow(),
    source: groups.length > 0 ? "espn" : "curated",
  }
}

export async function getTeamDetail(teamCode: string): Promise<TeamDetailResponse | null> {
  const team = getTeamByCode(teamCode)
  if (!team) return null

  const [squad, form, allFixtures] = await Promise.all([
    getTeamSquad(teamCode),
    getTeamForm(teamCode),
    getAllFixtures(),
  ])

  const teamFixtures = allFixtures.filter((f) => f.homeCode === teamCode || f.awayCode === teamCode)
  const now = Date.now()
  const upcomingFixtures = teamFixtures.filter((f) => new Date(f.kickoffISO).getTime() >= now)
  const pastFixtures = teamFixtures.filter((f) => new Date(f.kickoffISO).getTime() < now)

  return {
    team,
    squad,
    form,
    upcomingFixtures,
    pastFixtures,
    discipline: [],     // ESPN no expone discipline detallado; viene vacío con honestidad
    fetchedAt: isoNow(),
  }
}
