import { NextRequest } from "next/server"
import { consume, getClientIp, tooManyRequests } from "@/lib/rate-limit"

const LEAGUES = [
  // Grandes ligas europeas
  { slug: "esp.1",          name: "LaLiga",               flag: "🇪🇸", country: "España" },
  { slug: "eng.1",          name: "Premier League",       flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", country: "Inglaterra" },
  { slug: "ger.1",          name: "Bundesliga",           flag: "🇩🇪", country: "Alemania" },
  { slug: "ita.1",          name: "Serie A",              flag: "🇮🇹", country: "Italia" },
  { slug: "fra.1",          name: "Ligue 1",              flag: "🇫🇷", country: "Francia" },
  { slug: "por.1",          name: "Primeira Liga",        flag: "🇵🇹", country: "Portugal" },
  { slug: "ned.1",          name: "Eredivisie",           flag: "🇳🇱", country: "Países Bajos" },
  { slug: "tur.1",          name: "Süper Lig",            flag: "🇹🇷", country: "Turquía" },
  { slug: "sco.1",          name: "Scottish Premiership", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", country: "Escocia" },
  // Competiciones europeas
  { slug: "uefa.champions", name: "Champions League",     flag: "🏆", country: "Europa" },
  { slug: "uefa.europa",    name: "Europa League",        flag: "🏅", country: "Europa" },
  // Américas
  { slug: "usa.1",          name: "MLS",                  flag: "🇺🇸", country: "EE.UU." },
  { slug: "arg.1",          name: "Liga Argentina",       flag: "🇦🇷", country: "Argentina" },
  { slug: "bra.1",          name: "Brasileirão",          flag: "🇧🇷", country: "Brasil" },
  { slug: "mex.1",          name: "Liga MX",              flag: "🇲🇽", country: "México" },
  { slug: "col.1",          name: "Liga BetPlay",         flag: "🇨🇴", country: "Colombia" },
  { slug: "chi.1",          name: "Primera División",     flag: "🇨🇱", country: "Chile" },
  // Medio Oriente & Asia
  { slug: "sau.1",          name: "Saudi Pro League",     flag: "🇸🇦", country: "Arabia Saudí" },
  { slug: "jpn.1",          name: "J1 League",            flag: "🇯🇵", country: "Japón" },
]

// Aliases comunes que se normalizan antes de buscar
const TEAM_ALIASES: Record<string, string> = {
  barca: "barcelona", barça: "barcelona",
  atletico: "atletico madrid", atleti: "atletico madrid",
  "man city": "manchester city", mcfc: "manchester city",
  "man utd": "manchester united", "man united": "manchester united",
  spurs: "tottenham hotspur",
  boca: "boca juniors",
  river: "river plate",
  mengao: "flamengo",
  inter: "inter",
  "inter miami": "inter miami cf",
  "al nassr": "al nassr",
  ajax: "ajax",
  psv: "psv eindhoven",
  benfica: "benfica",
  sporting: "sporting cp",
  celtic: "celtic",
  rangers: "rangers",
  galatasaray: "galatasaray",
  fenerbahce: "fenerbahce",
}

function norm(s: string): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, "").trim()
}

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
      shortName: t.team.shortDisplayName ?? t.team.displayName,
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
  const ip = getClientIp(req)
  if (!consume(`search:${ip}`, 20, 4)) return tooManyRequests(60)

  const raw = (req.nextUrl.searchParams.get("q") ?? "").trim()
  if (!raw || raw.length < 2) return Response.json({ teams: [] })
  if (raw.length > 100) return Response.json({ teams: [] })

  // Aplicar alias antes de buscar
  const q = TEAM_ALIASES[norm(raw)] ?? raw.toLowerCase()

  const results = await Promise.all(
    LEAGUES.map((l) => fetchLeagueTeams(l.slug, l.name, l.flag, l.country))
  )

  const allTeams = results.flat()

  // Scoring de relevancia: nombre exacto > contiene > empieza por
  const scored = allTeams
    .map((t) => {
      const tn = norm(t.name)
      const sn = norm(t.shortName)
      const qn = norm(q)
      if (tn === qn || sn === qn) return { ...t, score: 3 }
      if (tn.startsWith(qn) || sn.startsWith(qn)) return { ...t, score: 2 }
      if (tn.includes(qn) || sn.includes(qn)) return { ...t, score: 1 }
      return null
    })
    .filter(Boolean) as any[]

  scored.sort((a, b) => b.score - a.score)

  return Response.json({ teams: scored.slice(0, 10) })
}
