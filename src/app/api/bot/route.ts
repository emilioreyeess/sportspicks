import Anthropic from "@anthropic-ai/sdk"
import { fetchStandings, classifyMotivation } from "@/lib/engine"
import { consume, getClientIp, tooManyRequests } from "@/lib/rate-limit"

export const runtime = "nodejs"
export const maxDuration = 60

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const LEAGUE_SLUGS: Record<string, string> = {
  "serie a": "ita.1", "laliga": "esp.1", "la liga": "esp.1",
  "premier league": "eng.1", "premier": "eng.1", "bundesliga": "ger.1", "ligue 1": "fra.1",
}

// Mapa rápido de IDs conocidos (atajo). Si un equipo no está, se resuelve dinámicamente.
const TEAM_IDS: Record<string, Record<string, number>> = {
  "ita.1": { atalanta:105, fiorentina:109, inter:110, internazionale:110, juventus:111, napoli:114, milan:103, "ac milan":103, roma:120, "as roma":120, lazio:112, torino:239, bologna:101, genoa:145 },
  "esp.1": { "real madrid":86, barcelona:83, "atletico madrid":1068, sevilla:243, villarreal:102, "athletic club":532, "real sociedad":541, "real betis":244, "rayo vallecano":728, girona:9812, getafe:3842, "alaves":3833 },
  "eng.1": { "manchester city":382, liverpool:364, arsenal:359, chelsea:363, "manchester united":360, "tottenham":367, "newcastle":361, "aston villa":1094, "west ham":371, brighton:331, "crystal palace":384 },
  "ger.1": { "bayern munich":132, "bayer leverkusen":131, "borussia dortmund":124, "rb leipzig":11420, "eintracht frankfurt":126, "union berlin":10768 },
  "fra.1": { psg:160, marseille:516, lyon:519, lille:514, monaco:517, nice:518 },
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

// ─── Resolución dinámica de equipos (funciona para CUALQUIER equipo) ───────────

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

async function resolveTeam(name: string, slug: string): Promise<{ id: string; name: string } | null> {
  const stat = findTeamIdStatic(name, slug)
  if (stat) return { id: String(stat), name }
  const teams = await leagueTeams(slug)
  const n = norm(name)
  if (!n) return null
  const hit =
    teams.find(t => norm(t.name) === n) ??
    teams.find(t => norm(t.name).includes(n) || n.includes(norm(t.name))) ??
    teams.find(t => { const tn = norm(t.name); return tn.length > 4 && n.length > 4 && tn.slice(0, 5) === n.slice(0, 5) })
  return hit ?? null
}

function slugOf(league: string): string {
  return LEAGUE_SLUGS[(league ?? "").toLowerCase().trim()] ?? "esp.1"
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
  const slug = slugOf(league)
  const team = await resolveTeam(teamName, slug)
  if (!team) return `No encontré "${teamName}" en ${league}. Revisa el nombre o la liga.`

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
  const slug = slugOf(league)
  const t1 = await resolveTeam(team1, slug)
  if (!t1) return `No encontré "${team1}" en ${league}.`
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
    name: "get_standings",
    description: "Clasificación REAL de la liga con puntos, partidos jugados/restantes y contexto de motivación (campeón, descenso, Europa). Llama SIEMPRE antes de analizar un partido.",
    input_schema: { type: "object" as const, properties: { league: { type: "string", description: "'Serie A', 'LaLiga', 'Premier League', 'Bundesliga', 'Ligue 1'" } }, required: ["league"] },
  },
  {
    name: "get_recent_form",
    description: "Últimos 8 partidos reales de un equipo con goles, BTTS%, Over2.5% y porterías a cero. Llama para CADA equipo del partido.",
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

const SYSTEM_PROMPT = `Eres PicksBot, analista de apuestas deportivas cuantitativo con acceso a datos REALES de ESPN.

═══════════════════════════════════
REGLA Nº1 — CERO INVENCIÓN
═══════════════════════════════════
PROHIBIDO inventar estadísticas, posiciones, cuotas, árbitros, lesiones, alineaciones o xG.
TODO dato debe venir de las herramientas. Si una herramienta no devuelve un dato:
→ di "ese dato no está disponible" y baja la confianza. NUNCA lo rellenes inventando.

═══════════════════════════════════
PROTOCOLO OBLIGATORIO (ANTES DE RESPONDER)
═══════════════════════════════════
Cuando el usuario mencione un partido o equipo, ejecuta estas herramientas:
1. get_standings(liga) → posición real, puntos y contexto de motivación
2. get_recent_form(equipo_local, liga) → forma, goles, BTTS%, Over2.5%
3. get_recent_form(equipo_visitante, liga) → ídem visitante
4. get_h2h(e1, e2, liga) → historial directo
5. get_match_info(e1, e2, liga) → fecha, hora, estadio
6. get_referee_info(e1, e2, liga) → árbitro (si ESPN lo ha publicado)

Nunca des estadísticas sin ejecutar las herramientas primero.

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

export async function POST(req: Request) {
  // Rate limit por IP — protege la API key de Anthropic (cuesta dinero por petición)
  // Ráfaga 3 simultáneas · ritmo 10 / 5 min (~2/min sostenido)
  const ip = getClientIp(req)
  if (!consume(`bot:${ip}`, 3, 2)) return tooManyRequests(60)

  try {
    const formData = await req.formData()
    const message = formData.get("message") as string
    const historyRaw = formData.get("history") as string
    const image = formData.get("image") as File | null
    const history = historyRaw ? JSON.parse(historyRaw) : []

    const userContent: ContentBlock[] = []
    if (image) {
      const arrayBuffer = await image.arrayBuffer()
      const base64 = Buffer.from(arrayBuffer).toString("base64")
      userContent.push({ type: "image", source: { type: "base64", media_type: image.type || "image/jpeg", data: base64 } } as any)
    }
    if (message) userContent.push({ type: "text", text: message })
    if (!userContent.length) return new Response("No content", { status: 400 })

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
              system: SYSTEM_PROMPT,
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
