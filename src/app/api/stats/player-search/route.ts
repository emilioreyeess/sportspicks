/**
 * GET /api/stats/player-search?q=mbappe
 * Busca jugadores en rosters de equipos top de las principales ligas.
 * Estrategia: busca en paralelo los rosters de los equipos más populares.
 */
import { NextRequest } from "next/server"
import { consume, getClientIp, tooManyRequests } from "@/lib/rate-limit"

export const runtime = "nodejs"
export const revalidate = 3600 // cache 1h

// Top equipos por liga (id ESPN conocidos) para búsqueda rápida
const TOP_TEAMS: { id: string; league: string; leagueSlug: string; flag: string }[] = [
  // LaLiga
  { id: "86",  league: "LaLiga",         leagueSlug: "esp.1", flag: "🇪🇸" },
  { id: "244", league: "LaLiga",         leagueSlug: "esp.1", flag: "🇪🇸" },
  { id: "243", league: "LaLiga",         leagueSlug: "esp.1", flag: "🇪🇸" },
  { id: "533", league: "LaLiga",         leagueSlug: "esp.1", flag: "🇪🇸" },
  // Premier
  { id: "382", league: "Premier League", leagueSlug: "eng.1", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { id: "360", league: "Premier League", leagueSlug: "eng.1", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { id: "364", league: "Premier League", leagueSlug: "eng.1", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { id: "359", league: "Premier League", leagueSlug: "eng.1", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  // Serie A
  { id: "94",  league: "Serie A",        leagueSlug: "ita.1", flag: "🇮🇹" },
  { id: "99",  league: "Serie A",        leagueSlug: "ita.1", flag: "🇮🇹" },
  { id: "97",  league: "Serie A",        leagueSlug: "ita.1", flag: "🇮🇹" },
  // Bundesliga
  { id: "132", league: "Bundesliga",     leagueSlug: "ger.1", flag: "🇩🇪" },
  { id: "131", league: "Bundesliga",     leagueSlug: "ger.1", flag: "🇩🇪" },
  // Ligue 1
  { id: "160", league: "Ligue 1",        leagueSlug: "fra.1", flag: "🇫🇷" },
  { id: "162", league: "Ligue 1",        leagueSlug: "fra.1", flag: "🇫🇷" },
  // Saudi Pro League
  { id: "776", league: "Saudi Pro League", leagueSlug: "sau.1", flag: "🇸🇦" },
  { id: "778", league: "Saudi Pro League", leagueSlug: "sau.1", flag: "🇸🇦" },
  // MLS
  { id: "18429", league: "MLS",          leagueSlug: "usa.1", flag: "🇺🇸" },
  // Argentina
  { id: "228",  league: "Liga Argentina", leagueSlug: "arg.1", flag: "🇦🇷" },
  { id: "235",  league: "Liga Argentina", leagueSlug: "arg.1", flag: "🇦🇷" },
]

function norm(s: string): string {
  return (s || "").toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, "").trim()
}

async function fetchRoster(teamId: string, leagueSlug: string, league: string, flag: string) {
  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueSlug}/teams/${teamId}/roster`,
      { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return []
    const data = await res.json()
    const teamName = data?.team?.displayName ?? "Unknown"
    const athletes: any[] = data?.athletes ?? []
    return athletes.map((a: any) => ({
      id: a.id,
      name: a.displayName,
      shortName: a.shortName ?? a.displayName,
      position: a.position?.displayName ?? a.position?.abbreviation ?? "—",
      positionAbbr: a.position?.abbreviation ?? "—",
      age: a.age ?? null,
      jersey: a.jersey ?? null,
      nationality: a.citizenship ?? a.birthCountry ?? null,
      teamId,
      teamName,
      league,
      leagueSlug,
      flag,
      espnUrl: a.links?.find((l: any) => l.rel?.includes("playercard"))?.href ?? null,
    }))
  } catch {
    return []
  }
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req)
  if (!consume(`player-search:${ip}`, 10, 2)) return tooManyRequests(30)

  const raw = (req.nextUrl.searchParams.get("q") ?? "").trim()
  if (!raw || raw.length < 3) return Response.json({ players: [] })

  const qn = norm(raw)

  // Busca en paralelo en todos los equipos top
  const rosters = await Promise.all(
    TOP_TEAMS.map((t) => fetchRoster(t.id, t.leagueSlug, t.league, t.flag))
  )

  const allPlayers = rosters.flat()

  // Scoring: exacto > empieza por > contiene (nombre completo o apellido)
  const scored = allPlayers
    .map((p) => {
      const fn = norm(p.name)
      const sn = norm(p.shortName)
      if (fn === qn || sn === qn) return { ...p, score: 4 }
      if (fn.startsWith(qn) || sn.startsWith(qn)) return { ...p, score: 3 }
      // Buscar por apellido
      const parts = fn.split(" ")
      if (parts.some((part: string) => part === qn)) return { ...p, score: 3 }
      if (fn.includes(qn) || sn.includes(qn)) return { ...p, score: 2 }
      if (parts.some((part: string) => part.startsWith(qn))) return { ...p, score: 1 }
      return null
    })
    .filter(Boolean) as any[]

  // Dedup por player id, mantener el de mayor score
  const seen = new Map<string, any>()
  for (const p of scored) {
    if (!seen.has(p.id) || seen.get(p.id).score < p.score) seen.set(p.id, p)
  }

  const results = Array.from(seen.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)

  return Response.json({ players: results })
}
