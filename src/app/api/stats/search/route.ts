import { NextRequest } from "next/server"

const LEAGUES = [
  { slug: "esp.1", name: "LaLiga",         flag: "🇪🇸", country: "España" },
  { slug: "eng.1", name: "Premier League", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", country: "Inglaterra" },
  { slug: "ger.1", name: "Bundesliga",     flag: "🇩🇪", country: "Alemania" },
  { slug: "ita.1", name: "Serie A",        flag: "🇮🇹", country: "Italia" },
  { slug: "fra.1", name: "Ligue 1",        flag: "🇫🇷", country: "Francia" },
]

async function fetchLeagueTeams(slug: string, leagueName: string, flag: string, country: string) {
  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/teams?limit=50`,
      { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(6000) }
    )
    if (!res.ok) return []
    const data = await res.json()
    const teams: any[] = data?.sports?.[0]?.leagues?.[0]?.teams ?? []
    return teams.map((t: any) => ({
      id: t.team.id,
      name: t.team.displayName,
      slug,
      league: leagueName,
      flag,
      country,
    }))
  } catch {
    return []
  }
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").toLowerCase().trim()
  if (!q || q.length < 2) return Response.json({ teams: [] })

  const results = await Promise.all(
    LEAGUES.map((l) => fetchLeagueTeams(l.slug, l.name, l.flag, l.country))
  )

  const allTeams = results.flat()
  const filtered = allTeams
    .filter((t) => t.name.toLowerCase().includes(q))
    .slice(0, 8)

  return Response.json({ teams: filtered })
}
