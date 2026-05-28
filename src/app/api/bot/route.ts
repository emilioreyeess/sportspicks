import Anthropic from "@anthropic-ai/sdk"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { fetchStandings, classifyMotivation } from "@/lib/engine"
import { consume, getClientIp, tooManyRequests } from "@/lib/rate-limit"
import { getStore } from "@/lib/store"

export const runtime = "nodejs"
export const maxDuration = 60

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ─── Mapa completo de ligas ────────────────────────────────────────────────────

const LEAGUE_SLUGS: Record<string, string> = {
  // Europa top 5
  "serie a": "ita.1", "laliga": "esp.1", "la liga": "esp.1",
  "premier league": "eng.1", "premier": "eng.1", "bundesliga": "ger.1", "ligue 1": "fra.1",
  // Europa resto
  "primeira liga": "por.1", "liga nos": "por.1", "portugal": "por.1",
  "eredivisie": "ned.1", "holanda": "ned.1", "paises bajos": "ned.1",
  "super lig": "tur.1", "superlig": "tur.1", "turquia": "tur.1", "süper lig": "tur.1",
  "scottish premiership": "sco.1", "escocia": "sco.1",
  "jupiler pro league": "bel.1", "belgica": "bel.1", "pro league": "bel.1",
  // Europa competiciones
  "champions league": "uefa.champions", "ucl": "uefa.champions", "champions": "uefa.champions",
  "europa league": "uefa.europa", "uel": "uefa.europa",
  "nations league": "UEFA.NL", "nations": "UEFA.NL", "liga de naciones": "UEFA.NL",
  "euro 2024": "UEFA.EURO", "eurocopa": "UEFA.EURO", "euro": "UEFA.EURO",
  "clasificacion mundial": "FIFA.WC", "eliminatorias mundial": "FIFA.WC",
  "world cup qualifiers": "FIFA.WC", "mundial qualifying": "FIFA.WC",
  "copa america": "CONMEBOL.WC", "eliminatorias conmebol": "CONMEBOL.WC",
  "concacaf nations league": "CONCACAF.NATIONS",
  // Américas
  "mls": "usa.1", "major league soccer": "usa.1", "estados unidos": "usa.1",
  "liga argentina": "arg.1", "primera division": "arg.1", "liga profesional": "arg.1", "argentina": "arg.1",
  "brasileirao": "bra.1", "serie a brasil": "bra.1", "campeonato brasileiro": "bra.1", "brasil": "bra.1",
  "liga mx": "mex.1", "mexico": "mex.1", "liga bbva": "mex.1",
  "liga betplay": "col.1", "colombia": "col.1",
  "primera division chile": "chi.1", "chile": "chi.1",
  "torneo uruguayo": "uru.1", "uruguay": "uru.1",
  // Asia/Oceania
  "j1 league": "jpn.1", "japon": "jpn.1", "japan": "jpn.1",
  // Oriente Medio
  "saudi pro league": "sau.1", "arabia saudi": "sau.1", "saudi": "sau.1",
}

// Slugs disponibles para búsqueda global de equipos
const ALL_BOT_SLUGS = [
  "esp.1", "eng.1", "ger.1", "ita.1", "fra.1",
  "usa.1", "arg.1", "bra.1", "por.1", "uefa.champions",
  "mex.1", "ned.1", "tur.1", "sau.1", "sco.1",
  "col.1", "chi.1", "jpn.1", "bel.1", "uru.1",
  "uefa.europa", "UEFA.NL", "FIFA.WC", "CONCACAF.WC", "CONMEBOL.WC",
]

// Slugs para get_today_matches
const TODAY_SLUGS = [
  "esp.1", "eng.1", "ger.1", "ita.1", "fra.1",
  "usa.1", "arg.1", "bra.1", "por.1", "ned.1",
  "mex.1", "tur.1", "sau.1", "sco.1", "bel.1",
  "col.1", "chi.1", "jpn.1",
  "uefa.champions", "uefa.europa",
  "UEFA.NL", "FIFA.WC", "CONCACAF.WC", "CONMEBOL.WC",
]

// Nombres legibles por slug
const SLUG_NAMES: Record<string, string> = {
  "esp.1": "LaLiga", "eng.1": "Premier League", "ger.1": "Bundesliga",
  "ita.1": "Serie A", "fra.1": "Ligue 1", "usa.1": "MLS",
  "arg.1": "Liga Argentina", "bra.1": "Brasileirão", "por.1": "Primeira Liga",
  "uefa.champions": "Champions League", "mex.1": "Liga MX", "ned.1": "Eredivisie",
  "tur.1": "Süper Lig", "sau.1": "Saudi Pro League", "sco.1": "Scottish Premiership",
  "col.1": "Liga BetPlay", "uefa.europa": "Europa League",
  "bel.1": "Jupiler Pro League", "chi.1": "Primera División Chile",
  "jpn.1": "J1 League", "uru.1": "Torneo Uruguayo",
  "UEFA.NL": "UEFA Nations League", "FIFA.WC": "Clasificación Mundial FIFA",
  "CONCACAF.WC": "Clasificación CONCACAF", "CONMEBOL.WC": "Eliminatorias CONMEBOL",
  "UEFA.EURO": "UEFA Euro", "CONCACAF.NATIONS": "CONCACAF Nations League",
}

// Aliases para apodos y nombres cortos comunes
const TEAM_ALIASES: Record<string, string> = {
  barca: "barcelona", barça: "barcelona",
  atletico: "atletico madrid", atleti: "atletico madrid",
  "man city": "manchester city", mcfc: "manchester city",
  "man utd": "manchester united", "man united": "manchester united", mufc: "manchester united",
  spurs: "tottenham hotspur", tottenham: "tottenham hotspur",
  boca: "boca juniors",
  river: "river plate",
  mengao: "flamengo",
  "las palmas": "las palmas",
  "inter miami": "inter miami cf",
  psv: "psv eindhoven",
  benfica: "sl benfica",
  sporting: "sporting cp",
  celtic: "celtic",
  rangers: "rangers",
  galatasaray: "galatasaray",
  fenerbahce: "fenerbahce",
  "al nassr": "al nassr",
  "al hilal": "al hilal",
  "al ittihad": "al ittihad",
}

// Mapa rápido de IDs para los equipos más populares
const TEAM_IDS: Record<string, Record<string, number>> = {
  "ita.1": { atalanta:105, fiorentina:109, inter:110, internazionale:110, juventus:111, napoli:114, milan:103, "ac milan":103, roma:120, "as roma":120, lazio:112, torino:239, bologna:101, genoa:145 },
  "esp.1": { "real madrid":86, barcelona:83, "atletico madrid":1068, sevilla:243, villarreal:102, "athletic club":532, "real sociedad":541, "real betis":244, "rayo vallecano":728, girona:9812, getafe:3842, "alaves":3833, "las palmas":9815 },
  "eng.1": { "manchester city":382, liverpool:364, arsenal:359, chelsea:363, "manchester united":360, "tottenham hotspur":367, "newcastle":361, "aston villa":1094, "west ham":371, brighton:331, "crystal palace":384 },
  "ger.1": { "bayern munich":132, "bayer leverkusen":131, "borussia dortmund":124, "rb leipzig":11420, "eintracht frankfurt":126, "union berlin":10768 },
  "fra.1": { psg:160, marseille:516, lyon:519, lille:514, monaco:517, nice:518 },
  "arg.1": { "boca juniors":8877, "river plate":8876, "racing club":8878, independiente:8879, "san lorenzo":8880 },
  "bra.1": { flamengo:8573, palmeiras:9906, "sao paulo":8539, santos:8542, corinthians:8540 },
  "sau.1": { "al nassr":20040, "al hilal":20038, "al ittihad":20035, "al ahli":20033 },
  "usa.1": { "inter miami":17012, "la galaxy":12702, "seattle sounders":12997, "new york city":9720, "new england":12701 },
}

function findTeamIdStatic(name: string, slug: string): number | null {
  const map = TEAM_IDS[slug] ?? {}
  const lower = name.toLowerCase()
  const key = Object.keys(map).find(k => lower.includes(k) || k.includes(lower))
  return key ? map[key] : null
}

function norm(s: string): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "")
}

function parseScore(s: any): string {
  if (s == null) return "?"
  if (typeof s === "number") return String(s)
  if (typeof s === "string") return s
  if (typeof s === "object" && s.displayValue) return s.displayValue
  return "?"
}
function parseScoreNum(s: any): number {
  return parseInt(parseScore(s)) || 0
}

async function fetchESPN(path: string) {
  const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${path}`, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`ESPN ${res.status}`)
  return res.json()
}

// ─── Resolución dinámica de equipos — funciona para CUALQUIER liga ─────────────

const teamListCache = new Map<string, { id: string; name: string }[]>()

async function leagueTeams(slug: string): Promise<{ id: string; name: string }[]> {
  if (teamListCache.has(slug)) return teamListCache.get(slug)!
  try {
    const data = await fetchESPN(`${slug}/teams?limit=50`)
    const teams = (data?.sports?.[0]?.leagues?.[0]?.teams ?? [])
      .map((t: any) => ({ id: String(t.team?.id), name: t.team?.displayName ?? "" }))
    teamListCache.set(slug, teams)
    return teams
  } catch { return [] }
}

function applyAlias(name: string): string {
  return TEAM_ALIASES[norm(name)] ?? name
}

async function resolveTeam(name: string, slug: string): Promise<{ id: string; name: string } | null> {
  const resolved = applyAlias(name)
  const stat = findTeamIdStatic(resolved, slug)
  if (stat) return { id: String(stat), name: resolved }
  const teams = await leagueTeams(slug)
  const n = norm(resolved)
  if (!n) return null
  const hit =
    teams.find(t => norm(t.name) === n) ??
    teams.find(t => norm(t.name).includes(n) || n.includes(norm(t.name))) ??
    teams.find(t => { const tn = norm(t.name); return tn.length > 4 && n.length > 4 && tn.slice(0, 5) === n.slice(0, 5) })
  return hit ?? null
}

/** Busca un equipo en TODAS las ligas conocidas — para nombres sin liga especificada */
async function resolveTeamGlobal(name: string): Promise<{ id: string; name: string; slug: string } | null> {
  const resolved = applyAlias(name)
  const n = norm(resolved)
  if (!n) return null

  // Primero revisar TEAM_IDS (más rápido)
  for (const [slug, map] of Object.entries(TEAM_IDS)) {
    const key = Object.keys(map).find(k => n.includes(k.replace(/ /g, "")) || k.replace(/ /g, "").includes(n))
    if (key) return { id: String(map[key]), name: resolved, slug }
  }

  // Búsqueda dinámica en todas las ligas en paralelo
  const results = await Promise.all(
    ALL_BOT_SLUGS.map(async (slug) => {
      const teams = await leagueTeams(slug)
      const hit =
        teams.find(t => norm(t.name) === n) ??
        teams.find(t => norm(t.name).includes(n) || n.includes(norm(t.name))) ??
        teams.find(t => { const tn = norm(t.name); return tn.length > 4 && n.length > 4 && tn.slice(0, 5) === n.slice(0, 5) })
      return hit ? { ...hit, slug } : null
    })
  )
  return results.find(Boolean) ?? null
}

function slugOf(league: string): string {
  const key = (league ?? "").toLowerCase().trim()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
  return LEAGUE_SLUGS[key] ?? key // si el user pasa un slug directamente (ej: "arg.1") también funciona
}

// ─── Implementación de herramientas ────────────────────────────────────────────

async function getStandings(league: string): Promise<string> {
  const slug = slugOf(league)
  const table = await fetchStandings(slug)
  if (!table) return `No pude obtener la clasificación real de ${league} ahora mismo.`

  const lines = table.rows.map(r => {
    const m = classifyMotivation(r.teamId, table)
    return `${r.rank}. ${r.name}: ${r.points} pts | ${r.played} PJ | ${r.gamesRemaining} restantes — ${m.status.split(" — ")[0]}`
  })
  return `Clasificación REAL de ${league} (ESPN):\n${lines.join("\n")}`
}

async function getRecentForm(teamName: string, league: string): Promise<string> {
  let slug = slugOf(league)
  let team = await resolveTeam(teamName, slug)
  // Fallback: búsqueda global si no encontramos en el slug dado
  if (!team) {
    const global = await resolveTeamGlobal(teamName)
    if (global) { team = { id: global.id, name: global.name }; slug = global.slug }
  }
  if (!team) return `No encontré "${teamName}" en ${league}. Prueba con search_team("${teamName}") para localizar la liga correcta.`

  const data = await fetchESPN(`${slug}/teams/${team.id}/schedule`)
  const events: any[] = data?.events ?? []
  const completed = events
    .filter(ev => ev.competitions?.[0]?.status?.type?.completed)
    .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8)

  if (!completed.length) return `Sin partidos recientes para ${team.name}.`

  let btts = 0, over25 = 0, goalsFor = 0, goalsAgainst = 0, cleanSheets = 0
  const rows = completed.map((ev: any) => {
    const comp = ev.competitions[0]
    const home = comp.competitors.find((c: any) => c.homeAway === "home")
    const away = comp.competitors.find((c: any) => c.homeAway === "away")
    const hs = parseScoreNum(home?.score)
    const as_ = parseScoreNum(away?.score)
    const isHome = String(home?.team?.id) === team.id
    const myScore = isHome ? hs : as_
    const oppScore = isHome ? as_ : hs
    const result = myScore > oppScore ? "V" : myScore < oppScore ? "D" : "E"
    const date = new Date(ev.date).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })
    goalsFor += myScore; goalsAgainst += oppScore
    if (myScore > 0 && oppScore > 0) btts++
    if (myScore + oppScore > 2) over25++
    if (oppScore === 0) cleanSheets++
    return `${date} [${result}][${isHome ? "Casa" : "Fuera"}] ${home?.team?.shortDisplayName ?? "?"} ${hs}-${as_} ${away?.team?.shortDisplayName ?? "?"}`
  })

  const n = completed.length
  return `${team.name} — forma reciente (últimos ${n} PJ, datos reales ESPN):
${rows.join("\n")}

📊 Estadísticas de goles:
- Goles a favor: ${goalsFor} (${(goalsFor/n).toFixed(2)}/PJ) | en contra: ${goalsAgainst} (${(goalsAgainst/n).toFixed(2)}/PJ)
- BTTS: ${btts}/${n} (${Math.round(btts/n*100)}%) | Over 2.5: ${over25}/${n} (${Math.round(over25/n*100)}%)
- Portería a cero: ${cleanSheets}/${n} (${Math.round(cleanSheets/n*100)}%)`
}

async function getH2H(team1: string, team2: string, league: string): Promise<string> {
  let slug = slugOf(league)
  let t1 = await resolveTeam(team1, slug)
  if (!t1) {
    const global = await resolveTeamGlobal(team1)
    if (global) { t1 = { id: global.id, name: global.name }; slug = global.slug }
  }
  if (!t1) return `No encontré "${team1}" en ${league}. Prueba search_team("${team1}").`
  const t2 = await resolveTeam(team2, slug)

  const data = await fetchESPN(`${slug}/teams/${t1.id}/schedule`)
  const events: any[] = data?.events ?? []
  const h2h = events
    .filter(ev => {
      const comp = ev.competitions?.[0]
      if (!comp?.status?.type?.completed) return false
      return comp.competitors?.some((c: any) =>
        t2 ? String(c.team?.id) === t2.id
           : norm(c.team?.displayName ?? "").includes(norm(team2)))
    })
    .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5)

  if (!h2h.length) return `No encontré enfrentamientos directos ${team1} vs ${team2} en la temporada actual de ESPN.`

  let t1w = 0, t2w = 0, draws = 0, totalGoals = 0
  const rows = h2h.map((ev: any) => {
    const comp = ev.competitions[0]
    const home = comp.competitors.find((c: any) => c.homeAway === "home")
    const away = comp.competitors.find((c: any) => c.homeAway === "away")
    const hs = parseScoreNum(home?.score), as_ = parseScoreNum(away?.score)
    totalGoals += hs + as_
    const isT1Home = String(home?.team?.id) === t1.id
    const t1Score = isT1Home ? hs : as_
    const t2Score = isT1Home ? as_ : hs
    if (t1Score > t2Score) t1w++; else if (t1Score < t2Score) t2w++; else draws++
    const date = new Date(ev.date).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })
    return `${date}: ${home?.team?.displayName} ${hs}-${as_} ${away?.team?.displayName}`
  })

  return `H2H ${t1.name} vs ${team2} (últimos ${h2h.length} en ESPN):
${rows.join("\n")}

Resumen: ${t1.name} ${t1w}V | ${team2} ${t2w}V | Empates ${draws} · Media goles ${(totalGoals/h2h.length).toFixed(1)}/partido`
}

async function searchTeam(team_name: string): Promise<string> {
  const found = await resolveTeamGlobal(team_name)
  if (!found) {
    return `No encontré "${team_name}" en ninguna liga disponible (ESPN). Revisa el nombre del equipo — puede estar escrito de forma diferente en ESPN.`
  }
  const leagueName = SLUG_NAMES[found.slug] ?? found.slug
  return `"${team_name}" encontrado: ${found.name} en ${leagueName}. Usa "${leagueName}" como parámetro de liga en el resto de herramientas.`
}

async function getRefereeInfo(team1: string, team2: string, league: string): Promise<string> {
  const slug = slugOf(league)
  const sb = await fetchESPN(`${slug}/scoreboard?limit=50`)
  const events: any[] = sb?.events ?? []
  const n1 = norm(team1), n2 = norm(team2)
  const match = events.find(ev => {
    const names = (ev.competitions?.[0]?.competitors ?? []).map((c: any) => norm(c.team?.displayName ?? ""))
    return names.some((x: string) => x.includes(n1) || n1.includes(x)) &&
           names.some((x: string) => x.includes(n2) || n2.includes(x))
  })
  if (!match) return `No encontré ${team1} vs ${team2} en el calendario actual de ${league}.`

  try {
    const summary = await fetchESPN(`${slug}/summary?event=${match.id}`)
    const officials: any[] = summary?.officials ?? summary?.gameInfo?.officials ?? []
    if (!officials.length) {
      return `ESPN aún no ha publicado el árbitro de ${team1} vs ${team2}. No tengo otra fuente fiable, así que NO puedo darte datos del árbitro — no me los inventaré.`
    }
    const list = officials.map((o: any) => `• ${o.position?.displayName ?? "Oficial"}: ${o.displayName}`).join("\n")
    return `🟨 Cuerpo arbitral de ${team1} vs ${team2} (ESPN):
${list}

⚠️ ESPN solo publica los NOMBRES, no estadísticas históricas del árbitro (tarjetas/partido, etc.). No tengo fuente fiable de esas stats — no las inventaré.`
  } catch {
    return `No pude cargar el árbitro del partido. Es posible que aún no esté designado.`
  }
}

/** Devuelve TODOS los partidos de hoy en todas las ligas configuradas — real-time ESPN */
async function getTodayMatches(): Promise<string> {
  const today = new Date()
  const yyyy = today.getUTCFullYear()
  const mm = String(today.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(today.getUTCDate()).padStart(2, "0")
  const yyyymmdd = `${yyyy}${mm}${dd}`
  const todayISO = `${yyyy}-${mm}-${dd}`

  const allMatches: { league: string; home: string; away: string; time: string; status: string; score?: string }[] = []

  await Promise.all(
    TODAY_SLUGS.map(async (slug) => {
      try {
        const res = await fetchESPN(`${slug}/scoreboard?dates=${yyyymmdd}&limit=50`)
        const events: any[] = res?.events ?? []
        for (const ev of events) {
          const comp = ev.competitions?.[0]
          const home = comp?.competitors?.find((c: any) => c.homeAway === "home")
          const away = comp?.competitors?.find((c: any) => c.homeAway === "away")
          if (!home || !away) continue
          const statusType = comp?.status?.type
          const completed = statusType?.completed
          const inProgress = statusType?.state === "in"
          const statusLabel = completed
            ? `✅ Final ${home.score ?? "?"}-${away.score ?? "?"}`
            : inProgress
              ? `🔴 En juego ${home.score ?? "0"}-${away.score ?? "0"} (${comp?.status?.displayClock ?? ""})`
              : `⏰ ${new Date(ev.date).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC`
          allMatches.push({
            league: SLUG_NAMES[slug] ?? slug,
            home: home.team?.displayName ?? "?",
            away: away.team?.displayName ?? "?",
            time: ev.date,
            status: statusLabel,
          })
        }
      } catch { /* ignorar ligas sin datos hoy */ }
    })
  )

  if (!allMatches.length) return `No encontré partidos para hoy (${todayISO}) en ESPN. El servicio puede estar temporalmente caído o no hay partidos programados.`

  // Ordenar por hora
  allMatches.sort((a, b) => a.time.localeCompare(b.time))

  // Agrupar por liga
  const byLeague: Record<string, typeof allMatches> = {}
  for (const m of allMatches) {
    if (!byLeague[m.league]) byLeague[m.league] = []
    byLeague[m.league].push(m)
  }

  const lines = [`📅 Partidos de HOY — ${todayISO} (${allMatches.length} en total, datos en vivo de ESPN):\n`]
  for (const [league, matches] of Object.entries(byLeague)) {
    lines.push(`\n🏆 ${league}`)
    for (const m of matches) {
      lines.push(`  • ${m.home} vs ${m.away} — ${m.status}`)
    }
  }
  lines.push(`\nUsa get_recent_form() y get_h2h() para analizar cualquiera de estos partidos en profundidad.`)
  return lines.join("\n")
}

async function getMatchInfo(team1: string, team2: string, league: string): Promise<string> {
  const slug = slugOf(league)
  const data = await fetchESPN(`${slug}/scoreboard?limit=50`)
  const events: any[] = data?.events ?? []
  const n1 = norm(team1), n2 = norm(team2)
  const match = events.find(ev => {
    const names = (ev.competitions?.[0]?.competitors ?? []).map((c: any) => norm(c.team?.displayName ?? ""))
    return names.some((x: string) => x.includes(n1) || n1.includes(x)) &&
           names.some((x: string) => x.includes(n2) || n2.includes(x))
  })
  if (!match) return `No encontré ${team1} vs ${team2} en el calendario actual de ${league}.`

  const comp = match.competitions[0]
  const home = comp.competitors.find((c: any) => c.homeAway === "home")
  const away = comp.competitors.find((c: any) => c.homeAway === "away")
  const date = new Date(match.date).toLocaleString("es-ES", { weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" })
  const status = comp.status?.type?.completed
    ? `Finalizado ${parseScore(home?.score)}-${parseScore(away?.score)}`
    : (comp.status?.type?.description ?? "Programado")
  const venue = comp.venue ? `${comp.venue.fullName}, ${comp.venue.address?.city ?? ""}` : "Estadio no confirmado"

  return `📅 ${home?.team?.displayName} vs ${away?.team?.displayName}
Estado: ${status}
Fecha/Hora: ${date}
Estadio: ${venue}`
}

// ─── Definición de herramientas ────────────────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: "get_today_matches",
    description: "Obtiene TODOS los partidos de HOY en tiempo real de ESPN (más de 20 ligas). Úsala SIEMPRE cuando el usuario pregunte '¿qué partidos hay hoy?', '¿hay algún partido de X hoy?', o para verificar qué partidos existen antes de analizar. Devuelve liga, equipos, hora y estado actual (programado/en juego/finalizado).",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "search_team",
    description: "Busca un equipo en TODAS las ligas disponibles (LaLiga, Premier, Bundesliga, Serie A, Ligue 1, MLS, Liga Argentina, Brasileirão, Primeira Liga, Liga MX, Eredivisie, Süper Lig, Saudi Pro League, Champions League y más). Úsala SIEMPRE cuando el usuario mencione un equipo sin especificar la liga, o cuando la liga no sea de las 5 grandes europeas.",
    input_schema: { type: "object" as const, properties: { team_name: { type: "string", description: "Nombre del equipo a buscar. Acepta apodos: 'barca', 'atletico', 'river', 'boca', 'flamengo', 'inter miami', 'al nassr', etc." } }, required: ["team_name"] },
  },
  {
    name: "get_standings",
    description: "Clasificación REAL de una liga con puntos, partidos jugados/restantes y contexto de motivación (campeón, descenso, Europa). Llama SIEMPRE antes de analizar un partido. Acepta cualquier liga: 'LaLiga', 'Premier League', 'Bundesliga', 'Serie A', 'Ligue 1', 'MLS', 'Liga Argentina', 'Brasileirão', 'Primeira Liga', 'Liga MX', 'Eredivisie', 'Süper Lig', 'Saudi Pro League', 'Champions League'.",
    input_schema: { type: "object" as const, properties: { league: { type: "string", description: "Nombre de la liga. Si no la conoces, usa search_team primero." } }, required: ["league"] },
  },
  {
    name: "get_recent_form",
    description: "Últimos 8 partidos reales de un equipo con goles, BTTS%, Over2.5% y porterías a cero. Llama para CADA equipo del partido. Funciona con cualquier equipo del mundo si conoces su liga.",
    input_schema: { type: "object" as const, properties: { team_name: { type: "string" }, league: { type: "string" } }, required: ["team_name", "league"] },
  },
  {
    name: "get_h2h",
    description: "Historial real de enfrentamientos directos entre dos equipos con media de goles.",
    input_schema: { type: "object" as const, properties: { team1: { type: "string" }, team2: { type: "string" }, league: { type: "string" } }, required: ["team1", "team2", "league"] },
  },
  {
    name: "get_referee_info",
    description: "Cuerpo arbitral designado para el partido según ESPN (solo nombres, sin stats históricas).",
    input_schema: { type: "object" as const, properties: { team1: { type: "string" }, team2: { type: "string" }, league: { type: "string" } }, required: ["team1", "team2", "league"] },
  },
  {
    name: "get_match_info",
    description: "Fecha, hora, estadio y estado del partido.",
    input_schema: { type: "object" as const, properties: { team1: { type: "string" }, team2: { type: "string" }, league: { type: "string" } }, required: ["team1", "team2", "league"] },
  },
]

async function executeTool(name: string, input: Record<string, string>): Promise<string> {
  try {
    if (name === "get_today_matches") return await getTodayMatches()
    if (name === "search_team")      return await searchTeam(input.team_name)
    if (name === "get_standings")    return await getStandings(input.league)
    if (name === "get_recent_form")  return await getRecentForm(input.team_name, input.league)
    if (name === "get_h2h")          return await getH2H(input.team1, input.team2, input.league)
    if (name === "get_referee_info") return await getRefereeInfo(input.team1, input.team2, input.league)
    if (name === "get_match_info")   return await getMatchInfo(input.team1, input.team2, input.league)
    return "Herramienta no reconocida."
  } catch (e: any) {
    return `Error obteniendo datos reales: ${e.message}. NO inventes el dato — indica que no está disponible.`
  }
}

function buildTodayContext(): string {
  try {
    const store = getStore()
    const today = new Date().toISOString().split("T")[0]

    if (!store.valuePicks?.length && !store.combinadaPool?.length) {
      // Store frío — indícarle al bot que debe usar get_today_matches()
      return `\n═══════════════════════════════════
AVISO — MOTOR EN FRÍO
═══════════════════════════════════
El pipeline de picks aún no ha generado resultados para hoy (${today}).
→ USA get_today_matches() para obtener los partidos de hoy en tiempo real desde ESPN.
→ USA get_recent_form() y get_h2h() para analizar cualquier partido que el usuario pida.
→ NO INVENTES picks del día — usa las herramientas para obtener datos reales.`
    }

    const lines: string[] = [`\n═══════════════════════════════════`, `PICKS DE HOY (${today}) — GENERADOS POR EL MOTOR POISSON`, `═══════════════════════════════════`]

    const valuePicks = (store.valuePicks ?? []).slice(0, 8)
    if (valuePicks.length) {
      lines.push(`\nVALUE PICKS DEL DÍA (${valuePicks.length} picks):`)
      for (const p of valuePicks) {
        // store.valuePicks fields: home_team, away_team, selection, best_odd, value_edge, confidence_tier
        const match = `${p.home_team ?? p.homeName ?? "?"} vs ${p.away_team ?? p.awayName ?? "?"}`
        const sel   = p.selection ?? p.market ?? "?"
        const odds  = p.best_odd != null ? `@ ${p.best_odd}` : ""
        const edge  = p.value_edge != null ? `edge +${Number(p.value_edge).toFixed(1)}%` : ""
        const tier  = p.confidence_tier ?? p.tier ?? ""
        lines.push(`• ${match} → ${sel} ${odds} ${edge}${tier ? ` [${tier}]` : ""}`.trim())
      }
    }

    // combinadaPool is a flat array of PoolEntry (individual selections, not full combinadas)
    const poolSample = (store.combinadaPool ?? []).slice(0, 6)
    if (poolSample.length) {
      lines.push(`\nSELECCIONES EN POOL DE COMBINADAS (${store.combinadaPool.length} total):`)
      for (const c of poolSample) {
        const odds = c.odd != null ? `@ ${c.odd}` : ""
        lines.push(`• ${c.match ?? "?"} → ${c.selection ?? "?"} ${odds} [${c.league ?? ""}]`.trim())
      }
    }

    lines.push(`\nInstrucción: Cuando el usuario pregunte sobre picks del día, partidos de hoy o recomendaciones, usa PRIMERO esta información como contexto. Si el usuario pregunta por un partido específico NO listado aquí, usa las herramientas ESPN para analizarlo.`)

    return lines.join("\n")
  } catch {
    return ""
  }
}

const SYSTEM_PROMPT = `Eres PicksBot, analista de fútbol global con acceso a datos REALES de ESPN para cualquier equipo del mundo.

═══════════════════════════════════
REGLA Nº1 — CERO INVENCIÓN
═══════════════════════════════════
PROHIBIDO inventar estadísticas, posiciones, cuotas, árbitros, lesiones, alineaciones o xG.
TODO dato debe venir de las herramientas. Si una herramienta no devuelve un dato:
→ di "ese dato no está disponible" y baja la confianza. NUNCA lo rellenes inventando.

═══════════════════════════════════
COBERTURA GLOBAL
═══════════════════════════════════
Puedes analizar equipos de CUALQUIER liga disponible en ESPN:
• Europa: LaLiga, Premier League, Bundesliga, Serie A, Ligue 1, Primeira Liga, Eredivisie, Süper Lig, Scottish Premiership
• Competiciones: Champions League, Europa League, UEFA Nations League
• Internacional: Clasificación Mundial FIFA, Copa América, Eliminatorias CONMEBOL/CONCACAF
• Américas: MLS, Liga Argentina, Brasileirão, Liga MX, Liga Colombia, Chile
• Asia: J1 League (Japón)
• Oriente Medio: Saudi Pro League (Al Nassr, Al Hilal, Al Ittihad…)
• Selecciones nacionales: España, Argentina, Brasil, Francia, Alemania, Inglaterra, Uruguay y más

SI el usuario menciona un equipo sin especificar la liga, o la liga no es de las 5 grandes europeas:
→ USA search_team PRIMERO para encontrar en qué liga juega ese equipo.
→ Ejemplos: "Boca Juniors", "River Plate", "Flamengo", "Inter Miami", "Al Nassr", "Ajax", "Benfica",
  "Las Palmas", "Girona", "Celtic", "Galatasaray", "Palmeiras", "Monterrey", etc.

═══════════════════════════════════
PROTOCOLO OBLIGATORIO (ANTES DE RESPONDER)
═══════════════════════════════════
Cuando el usuario mencione un partido o equipo:

PASO 0 — VERIFICAR QUE EL PARTIDO EXISTE HOY:
→ Si preguntan por picks del día, partidos de hoy, o no hay contexto de cuándo es el partido:
   get_today_matches() → lista en tiempo real de todos los partidos de hoy en ESPN.
   Úsala para CONFIRMAR si el partido existe antes de analizarlo.
   NUNCA analices un partido que no aparezca en ESPN — significaría que no se juega hoy.

SI NO CONOCES LA LIGA:
0. search_team(nombre_equipo) → descubre liga y slug

SIEMPRE (con la liga ya conocida):
1. get_standings(liga) → posición real, puntos y contexto de motivación
2. get_recent_form(equipo_local, liga) → forma, goles, BTTS%, Over2.5%
3. get_recent_form(equipo_visitante, liga) → ídem visitante
4. get_h2h(e1, e2, liga) → historial directo
5. get_match_info(e1, e2, liga) → fecha, hora, estadio
6. get_referee_info(e1, e2, liga) → árbitro (si ESPN lo ha publicado)

Nunca des estadísticas sin ejecutar las herramientas primero.
Si el partido no aparece en ESPN, dilo claramente: "No encuentro ese partido para hoy en ESPN. ¿Es posible que se juegue en otra fecha?"

═══════════════════════════════════
MOTOR MULTI-MERCADO — SOLO CON EVIDENCIA REAL
═══════════════════════════════════
GANADOR 1X2: ventaja clara en tabla + forma superior + H2H favorable. EVITA recomendar
  a un equipo ya campeón / descendido / sin objetivos (lo indica get_standings).
BTTS: ambos equipos con BTTS% > 60% reciente y media goleadora > 1.2/PJ. Cita las cifras.
OVER 2.5: media combinada > 3.0 y Over2.5% de ambos > 55%.
UNDER 2.5: ambos con Under > 60% reciente y buenas porterías a cero.
TARJETAS / CORNERS: ESPN no da stats de árbitro ni de córners. Si no hay datos, dilo —
  no recomiendes esos mercados a ciegas.

MOTIVACIÓN: usa get_standings. Un equipo "Campeón confirmado" o "Sin objetivos" puede
rotar y rendir por debajo → baja su valoración aunque sea favorito.

═══════════════════════════════════
FORMATO DE RESPUESTA
═══════════════════════════════════
1. 📊 DATOS REALES OBTENIDOS (tabla, forma, H2H, árbitro, motivación)
2. 🔍 ANÁLISIS POR MERCADO con evidencia numérica (✅ BUENA / ⚠️ ARRIESGADA / ❌ DÉBIL)
3. 🎯 RECOMENDACIÓN (máx. 2 picks, calidad > cantidad)
4. ⚠️ DATOS QUE FALTAN o INCERTIDUMBRES

Idioma: español. Sin promesas de resultados. Apuesta responsable, +18.`

type ContentBlock = { type: string; text?: string; id?: string; name?: string; input?: Record<string, string> }

// ─── Input limits — defensa contra DoS y abuso de API ────────────────────────
const MAX_MESSAGE_LEN = 4000          // 4k chars de mensaje
const MAX_IMAGE_BYTES = 5 * 1024 * 1024  // 5 MB de imagen (Anthropic limit)
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"])
const MAX_HISTORY_ITEMS = 10
const MAX_HISTORY_RAW_BYTES = 50_000  // 50 KB de history

export async function POST(req: Request) {
  // CN-024: Require authenticated session
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401, headers: { "Content-Type": "application/json" } })
  }

  // Rate limit por IP — protege la API key de Anthropic (cuesta dinero por petición)
  // Ráfaga 3 simultáneas · ritmo 10 / 5 min (~2/min sostenido)
  const ip = getClientIp(req)
  if (!consume(`bot:${ip}`, 3, 2)) return tooManyRequests(60)

  try {
    const formData = await req.formData()
    const messageRaw = formData.get("message")
    const historyRawField = formData.get("history")
    const image = formData.get("image") as File | null

    // Validar mensaje
    const message = typeof messageRaw === "string" ? messageRaw.trim() : ""
    if (message.length > MAX_MESSAGE_LEN) {
      return new Response(JSON.stringify({ error: `Mensaje demasiado largo (máx. ${MAX_MESSAGE_LEN} caracteres)` }),
        { status: 413, headers: { "Content-Type": "application/json" } })
    }

    // Validar history (parseo seguro + límites)
    let history: Anthropic.MessageParam[] = []
    if (typeof historyRawField === "string" && historyRawField.length > 0) {
      if (historyRawField.length > MAX_HISTORY_RAW_BYTES) {
        return new Response(JSON.stringify({ error: "Historial demasiado grande" }),
          { status: 413, headers: { "Content-Type": "application/json" } })
      }
      try {
        const parsed = JSON.parse(historyRawField)
        if (Array.isArray(parsed)) {
          history = parsed
            .slice(-MAX_HISTORY_ITEMS)
            .filter((m: any) => m && typeof m === "object" && (m.role === "user" || m.role === "assistant"))
        }
      } catch {
        return new Response(JSON.stringify({ error: "Historial JSON inválido" }),
          { status: 400, headers: { "Content-Type": "application/json" } })
      }
    }

    const userContent: ContentBlock[] = []
    if (image) {
      // Validar imagen: tamaño + tipo MIME
      if (image.size > MAX_IMAGE_BYTES) {
        return new Response(JSON.stringify({ error: `Imagen demasiado grande (máx. ${MAX_IMAGE_BYTES / 1024 / 1024} MB)` }),
          { status: 413, headers: { "Content-Type": "application/json" } })
      }
      const mime = (image.type || "image/jpeg").toLowerCase()
      if (!ALLOWED_IMAGE_TYPES.has(mime)) {
        return new Response(JSON.stringify({ error: "Tipo de imagen no soportado. Usa JPEG, PNG, WebP o GIF." }),
          { status: 415, headers: { "Content-Type": "application/json" } })
      }
      const arrayBuffer = await image.arrayBuffer()
      const base64 = Buffer.from(arrayBuffer).toString("base64")
      userContent.push({ type: "image", source: { type: "base64", media_type: mime, data: base64 } } as any)
    }
    if (message) userContent.push({ type: "text", text: message })
    if (!userContent.length) {
      return new Response(JSON.stringify({ error: "Sin contenido" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      })
    }

    const messages: Anthropic.MessageParam[] = [
      ...history.slice(-10),
      { role: "user", content: userContent as any },
    ]

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        const send = (text: string) =>
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
        try {
          let currentMessages = [...messages]
          let iteration = 0
          while (iteration < 10) {
            iteration++
            const response = await client.messages.create({
              model: "claude-opus-4-5",
              max_tokens: 2500,
              system: SYSTEM_PROMPT + buildTodayContext(),
              tools: TOOLS,
              messages: currentMessages,
            })
            const toolUseBlocks = response.content.filter(b => b.type === "tool_use")
            const textBlocks = response.content.filter(b => b.type === "text")

            if (toolUseBlocks.length === 0) {
              for (const block of textBlocks) {
                if (block.type === "text") send(block.text)
              }
              break
            }
            if (iteration === 1) send("🔍 *Consultando datos reales de ESPN...*\n\n")

            const toolResults: Anthropic.ToolResultBlockParam[] = []
            for (const block of toolUseBlocks) {
              if (block.type !== "tool_use") continue
              const result = await executeTool(block.name, block.input as Record<string, string>)
              toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result })
            }
            currentMessages = [
              ...currentMessages,
              { role: "assistant", content: response.content },
              { role: "user", content: toolResults },
            ]
          }
        } catch (err: any) {
          send(`\n\n❌ Error: ${err.message}`)
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"))
        controller.close()
      },
    })

    return new Response(readable, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    })
  } catch (err) {
    console.error("Bot API error:", err)
    return new Response(JSON.stringify({ error: "Error interno" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    })
  }
}
