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
  { slug: "eng.2",          name: "Championship",         flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", country: "Inglaterra" },
  { slug: "esp.2",          name: "LaLiga 2",             flag: "🇪🇸", country: "España" },
  { slug: "ger.2",          name: "2. Bundesliga",        flag: "🇩🇪", country: "Alemania" },
  { slug: "ita.2",          name: "Serie B",              flag: "🇮🇹", country: "Italia" },
  { slug: "fra.2",          name: "Ligue 2",              flag: "🇫🇷", country: "Francia" },
  { slug: "bel.1",          name: "Pro League",           flag: "🇧🇪", country: "Bélgica" },
  { slug: "rus.1",          name: "Premier Liga",         flag: "🇷🇺", country: "Rusia" },
  // Competiciones europeas
  { slug: "uefa.champions", name: "Champions League",     flag: "🏆", country: "Europa" },
  { slug: "uefa.europa",    name: "Europa League",        flag: "🏅", country: "Europa" },
  { slug: "uefa.conference",name: "Conference League",    flag: "🥈", country: "Europa" },
  // ── Selecciones nacionales ──────────────────────────────────────────────
  // Slugs ESPN verificados que SÍ devuelven equipos. Los antiguos (FIFA.WC,
  // CONMEBOL.COPA, FIFA.SB, CONCACAF.WC, …) devolvían 0 equipos, por eso solo
  // se encontraban selecciones europeas. Orden = prioridad de dedup: el Mundial
  // primero (foco de la app, se llena en jun-2026); amistosos al final como
  // cobertura amplia (≈175 selecciones de todas las confederaciones).
  { slug: "fifa.world",       name: "Copa del Mundo", flag: "🌍", country: "Internacional" },
  { slug: "UEFA.EURO",        name: "Eurocopa",       flag: "🇪🇺", country: "Europa" },
  { slug: "conmebol.america", name: "Copa América",   flag: "🏆", country: "Sudamérica" },
  { slug: "fifa.friendly",    name: "Selección",      flag: "🤝", country: "Internacional" },
  // Américas
  { slug: "usa.1",          name: "MLS",                  flag: "🇺🇸", country: "EE.UU." },
  { slug: "arg.1",          name: "Liga Argentina",       flag: "🇦🇷", country: "Argentina" },
  { slug: "bra.1",          name: "Brasileirão",          flag: "🇧🇷", country: "Brasil" },
  { slug: "mex.1",          name: "Liga MX",              flag: "🇲🇽", country: "México" },
  { slug: "col.1",          name: "Liga BetPlay",         flag: "🇨🇴", country: "Colombia" },
  { slug: "chi.1",          name: "Primera División",     flag: "🇨🇱", country: "Chile" },
  { slug: "uru.1",          name: "Primera División",     flag: "🇺🇾", country: "Uruguay" },
  { slug: "ecu.1",          name: "LigaPro",              flag: "🇪🇨", country: "Ecuador" },
  { slug: "usa.open",       name: "US Open Cup",          flag: "🇺🇸", country: "EE.UU." },
  // Medio Oriente & Asia
  { slug: "sau.1",          name: "Saudi Pro League",     flag: "🇸🇦", country: "Arabia Saudí" },
  { slug: "jpn.1",          name: "J1 League",            flag: "🇯🇵", country: "Japón" },
  { slug: "chn.1",          name: "Super Liga China",     flag: "🇨🇳", country: "China" },
  { slug: "aus.1",          name: "A-League",             flag: "🇦🇺", country: "Australia" },
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
  // Selecciones nacionales
  spain: "spain", espana: "spain", españa: "spain",
  germany: "germany", alemania: "germany",
  france: "france", francia: "france",
  brazil: "brazil", brasil: "brazil",
  argentina: "argentina",
  england: "england", inglaterra: "england",
  portugal: "portugal",
  italy: "italy", italia: "italy",
  netherlands: "netherlands", holanda: "netherlands",
  usa: "united states", "estados unidos": "united states",
  mexico: "mexico", méxico: "mexico",
  colombia: "colombia",
  chile: "chile",
  uruguay: "uruguay",
  croatia: "croatia", croacia: "croatia",
  morocco: "morocco", marruecos: "morocco",
  japan: "japan", japon: "japan",
  senegal: "senegal",
  ecuador: "ecuador",
  ghana: "ghana",
  cameroon: "cameroon",
  "south korea": "korea republic", corea: "korea republic",
  wales: "wales", gales: "wales",
  iran: "ir iran",
  australia: "australia",
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

  // Dedup por nombre normalizado: una selección aparece en varias competiciones
  // (Mundial, Copa América, amistosos). El sort estable + el orden del array
  // conservan la fuente de mayor prioridad (p.ej. fifa.world sobre fifa.friendly).
  const seen = new Set<string>()
  const deduped = scored.filter((t) => {
    const key = norm(t.name)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return Response.json({ teams: deduped.slice(0, 10) })
}
