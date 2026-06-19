import Anthropic from "@anthropic-ai/sdk"
import { MODEL_SONNET } from "@/lib/ai-models"
import { getServerSession } from "@/lib/auth-server"
import { consume, getClientIp, tooManyRequests } from "@/lib/rate-limit"
import { getStore } from "@/lib/store"
import { createServiceClient } from "@/lib/supabase/client"
import { getGrantedPlan } from "@/lib/plan-grants"
import type { Fixture, FixtureStats, StandingRow } from "@/lib/infrastructure/footballApi"
import { fetchFixtureOddsAF } from "@/lib/infrastructure/footballApi"
import { WC_TEAMS } from "@/lib/world-cup/static-data"
import { resolveWcCode } from "@/lib/world-cup/name-to-code"

export const runtime = "nodejs"
export const maxDuration = 60

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ─── Helpers ─────────────────────────────────────────────────────────────────

function norm(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
}

const fmtTime = (iso: string | null) => {
  if (!iso) return "--:--"
  try {
    return new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" }).format(new Date(iso))
  } catch { return "--:--" }
}

/** Ficha de un equipo a partir de su fila de clasificación (stats JSONB). */
function teamCard(name: string, st: StandingRow | null): string {
  if (!st) return `${name}: posición/forma no disponibles en la BD`
  const pj = st.played, g = st.win, e = st.draw, p = st.lose
  const form = st.form ? ` · racha ${st.form}` : ""
  return `${name}: ${st.rank}º · ${st.points} pts (${g}G ${e}E ${p}P en ${pj} PJ · ${st.goalsFor}:${st.goalsAgainst})${form}`
}

/**
 * ÚNICA fuente de datos del bot: lectura DIRECTA de la tabla `fixtures` en
 * Supabase (DB-only, sin llamadas a API externas — regla de oro). Devuelve los
 * partidos de hoy con una FICHA TÉCNICA por partido (árbitro, estadio, posición
 * en la tabla y racha de ambos equipos) extraída del JSONB `stats`.
 */
const FIFA_WC_LEAGUE_ID = 1   // FIFA World Cup en API-Football

function ymdMadrid(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Europe/Madrid",
  }).format(d)
}

/**
 * Lee fixtures de NUESTRA base de datos. Por defecto, los de HOY; pero acepta:
 *  - worldCup=true  → filtra por el Mundial (league_id 1) en TODO el calendario
 *    futuro (no solo 24h) — cura la "ceguera" del bot ante el Mundial.
 *  - daysAhead      → amplía la ventana a N días por delante.
 */
async function getFixturesFromDb(
  opts: { teamName?: string; worldCup?: boolean; daysAhead?: number } = {},
): Promise<string> {
  const teamName = opts.teamName
  const worldCup = opts.worldCup === true
  // WC → ventana amplia (todo el calendario). Si no, hoy (o N días si se pide).
  const daysAhead = worldCup ? 400 : Math.max(0, Math.min(opts.daysAhead ?? 0, 400))

  const now = new Date()
  const startDate = ymdMadrid(now)
  const endDate = ymdMadrid(new Date(now.getTime() + daysAhead * 86400000))
  // Para el Mundial, ventana FIJA junio–julio 2026 (los 72 cruces están ahí),
  // independiente de "hoy" → el bot SIEMPRE lee el calendario completo.
  const dayStart = worldCup ? "2026-06-01T00:00:00.000Z" : `${startDate}T00:00:00.000Z`
  const dayEnd   = worldCup ? "2026-07-31T23:59:59.999Z" : `${endDate}T23:59:59.999Z`
  const multiDay = worldCup || daysAhead > 0
  const scopeLabel = worldCup ? "del Mundial 2026" : multiDay ? `de los próximos ${daysAhead} días` : `de hoy (${startDate})`

  let fixtures: Fixture[]
  try {
    const sb = createServiceClient()
    let query = sb
      .from("fixtures")
      .select("*")
      .gte("match_date", dayStart)
      .lte("match_date", dayEnd)
      .order("match_date", { ascending: true })
    // El filtro JSON .eq("stats->>league_id", …) falla en silencio en supabase-js.
    // Filtramos por la columna REAL `league` ("World Cup"), excluyendo la
    // clasificación femenina ("World Cup - Women - Qualification Europe") que
    // contamina la sección del Mundial con partidos de otra competición.
    if (worldCup) query = query.ilike("league", "%world cup%").not("league", "ilike", "%women%").not("league", "ilike", "%qualif%")
    const { data, error } = await query.limit(160)
    if (error) throw new Error(error.message)
    fixtures = (data ?? []) as Fixture[]
    // FILTRO ABSOLUTO Mundial: EXCLUSIVAMENTE league_id=1 + season=2026 (en
    // memoria, a prueba de fallos del operador JSON). Nada de otras competiciones.
    if (worldCup) {
      fixtures = fixtures.filter((f) => {
        const s = (f.stats ?? null) as FixtureStats | null
        return Number(s?.league_id) === 1 && Number(s?.season) === 2026
      })
    }
  } catch {
    return "La base de datos de partidos no está disponible ahora mismo. NO inventes partidos ni datos — indica que no se pudo consultar."
  }

  if (!fixtures.length) {
    return worldCup
      ? "Aún no hay fixtures del Mundial 2026 cargados en la base de datos (el calendario o el sorteo pueden no estar publicados todavía). NO inventes partidos, grupos ni cruces."
      : `No hay partidos registrados en la base de datos ${scopeLabel}. NO inventes partidos.`
  }

  let rows = fixtures
  if (teamName && teamName.trim()) {
    const q = norm(teamName)
    rows = fixtures.filter((f) =>
      norm(f.home_team ?? "").includes(q) || norm(f.away_team ?? "").includes(q),
    )
    if (!rows.length) {
      return `No encontré "${teamName}" en los partidos ${scopeLabel} en la base de datos. NO inventes el partido — puede no estar programado o el nombre no coincide.`
    }
  }

  // Pocos partidos (filtro por equipo) → ficha técnica completa. Listado → línea compacta.
  const detailed = rows.length <= 6

  const blocks = rows.slice(0, 120).map((f) => {
    const league = f.league ?? "Liga desconocida"
    const home = f.home_team ?? "?"
    const away = f.away_team ?? "?"
    const s = (f.stats ?? null) as FixtureStats | null
    const when = multiDay ? `${(f.match_date ?? "").slice(0, 10)} ${fmtTime(f.match_date)}` : fmtTime(f.match_date)

    if (!detailed) {
      return `• [${league}] ${home} vs ${away} — ${when} · ${f.status ?? "?"}`
    }

    const ref = s?.referee ? `Árbitro: ${s.referee}` : "Árbitro: no disponible"
    const venue = s?.venue ? `Estadio: ${s.venue}` : "Estadio: no disponible"
    return [
      `📋 [${league}] ${home} vs ${away}`,
      `   Fecha/hora: ${when} · Estado: ${f.status ?? "?"}`,
      `   ${ref} · ${venue}`,
      `   ${teamCard(home, s?.home?.standing ?? null)}`,
      `   ${teamCard(away, s?.away?.standing ?? null)}`,
    ].join("\n")
  })

  return `📊 Partidos en NUESTRA base de datos oficial ${scopeLabel} — ${rows.length} partido(s).
La LIGA real va entre corchetes; las posiciones y rachas vienen de la clasificación oficial almacenada.
${blocks.join("\n")}

Usa estos datos (liga, posición, racha, fecha, árbitro, estadio) como la verdad oficial. NO uses tu memoria sobre divisiones ni inventes cifras.`
}

// ─── Head-to-Head (API-Football) ──────────────────────────────────────────────

const AF_BASE = "https://v3.football.api-sports.io"

/** Resuelve el team_id (API-Football) de un equipo buscándolo en nuestra tabla fixtures. */
async function resolveTeamId(sb: any, name: string): Promise<{ id: number; label: string } | null> {
  const q = `%${name.trim()}%`
  const asHome = await sb.from("fixtures").select("home_team, stats").ilike("home_team", q).limit(1)
  const h = asHome.data?.[0]
  if (h?.stats?.home?.id) return { id: Number(h.stats.home.id), label: h.home_team }
  const asAway = await sb.from("fixtures").select("away_team, stats").ilike("away_team", q).limit(1)
  const a = asAway.data?.[0]
  if (a?.stats?.away?.id) return { id: Number(a.stats.away.id), label: a.away_team }
  return null
}

/** Detecta si una ronda es ida/vuelta a partir del texto de `round`. */
function legLabel(round: string | null | undefined): string {
  const r = (round ?? "").toLowerCase()
  if (/2nd leg|leg 2|vuelta/.test(r)) return " · VUELTA"
  if (/1st leg|leg 1|ida/.test(r)) return " · IDA"
  return ""
}

/**
 * H2H entre dos equipos: últimos 3 enfrentamientos reales (API-Football) +
 * si el partido de hoy entre ellos es de ida/vuelta (según nuestra DB).
 */
async function getHeadToHead(teamA: string, teamB: string): Promise<string> {
  const apiKey = process.env.FOOTBALL_API_KEY
  if (!apiKey) return "H2H no disponible (config). NO inventes enfrentamientos previos."
  if (!teamA?.trim() || !teamB?.trim()) return "Necesito los dos equipos para el H2H."

  const sb = createServiceClient()
  const [A, B] = await Promise.all([resolveTeamId(sb, teamA), resolveTeamId(sb, teamB)])
  if (!A || !B) {
    return `No pude identificar ${!A ? teamA : teamB} en la base de datos para el H2H. NO inventes enfrentamientos previos.`
  }

  // ¿El partido de HOY entre ellos es de ida/vuelta? (round desde nuestra DB)
  let todayLeg = ""
  try {
    const { data } = await sb
      .from("fixtures")
      .select("home_team, away_team, stats")
      .or(`home_team.ilike.%${teamA.trim()}%,away_team.ilike.%${teamA.trim()}%`)
      .limit(20)
    const match = (data ?? []).find((f: any) =>
      (norm(f.home_team).includes(norm(teamB)) || norm(f.away_team).includes(norm(teamB))),
    )
    todayLeg = legLabel(match?.stats?.round)
  } catch { /* best-effort */ }

  try {
    const res = await fetch(`${AF_BASE}/fixtures/headtohead?h2h=${A.id}-${B.id}&last=3`, {
      headers: { "x-apisports-key": apiKey, "Accept": "application/json" }, cache: "no-store",
    })
    if (!res.ok) return `No se pudo consultar el H2H (API ${res.status}). NO inventes resultados.`
    const json = await res.json() as { response?: any[] }
    const list = json.response ?? []
    if (!list.length) return `Sin enfrentamientos previos registrados entre ${A.label} y ${B.label}.`

    const lines = list.map((fx) => {
      const d = (fx.fixture?.date ?? "").slice(0, 10)
      const h = fx.teams?.home?.name ?? "?", a = fx.teams?.away?.name ?? "?"
      const gh = fx.goals?.home ?? "-", ga = fx.goals?.away ?? "-"
      const comp = fx.league?.name ?? ""
      return `- ${d}: ${h} ${gh}-${ga} ${a} [${comp}${legLabel(fx.league?.round)}]`
    })
    return [
      `Últimos ${lines.length} enfrentamientos ${A.label} vs ${B.label} (API-Football, datos reales):`,
      ...lines,
      todayLeg ? `El partido de hoy entre ambos es${todayLeg}.` : "",
      "Usa SOLO estos resultados reales; no inventes otros enfrentamientos ni marcadores.",
    ].filter(Boolean).join("\n")
  } catch {
    return "Error consultando el H2H. NO inventes resultados."
  }
}

// ─── Convocatoria del Mundial (wc_squads) ─────────────────────────────────────

/** Lista de convocados de una selección del Mundial (tabla wc_squads). */
async function getTeamSquad(teamName: string): Promise<string> {
  if (!teamName?.trim()) return "Necesito el nombre de la selección para consultar su convocatoria."
  try {
    const sb = createServiceClient()
    const { data } = await sb
      .from("wc_squads")
      .select("team_name, players, updated_at")
      .ilike("team_name", `%${teamName.trim()}%`)
      .limit(1)
    const row = data?.[0] as any
    const players = Array.isArray(row?.players) ? row.players : []
    if (!row || players.length === 0) {
      return `No hay convocatoria registrada para "${teamName}" todavía. Las listas del Mundial se publican cerca del torneo. NO inventes jugadores ni números de dorsal.`
    }
    const lines = players.slice(0, 60).map((p: any) =>
      `- ${p.name ?? "?"}${p.number ? ` (#${p.number})` : ""}${p.position ? ` · ${p.position}` : ""}${p.age ? ` · ${p.age}a` : ""}`,
    )
    return `Convocatoria de ${row.team_name ?? teamName} (${players.length} jugadores · datos oficiales API-Football):\n${lines.join("\n")}\nUsa SOLO estos nombres reales; no inventes jugadores.`
  } catch {
    return "No se pudo consultar la convocatoria ahora mismo. NO inventes jugadores."
  }
}

// ─── Combinadas: SOLO con cuotas reales (HARD-BLOCK anti-invención) ───────────

const NO_ODDS_MSG = "No hay cuotas oficiales disponibles en la base de datos para estos partidos todavía."

function splitPair(text: string): [string, string] | null {
  const p = (text ?? "").replace(/\s+/g, " ").trim().split(/\s+(?:vs?\.?|v|-|–|—|@|contra)\s+/i)
  return p.length >= 2 && p[0] && p[1] ? [p[0].trim(), p[1].trim()] : null
}

/**
 * Devuelve las cuotas REALES (API-Football /odds) de los partidos pedidos para
 * una combinada. Si NINGUNO tiene cuotas reales, devuelve el mensaje de rechazo
 * exacto. El bot DEBE construir combinadas solo con lo que devuelve esto.
 */
async function getCombinadaOdds(matchesStr: string): Promise<string> {
  if (!matchesStr?.trim()) return "Indica los partidos (equipo vs equipo) que quieres en la combinada."
  const pairs = matchesStr.split(/[;\n]+/).map((s) => s.trim()).filter(Boolean).slice(0, 8)
  try {
    const sb = createServiceClient()
    const { data } = await sb
      .from("fixtures")
      .select("fixture_id, home_team, away_team, match_date")
      .gte("match_date", new Date(Date.now() - 12 * 3600_000).toISOString())
      .order("match_date", { ascending: true })
      .limit(800)
    const fixtures = data ?? []

    const lines: string[] = []
    let anyOdds = false
    for (const raw of pairs) {
      const sp = splitPair(raw)
      if (!sp) { lines.push(`- "${raw}": no pude interpretar el partido.`); continue }
      const a = norm(sp[0]), b = norm(sp[1])
      const fx = fixtures.find((f: any) => {
        const h = norm(f.home_team ?? ""), aw = norm(f.away_team ?? "")
        return ((h.includes(a) || a.includes(h)) && (aw.includes(b) || b.includes(aw))) ||
               ((h.includes(b) || b.includes(h)) && (aw.includes(a) || a.includes(aw)))
      })
      if (!fx?.fixture_id) { lines.push(`- ${raw}: partido no encontrado en la BD.`); continue }
      const odds = await fetchFixtureOddsAF(Number(fx.fixture_id))
      if (!odds || (odds.home == null && odds.away == null)) {
        lines.push(`- ${fx.home_team} vs ${fx.away_team}: SIN cuotas oficiales en la BD.`)
        continue
      }
      anyOdds = true
      const parts = [
        odds.home != null ? `1 @${odds.home}` : null,
        odds.draw != null ? `X @${odds.draw}` : null,
        odds.away != null ? `2 @${odds.away}` : null,
        odds.over25 != null ? `Over2.5 @${odds.over25}` : null,
        odds.under25 != null ? `Under2.5 @${odds.under25}` : null,
      ].filter(Boolean).join(" · ")
      lines.push(`- ${fx.home_team} vs ${fx.away_team}: ${parts}`)
    }

    if (!anyOdds) return NO_ODDS_MSG
    return `Cuotas REALES (API-Football) para la combinada:\n${lines.join("\n")}\nConstruye la combinada SOLO con estas cuotas reales. Excluye cualquier partido marcado "SIN cuotas". NUNCA inventes una cuota.`
  } catch {
    return NO_ODDS_MSG
  }
}

// ─── Definición de herramientas ────────────────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: "get_fixtures_db",
    description: "FUENTE DE DATOS de partidos: nuestra tabla fixtures de Supabase (alimentada desde API-Football). Por defecto devuelve los partidos de HOY con su LIGA/competición REAL entre corchetes, equipos, hora y estado. Úsala SIEMPRE antes de hablar de partidos. PARÁMETROS: team_name (filtra por equipo); world_cup=true (devuelve el CALENDARIO del Mundial 2026 — grupos y eliminatorias — del futuro, no solo 24h; úsalo SIEMPRE que pregunten por el Mundial); days_ahead (amplía la ventana N días por delante). Si un partido no aparece, NO existe en la BD — no lo inventes.",
    input_schema: { type: "object" as const, properties: {
      team_name: { type: "string", description: "Opcional. Filtra los partidos por nombre de equipo (acepta substrings)." },
      world_cup: { type: "boolean", description: "Opcional. true → devuelve el calendario completo del Mundial 2026 (futuro incluido). Úsalo para cualquier pregunta sobre el Mundial." },
      days_ahead: { type: "number", description: "Opcional. Amplía la ventana de búsqueda a N días por delante de hoy (máx 400)." },
    }, required: [] },
  },
  {
    name: "get_head_to_head",
    description: "Historial de enfrentamientos directos (H2H) entre DOS equipos: devuelve los últimos 3 partidos reales entre ellos (fecha, marcador, competición) e indica si son de ida/vuelta. Úsala cuando el usuario pregunte por un cruce, eliminatoria o playoff entre dos equipos concretos, para fundamentar el análisis en su historial real. NO inventes enfrentamientos: usa solo lo que devuelve esta herramienta.",
    input_schema: { type: "object" as const, properties: { team_a: { type: "string", description: "Primer equipo del cruce." }, team_b: { type: "string", description: "Segundo equipo del cruce." } }, required: ["team_a", "team_b"] },
  },
  {
    name: "get_team_squad",
    description: "Convocatoria (lista de jugadores) de una selección del Mundial 2026. Úsala cuando el usuario pregunte por los jugadores, convocados, plantilla o estrellas de una selección. Devuelve nombres, dorsal y posición REALES (API-Football). Si la lista aún no está publicada, lo indica — NUNCA inventes jugadores.",
    input_schema: { type: "object" as const, properties: { team_name: { type: "string", description: "Nombre de la selección (ej. España, Argentina, Brasil)." } }, required: ["team_name"] },
  },
  {
    name: "get_combinada_odds",
    description: "OBLIGATORIA antes de proponer CUALQUIER combinada/parlay. Devuelve las CUOTAS REALES (API-Football) de los partidos que el usuario quiere combinar. Construye la combinada usando EXCLUSIVAMENTE las cuotas que devuelve. Si responde que no hay cuotas, relaya ese mensaje TAL CUAL y NO generes la combinada. PROHIBIDO inventar cuotas.",
    input_schema: { type: "object" as const, properties: { matches: { type: "string", description: "Partidos a combinar, uno por línea o separados por ';' (ej. 'España vs Francia; Brasil vs Argentina')." } }, required: ["matches"] },
  },
]

async function executeTool(name: string, input: Record<string, string>): Promise<string> {
  try {
    if (name === "get_fixtures_db") return await getFixturesFromDb({
      teamName: input.team_name,
      worldCup: String(input.world_cup) === "true",
      daysAhead: input.days_ahead != null ? Number(input.days_ahead) : undefined,
    })
    if (name === "get_head_to_head") return await getHeadToHead(input.team_a, input.team_b)
    if (name === "get_team_squad") return await getTeamSquad(input.team_name)
    if (name === "get_combinada_odds") return await getCombinadaOdds(input.matches)
    return "Herramienta no reconocida."
  } catch (e: any) {
    return `Error obteniendo datos: ${e.message}. NO inventes el dato — indica que no está disponible.`
  }
}

// ─── Contexto del pipeline Poisson (in-memory store, sin ESPN) ─────────────────

function buildTodayContext(): string {
  try {
    const store = getStore()
    const today = new Date().toISOString().split("T")[0]

    if (!store.valuePicks?.length && !store.combinadaPool?.length) {
      return `\n═══════════════════════════════════
AVISO — MOTOR EN FRÍO
═══════════════════════════════════
El pipeline de picks aún no ha generado resultados para hoy (${today}).
→ USA get_fixtures_db para obtener los partidos de hoy y su liga real desde nuestra base de datos.
→ NO INVENTES picks ni partidos — usa la herramienta para obtener datos reales.`
    }

    const lines: string[] = [`\n═══════════════════════════════════`, `PICKS DE HOY (${today}) — GENERADOS POR EL MOTOR POISSON`, `═══════════════════════════════════`]

    const valuePicks = (store.valuePicks ?? []).slice(0, 8)
    if (valuePicks.length) {
      lines.push(`\nVALUE PICKS DEL DÍA (${valuePicks.length} picks):`)
      for (const p of valuePicks) {
        const match = `${p.home_team ?? p.homeName ?? "?"} vs ${p.away_team ?? p.awayName ?? "?"}`
        const sel   = p.selection ?? p.market ?? "?"
        const odds  = p.best_odd != null ? `@ ${p.best_odd}` : ""
        const edge  = p.value_edge != null ? `edge +${Number(p.value_edge).toFixed(1)}%` : ""
        const tier  = p.confidence_tier ?? p.tier ?? ""
        lines.push(`• ${match} → ${sel} ${odds} ${edge}${tier ? ` [${tier}]` : ""}`.trim())
      }
    }

    const poolSample = (store.combinadaPool ?? []).slice(0, 6)
    if (poolSample.length) {
      lines.push(`\nSELECCIONES EN POOL DE COMBINADAS (${store.combinadaPool.length} total):`)
      for (const c of poolSample) {
        const odds = c.odd != null ? `@ ${c.odd}` : ""
        lines.push(`• ${c.match ?? "?"} → ${c.selection ?? "?"} ${odds} [${c.league ?? ""}]`.trim())
      }
    }

    lines.push(`\nInstrucción: usa esta información del motor como contexto. Si el usuario pregunta por un partido NO listado aquí, usa get_fixtures_db para verificarlo y obtener su liga real.`)

    return lines.join("\n")
  } catch {
    return ""
  }
}

/**
 * FASE 4.1 — Inyecta la CLASIFICACIÓN ACTUAL del Mundial en texto plano para el
 * System Prompt. Calcula los puntos por grupo desde los partidos finalizados de
 * la BD (mismo criterio que /api/world-cup/live). Devuelve "" si no hay partidos
 * jugados aún (no ensucia el prompt).
 */
async function buildWcStandingsContext(): Promise<string> {
  try {
    const sb = createServiceClient()
    const { data } = await sb
      .from("fixtures")
      .select("home_team, away_team, stats")
      .eq("league", "World Cup")
      .limit(200)
    const rows = data ?? []
    type S = { pts: number; w: number; d: number; l: number; gf: number; ga: number }
    const tbl = new Map<string, S>()
    for (const t of WC_TEAMS) tbl.set(t.code, { pts: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 })
    for (const f of rows as any[]) {
      const res = f.stats?.result ?? f.stats?.goals
      if (!res || res.home == null || res.away == null) continue
      const hc = resolveWcCode(f.home_team), ac = resolveWcCode(f.away_team)
      if (!hc || !ac) continue
      const h = tbl.get(hc), a = tbl.get(ac); if (!h || !a) continue
      const hg = Number(res.home), ag = Number(res.away)
      h.gf += hg; h.ga += ag; a.gf += ag; a.ga += hg
      if (hg > ag) { h.w++; h.pts += 3; a.l++ } else if (hg < ag) { a.w++; a.pts += 3; h.l++ } else { h.d++; a.d++; h.pts++; a.pts++ }
    }
    if (![...tbl.values()].some((s) => s.w + s.d + s.l > 0)) return ""
    const byGroup = new Map<string, { name: string; s: S }[]>()
    for (const t of WC_TEAMS) {
      if (!t.group) continue
      if (!byGroup.has(t.group)) byGroup.set(t.group, [])
      byGroup.get(t.group)!.push({ name: t.name, s: tbl.get(t.code)! })
    }
    const lines = ["\n═══════════════════════════════════", "CLASIFICACIÓN ACTUAL DEL MUNDIAL (datos reales de nuestra BD)", "═══════════════════════════════════"]
    for (const g of [...byGroup.keys()].sort()) {
      const teams = byGroup.get(g)!.sort((x, y) => y.s.pts - x.s.pts || (y.s.gf - y.s.ga) - (x.s.gf - x.s.ga) || y.s.gf - x.s.gf)
      lines.push(`Grupo ${g}: ` + teams.map((t) => `${t.name} ${t.s.pts}pts`).join(", "))
    }
    return lines.join("\n")
  } catch {
    return ""
  }
}

const SYSTEM_PROMPT = `Eres PicksBot, analista de datos deportivos de SportsPicks Analytics. Riguroso y basado SOLO en datos reales.

TIENES ACCESO a los datos del Mundial 2026 en tu base de datos (72 partidos y las plantillas ya cargados). Las fechas de los cruces YA están asignadas. CONSULTA tus herramientas ANTES de decir que no tienes datos — nunca afirmes que no sabes del Mundial sin haber llamado a get_fixtures_db con world_cup=true.

FUENTES OFICIALES (tus únicas herramientas):
- get_fixtures_db — partidos de NUESTRA base de datos (liga, hora, estado, posición, racha). Llámala SIEMPRE antes de hablar de cualquier partido. Para el MUNDIAL 2026 llámala con world_cup=true (devuelve TODO el calendario de junio-julio 2026: grupos y eliminatorias) — NUNCA digas que no sabes del Mundial sin haberla llamado así primero. Para otras fechas futuras usa days_ahead.
- get_head_to_head — cuando el usuario pregunte por un CRUCE entre dos equipos (eliminatoria, playoff, partido concreto), llámala para obtener los últimos 3 enfrentamientos reales y si es ida/vuelta. Fundamenta el análisis del cruce en ese historial.
- get_team_squad — cuando pregunten por los JUGADORES/convocatoria/plantilla de una selección del Mundial, llámala. Si la lista aún no está publicada, dilo; NUNCA inventes jugadores ni dorsales.
- get_combinada_odds — OBLIGATORIA antes de proponer cualquier COMBINADA/parlay. PROHIBIDO TERMINANTEMENTE inventar o estimar una cuota. Construye la combinada SOLO con las cuotas reales que devuelve. Si un partido (p.ej. del Mundial) no tiene cuotas en la BD, NO lo incluyas; y si NINGUNO tiene cuotas, responde EXACTAMENTE "No hay cuotas oficiales disponibles en la base de datos para estos partidos todavía" y NO generes la combinada.
- PROHIBIDO inventar estadísticas, posiciones, cuotas, árbitros, alineaciones o enfrentamientos previos, o usar tu conocimiento de entrenamiento (está DESFASADO). Si un dato no está → di "ese dato no está disponible" y baja la confianza.
- No menciones otras APIs ni fuentes (ni "ESPN" ni los nombres de las herramientas).

FORMATO DE RESPUESTA — OBLIGATORIO (Markdown limpio):
- EXTREMADAMENTE CONCISO y visual. Nada de párrafos largos ni relleno. Ve directo al grano.
- Usa EXCLUSIVAMENTE listas con guion (-) y, cuando compares datos (p.ej. H2H o dos equipos), TABLAS SIMPLES de Markdown (| col | col |). Resalta con **negritas** los **equipos**, **cuotas** y **mercados** (**1X2**, **Over 2.5**, **BTTS**).
- Estructura típica: una línea de veredicto + 2-4 guiones (o una tabla) + una línea breve de cierre/confianza.
- TERMINANTEMENTE PROHIBIDO: bloques de código (no uses comillas triples \`\`\` jamás), JSON crudo, IDs de base de datos (team_id, league_id, fixture_id), nombres de campos o herramientas internas (form, stats, get_fixtures_db, headtohead) y cualquier carácter raro o símbolo decorativo. Traduce TODO a lenguaje natural (ej. racha "WWDLW" → "4 victorias en sus últimos 5, en buena forma").
- Cita la fuente de forma natural y breve: "según nuestros datos, **[equipo]** es 2º con 9 pts".

MERCADOS — DIVERSIFICA (FASE 4): para CADA pick evalúa SIEMPRE los mercados alternativos —**Over/Under 2.5** y **BTTS (Ambos Marcan)**— además del **1X2**. Propón el mercado con MEJOR valor matemático; no recurras por defecto al ganador 1X2.

REGLAS DE ACERO: Conoces la clasificación y urgencia de los equipos, pero ERES UN MOTOR ESTADÍSTICO. No justifiques un pick solo por 'necesidad de ganar'. Filtra y descarta estrictamente cualquier pick con Edge <= 0 o cuotas inventadas. El valor matemático tiene prioridad absoluta sobre la narrativa.

Idioma: español. Sin promesas de resultados ni garantías. Apuesta responsable, +18.`

type ContentBlock = { type: string; text?: string; id?: string; name?: string; input?: Record<string, string> }

// ─── Input limits — defensa contra DoS y abuso de API ────────────────────────
const MAX_MESSAGE_LEN = 4000          // 4k chars de mensaje
const MAX_IMAGE_BYTES = 5 * 1024 * 1024  // 5 MB de imagen (Anthropic limit)
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"])
const MAX_HISTORY_ITEMS = 5
const MAX_HISTORY_RAW_BYTES = 50_000  // 50 KB de history

export async function POST(req: Request) {
  // CN-024: Require authenticated session
  const session = await getServerSession()
  if (!session?.user?.email) {
    return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401, headers: { "Content-Type": "application/json" } })
  }

  // Rate limit por IP — protege la API key de Anthropic (cuesta dinero por petición)
  // Ráfaga 3 simultáneas · ritmo 10 / 5 min (~2/min sostenido)
  const ip = getClientIp(req)
  if (!consume(`bot:${ip}`, 3, 2)) return tooManyRequests(60)

  // ── Plan check: free users get 1 message total ─────────────────────────────
  const userEmail = session.user.email!.trim().toLowerCase()
  const hasPremiumGrant = !!getGrantedPlan(userEmail)
  const sessionPlan = (session.user as any).plan as string | undefined
  const isPremium = hasPremiumGrant || sessionPlan === "premium" || sessionPlan === "pro"

  if (!isPremium) {
    const sb = createServiceClient()
    const { data: userLog } = await sb
      .from("users_log")
      .select("bot_free_uses")
      .eq("email", userEmail)
      .maybeSingle()

    const uses = userLog?.bot_free_uses ?? 0
    if (uses >= 1) {
      return new Response(JSON.stringify({
        error: "free_limit",
        message: "Has usado tu mensaje gratuito con el bot. Hazte Premium para acceso ilimitado. 🚀",
      }), { status: 403, headers: { "Content-Type": "application/json" } })
    }

    // Incrementar ANTES de ejecutar — evita doble uso aunque el stream falle
    await sb
      .from("users_log")
      .upsert({ email: userEmail, bot_free_uses: uses + 1 }, { onConflict: "email" })
  }
  // ─────────────────────────────────────────────────────────────────────────────

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
            .filter((m: any) => {
              if (!m || typeof m !== "object") return false
              if (m.role !== "user" && m.role !== "assistant") return false
              // CRÍTICO: descartar mensajes con content vacío. Un turno solo-imagen
              // o una respuesta vacía dejaba content:"" → Anthropic 400
              // "messages must have non-empty content" en el siguiente turno.
              if (typeof m.content === "string") return m.content.trim().length > 0
              if (Array.isArray(m.content)) return m.content.length > 0
              return false
            })
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
      ...history.slice(-5),
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
          // FASE 4.1: clasificación REAL del Mundial inyectada en texto plano (una
          // sola vez por turno) → el motor razona con los puntos actuales.
          const wcStandingsCtx = await buildWcStandingsContext()
          while (iteration < 10) {
            iteration++
            const response = await client.messages.create({
              model: MODEL_SONNET,   // FASE 2: motor central del pick → Sonnet
              max_tokens: 2500,
              // Prompt caching: system prompt + tools se cachean 5 min → ~80% ahorro en tokens de entrada
              system: [{ type: "text", text: SYSTEM_PROMPT + buildTodayContext() + wcStandingsCtx, cache_control: { type: "ephemeral" } }] as any,
              tools: [...TOOLS.slice(0, -1), { ...TOOLS[TOOLS.length - 1], cache_control: { type: "ephemeral" } }] as any,
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
            if (iteration === 1) send("🔍 *Consultando nuestra base de datos...*\n\n")

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
