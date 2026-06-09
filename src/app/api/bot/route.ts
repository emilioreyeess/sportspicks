import Anthropic from "@anthropic-ai/sdk"
import { getServerSession } from "@/lib/auth-server"
import { consume, getClientIp, tooManyRequests } from "@/lib/rate-limit"
import { getStore } from "@/lib/store"
import { createServiceClient } from "@/lib/supabase/client"
import { getGrantedPlan } from "@/lib/plan-grants"
import type { Fixture, FixtureStats, StandingRow } from "@/lib/infrastructure/footballApi"

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
async function getFixturesFromDb(teamName?: string): Promise<string> {
  const date = new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Europe/Madrid",
  }).format(new Date())
  const dayStart = `${date}T00:00:00.000Z`
  const dayEnd   = `${date}T23:59:59.999Z`

  let fixtures: Fixture[]
  try {
    const sb = createServiceClient()
    const { data, error } = await sb
      .from("fixtures")
      .select("*")
      .gte("match_date", dayStart)
      .lte("match_date", dayEnd)
      .order("match_date", { ascending: true })
    if (error) throw new Error(error.message)
    fixtures = (data ?? []) as Fixture[]
  } catch {
    return "La base de datos de partidos no está disponible ahora mismo. NO inventes partidos ni datos — indica que no se pudo consultar."
  }

  if (!fixtures.length) {
    return `No hay partidos registrados en la base de datos para hoy (${date}). NO inventes partidos.`
  }

  let rows = fixtures
  if (teamName && teamName.trim()) {
    const q = norm(teamName)
    rows = fixtures.filter((f) =>
      norm(f.home_team ?? "").includes(q) || norm(f.away_team ?? "").includes(q),
    )
    if (!rows.length) {
      return `No encontré "${teamName}" en los partidos de hoy en la base de datos (${date}). NO inventes el partido — puede no jugar hoy o el nombre no coincide.`
    }
  }

  // Si se filtró por equipo (pocos partidos), damos ficha técnica completa.
  // Si es el listado general, damos una línea compacta por partido.
  const detailed = rows.length <= 6

  const blocks = rows.slice(0, 80).map((f) => {
    const league = f.league ?? "Liga desconocida"
    const home = f.home_team ?? "?"
    const away = f.away_team ?? "?"
    const s = (f.stats ?? null) as FixtureStats | null

    if (!detailed) {
      return `• [${league}] ${home} vs ${away} — ${fmtTime(f.match_date)} · ${f.status ?? "?"}`
    }

    const ref = s?.referee ? `Árbitro: ${s.referee}` : "Árbitro: no disponible"
    const venue = s?.venue ? `Estadio: ${s.venue}` : "Estadio: no disponible"
    return [
      `📋 [${league}] ${home} vs ${away}`,
      `   Hora: ${fmtTime(f.match_date)} · Estado: ${f.status ?? "?"}`,
      `   ${ref} · ${venue}`,
      `   ${teamCard(home, s?.home?.standing ?? null)}`,
      `   ${teamCard(away, s?.away?.standing ?? null)}`,
    ].join("\n")
  })

  return `📊 Partidos en NUESTRA base de datos oficial para hoy (${date}) — ${rows.length} partido(s).
La LIGA real va entre corchetes; las posiciones y rachas vienen de la clasificación oficial almacenada.
${blocks.join("\n")}

Usa estos datos (liga, posición, racha, árbitro, estadio) como la verdad oficial. NO uses tu memoria sobre divisiones ni inventes cifras.`
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

// ─── Definición de herramientas ────────────────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: "get_fixtures_db",
    description: "ÚNICA Y EXCLUSIVA FUENTE DE DATOS. Consulta los partidos de HOY directamente en nuestra base de datos (tabla fixtures de Supabase, alimentada desde API-Football). Devuelve, para cada partido, la LIGA/competición REAL entre corchetes, los equipos, la hora y el estado actual. Úsala SIEMPRE EN PRIMER LUGAR antes de decir qué partidos hay o de analizar cualquier encuentro. Pasa team_name para filtrar por un equipo. Si un partido no aparece aquí, NO existe hoy — no lo inventes.",
    input_schema: { type: "object" as const, properties: { team_name: { type: "string", description: "Opcional. Filtra los partidos por nombre de equipo (acepta substrings)." } }, required: [] },
  },
  {
    name: "get_head_to_head",
    description: "Historial de enfrentamientos directos (H2H) entre DOS equipos: devuelve los últimos 3 partidos reales entre ellos (fecha, marcador, competición) e indica si son de ida/vuelta. Úsala cuando el usuario pregunte por un cruce, eliminatoria o playoff entre dos equipos concretos, para fundamentar el análisis en su historial real. NO inventes enfrentamientos: usa solo lo que devuelve esta herramienta.",
    input_schema: { type: "object" as const, properties: { team_a: { type: "string", description: "Primer equipo del cruce." }, team_b: { type: "string", description: "Segundo equipo del cruce." } }, required: ["team_a", "team_b"] },
  },
]

async function executeTool(name: string, input: Record<string, string>): Promise<string> {
  try {
    if (name === "get_fixtures_db") return await getFixturesFromDb(input.team_name)
    if (name === "get_head_to_head") return await getHeadToHead(input.team_a, input.team_b)
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

const SYSTEM_PROMPT = `Eres PicksBot, analista de datos deportivos de SportsPicks Analytics. Riguroso y basado SOLO en datos reales.

FUENTES OFICIALES (tus únicas herramientas):
- get_fixtures_db — partidos de HOY (liga, hora, estado, posición, racha). Llámala SIEMPRE antes de hablar de cualquier partido. Si un partido no aparece, NO se juega hoy: no lo analices.
- get_head_to_head — cuando el usuario pregunte por un CRUCE entre dos equipos (eliminatoria, playoff, partido concreto), llámala para obtener los últimos 3 enfrentamientos reales y si es ida/vuelta. Fundamenta el análisis del cruce en ese historial.
- PROHIBIDO inventar estadísticas, posiciones, cuotas, árbitros, alineaciones o enfrentamientos previos, o usar tu conocimiento de entrenamiento (está DESFASADO). Si un dato no está → di "ese dato no está disponible" y baja la confianza.
- No menciones otras APIs ni fuentes (ni "ESPN" ni los nombres de las herramientas).

FORMATO DE RESPUESTA — OBLIGATORIO (Markdown limpio):
- EXTREMADAMENTE CONCISO y visual. Nada de párrafos largos ni relleno. Ve directo al grano.
- Usa EXCLUSIVAMENTE listas con guion (-) y, cuando compares datos (p.ej. H2H o dos equipos), TABLAS SIMPLES de Markdown (| col | col |). Resalta con **negritas** los **equipos**, **cuotas** y **mercados** (**1X2**, **Over 2.5**, **BTTS**).
- Estructura típica: una línea de veredicto + 2-4 guiones (o una tabla) + una línea breve de cierre/confianza.
- TERMINANTEMENTE PROHIBIDO: bloques de código (no uses comillas triples \`\`\` jamás), JSON crudo, IDs de base de datos (team_id, league_id, fixture_id), nombres de campos o herramientas internas (form, stats, get_fixtures_db, headtohead) y cualquier carácter raro o símbolo decorativo. Traduce TODO a lenguaje natural (ej. racha "WWDLW" → "4 victorias en sus últimos 5, en buena forma").
- Cita la fuente de forma natural y breve: "según nuestros datos, **[equipo]** es 2º con 9 pts".

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
          while (iteration < 10) {
            iteration++
            const response = await client.messages.create({
              model: "claude-sonnet-4-5-20250929",
              max_tokens: 2500,
              // Prompt caching: system prompt + tools se cachean 5 min → ~80% ahorro en tokens de entrada
              system: [{ type: "text", text: SYSTEM_PROMPT + buildTodayContext(), cache_control: { type: "ephemeral" } }] as any,
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
