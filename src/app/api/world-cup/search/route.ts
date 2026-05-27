/**
 * /api/world-cup/search — Universal WC 2026 stats search.
 *
 * GET /api/world-cup/search?q=<query>&type=team|player|referee|match&group=A
 *
 * Returns unified search results across:
 *   - Teams (name, code, group, ranking, form summary)
 *   - Players (name, team, position — from static squad data)
 *   - Referees (name, nationality, severity)
 *   - Matches (fixture search by team code or date)
 *
 * Data sources: static-data.ts + ESPN form (KV-cached).
 * No Supabase required for basic search.
 */

import { NextRequest } from "next/server"
import { consume, getClientIp, tooManyRequests } from "@/lib/rate-limit"
import {
  getAllTeams,
  getTeamForm,
  getAllFixtures,
  getAllReferees,
  getTeamByCode,
} from "@/lib/world-cup/data-service"
import type { WCGroup } from "@/lib/world-cup/types"

export const runtime = "nodejs"

interface SearchResult {
  type: "team" | "player" | "referee" | "match"
  id: string
  title: string
  subtitle: string
  meta: Record<string, string | number | null>
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req)
  if (!consume(ip, 30, 1)) return tooManyRequests(60)

  const { searchParams } = new URL(req.url)
  const q       = (searchParams.get("q") ?? "").trim().toLowerCase()
  const typeFilter = searchParams.get("type") ?? "all"
  const groupFilter = (searchParams.get("group") ?? "").toUpperCase() as WCGroup | ""

  if (q.length < 2 && !groupFilter) {
    return Response.json({ results: [], query: q, total: 0 })
  }

  const results: SearchResult[] = []

  // ─── Teams ───────────────────────────────────────────────────────────────
  if (typeFilter === "all" || typeFilter === "team") {
    const teamsData = await getAllTeams()
    const teams = groupFilter
      ? teamsData.teams.filter((t) => t.group === groupFilter)
      : teamsData.teams

    for (const team of teams) {
      const matchesQ = !q ||
        team.name.toLowerCase().includes(q) ||
        team.code.toLowerCase().includes(q) ||
        team.shortName.toLowerCase().includes(q)

      if (!matchesQ) continue

      // Try to get form (from cache if available)
      let formStr = "—"
      let goalsForAvg = null as number | null
      try {
        const form = await getTeamForm(team.code)
        if (form) {
          formStr = form.formString
          goalsForAvg = form.goalsForAvg
        }
      } catch { /* form not available — not critical */ }

      results.push({
        type:     "team",
        id:       team.code,
        title:    `${team.flagEmoji} ${team.name}`,
        subtitle: `Grupo ${team.group ?? "—"} · ${team.confederation} · #${team.fifaRanking ?? "?"}`,
        meta: {
          code:         team.code,
          group:        team.group,
          confederation: team.confederation,
          fifaRanking:  team.fifaRanking,
          formString:   formStr,
          goalsForAvg,
        },
      })
      if (results.length >= 48) break
    }
  }

  // ─── Referees ─────────────────────────────────────────────────────────────
  if ((typeFilter === "all" || typeFilter === "referee") && q.length >= 2) {
    const referees = getAllReferees()
    for (const ref of referees) {
      const matchesQ =
        ref.name.toLowerCase().includes(q) ||
        ref.nationality.toLowerCase().includes(q)

      if (!matchesQ) continue
      results.push({
        type:     "referee",
        id:       ref.id,
        title:    ref.name,
        subtitle: `${ref.nationality} · ${ref.severity} · ${ref.cards.yellowPerMatch} amarillas/partido`,
        meta: {
          nationality:  ref.nationality,
          severity:     ref.severity,
          yellowPerMatch: ref.cards.yellowPerMatch,
          redPerMatch:    ref.cards.redPerMatch,
          matches:        ref.internationalMatches,
        },
      })
    }
  }

  // ─── Matches ─────────────────────────────────────────────────────────────
  if (typeFilter === "all" || typeFilter === "match") {
    try {
      const fixtures = await getAllFixtures()
      const now = Date.now()
      const upcoming = fixtures
        .filter((f) => {
          if (f.status === "final") return false
          const homeTeam = getTeamByCode(f.homeCode)
          const awayTeam = getTeamByCode(f.awayCode)
          if (groupFilter && homeTeam?.group !== groupFilter && awayTeam?.group !== groupFilter) return false
          if (!q) return true
          return (
            f.homeCode.toLowerCase().includes(q) ||
            f.awayCode.toLowerCase().includes(q) ||
            homeTeam?.name.toLowerCase().includes(q) ||
            awayTeam?.name.toLowerCase().includes(q)
          )
        })
        .sort((a, b) => new Date(a.kickoffISO).getTime() - new Date(b.kickoffISO).getTime())
        .slice(0, 12)

      for (const fix of upcoming) {
        const homeTeam = getTeamByCode(fix.homeCode)
        const awayTeam = getTeamByCode(fix.awayCode)
        const kickoffDate = new Date(fix.kickoffISO)
        const dateStr = kickoffDate.toLocaleDateString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
        results.push({
          type:     "match",
          id:       fix.matchId,
          title:    `${homeTeam?.flagEmoji ?? ""} ${fix.homeCode} vs ${fix.awayCode} ${awayTeam?.flagEmoji ?? ""}`,
          subtitle: `${fix.stage === "group" ? `Grupo ${fix.group}` : fix.stage} · ${dateStr} · ${fix.venue.city}`,
          meta: {
            matchId:   fix.matchId,
            stage:     fix.stage,
            group:     fix.group,
            homeCode:  fix.homeCode,
            awayCode:  fix.awayCode,
            kickoff:   fix.kickoffISO,
            venue:     fix.venue.city,
          },
        })
      }
    } catch { /* fixtures not available */ }
  }

  // ─── Head-to-Head quick stats ─────────────────────────────────────────────
  // If query looks like "ARG BRA" or "ESP-POR" — compute H2H from form data
  const h2hMatch = q.match(/^([a-z]{3})[^a-z]+([a-z]{3})$/)
  if (h2hMatch && (typeFilter === "all" || typeFilter === "team")) {
    const codeA = h2hMatch[1].toUpperCase()
    const codeB = h2hMatch[2].toUpperCase()
    const [formA, formB] = await Promise.allSettled([
      getTeamForm(codeA),
      getTeamForm(codeB),
    ])
    const fA = formA.status === "fulfilled" ? formA.value : null
    const fB = formB.status === "fulfilled" ? formB.value : null

    if (fA || fB) {
      results.unshift({
        type:     "team",
        id:       `h2h-${codeA}-${codeB}`,
        title:    `🆚 H2H: ${codeA} vs ${codeB}`,
        subtitle: "Comparativa de forma reciente",
        meta: {
          [`${codeA}_form`]:    fA?.formString ?? "—",
          [`${codeA}_gfAvg`]:   fA?.goalsForAvg ?? null,
          [`${codeA}_gaAvg`]:   fA?.goalsAgainstAvg ?? null,
          [`${codeB}_form`]:    fB?.formString ?? "—",
          [`${codeB}_gfAvg`]:   fB?.goalsForAvg ?? null,
          [`${codeB}_gaAvg`]:   fB?.goalsAgainstAvg ?? null,
          source: "espn",
        },
      })
    }
  }

  return Response.json({
    results: results.slice(0, 50),
    query:   q,
    type:    typeFilter,
    group:   groupFilter || null,
    total:   results.length,
    generatedAt: new Date().toISOString(),
  })
}
