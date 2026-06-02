/**
 * Supabase-backed ML self-learning loop — SportsPicks Analytics
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Cierra el ciclo de aprendizaje continuo descrito en el STEP 1:
 *
 *   1. logPrediction()         → registra CADA predicción en `predictions_log`.
 *   2. settleGroundTruth()     → busca el resultado FINAL real (ESPN) de las
 *                                predicciones pendientes y las marca won/lost/void.
 *   3. computeBrierAndAccuracy → calcula Brier Score + Accuracy reales vs. el
 *                                resultado, por scope global / liga / mercado, y
 *                                los guarda en `model_performance`.
 *   4. adjustTeamFormWeights() → si el modelo pierde sistemáticamente en una liga
 *                                o mercado (Brier alto / mal calibrado), ajusta el
 *                                multiplicador en `team_form_weights` (clamp 0.5–1.5).
 *   5. getTeamFormWeight()     → el motor de probabilidad SIEMPRE consulta este
 *                                peso antes de emitir una nueva probabilidad.
 *
 * Filosofía anti-hallucination: toda la verdad-terreno viene de la API de ESPN.
 * Si no hay dato verificable, la predicción queda `void` (no inventamos nada).
 *
 * Todas las funciones usan el service-role client (bypass RLS) y SOLO deben
 * llamarse desde route handlers / cron en el servidor.
 */

import { createServiceClient } from "@/lib/supabase/client"
import { getMatchContext, type MatchContext } from "@/lib/match-context"

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

/** Mercados soportados por el motor de análisis (STEP 4). */
export type MlMarket =
  | "1x2"
  | "btts"
  | "goals_ou"
  | "corners_ou"
  | "cards_ou"

export type WeightScopeType = "league" | "market" | "team" | "context"

export interface PredictionInput {
  matchId: string
  league: string                 // slug ESPN (ej "esp.1")
  homeTeam: string
  awayTeam: string
  market: MlMarket | string
  /** Selección legible que ENCODEA la línea cuando aplica: "Over 2.5", "Home", "Yes", "Under 9.5". */
  pick: string
  odds?: number | null           // cuota decimal si la hay
  modelProb: number              // 0..1 — probabilidad asignada por el modelo al `pick`
  edge?: number | null           // valor (modelProb - impliedProb), 0..1
  userId?: string | null         // null = predicción del sistema (global)
  kickoffIso: string             // ISO 8601 del inicio del partido
  /** Contexto competitivo — aísla el aprendizaje. Si se omite, se deriva
   *  automáticamente del slug de la liga. */
  context?: MatchContext
}

export interface SettleResult {
  scanned: number
  settled: number
  void: number
  stillPending: number
  errors: string[]
}

export interface PerfRow {
  scopeType: "global" | "league" | "market" | "context"
  scope: string
  samples: number
  wins: number
  accuracy: number
  brierScore: number
  avgModelProb: number
  avgActual: number
  roi: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Constantes de calibración
// ─────────────────────────────────────────────────────────────────────────────

const ML = {
  /** Muestras mínimas para que un scope pueda mover su peso. */
  MIN_SAMPLES_FOR_WEIGHT: 20,
  /** Paso máximo de ajuste de peso por ejecución (anti-overshoot). */
  MAX_WEIGHT_STEP: 0.1,
  /** Límites duros del multiplicador (coinciden con el CHECK de la tabla). */
  WEIGHT_MIN: 0.5,
  WEIGHT_MAX: 1.5,
  /** Ventana de evaluación para Brier/accuracy (días). */
  WINDOW_DAYS: 120,
  /** Antigüedad mínima tras el kickoff antes de intentar liquidar (min). */
  SETTLE_GRACE_MIN: 130,
  /** Máximo de predicciones a liquidar por ejecución (rate-limit ESPN). */
  SETTLE_BATCH: 80,
} as const

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. logPrediction — registra CADA predicción
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inserta una predicción en `predictions_log`. Idempotente: si ya existe una
 * fila PENDIENTE para el mismo (match_id, market, pick, user_id) no duplica.
 * Devuelve true si insertó, false si ya existía o falló de forma silenciosa.
 */
export async function logPrediction(p: PredictionInput): Promise<boolean> {
  try {
    const sb = createServiceClient()

    // Dedupe: misma predicción pendiente ya registrada
    let q = sb
      .from("predictions_log")
      .select("id")
      .eq("match_id", p.matchId)
      .eq("market", p.market)
      .eq("pick", p.pick)
      .eq("status", "pending")
      .limit(1)
    q = p.userId ? q.eq("user_id", p.userId) : q.is("user_id", null)
    const { data: existing } = await q
    if (existing && existing.length > 0) return false

    const modelProb = clamp(Number(p.modelProb) || 0, 0, 1)
    // Si el caller no pasa `context`, lo derivamos del slug. Por defecto será
    // "club"; selecciones se etiquetan como international_* y se aíslan
    // automáticamente del aprendizaje de fútbol de clubes.
    const context: MatchContext = p.context ?? getMatchContext(p.league).context
    const { error } = await sb.from("predictions_log").insert({
      match_id: p.matchId,
      league: p.league,
      home_team: p.homeTeam,
      away_team: p.awayTeam,
      market: p.market,
      pick: p.pick,
      odds: p.odds ?? null,
      model_prob: modelProb,
      edge: p.edge ?? null,
      user_id: p.userId ?? null,
      kickoff_iso: p.kickoffIso,
      status: "pending",
      context,
    })
    if (error) {
      console.warn("[ml] logPrediction insert error:", error.message)
      return false
    }
    return true
  } catch (e: any) {
    console.warn("[ml] logPrediction failed:", e?.message ?? e)
    return false
  }
}

/** Registra varias predicciones (best-effort, en paralelo). Devuelve nº insertadas. */
export async function logPredictions(ps: PredictionInput[]): Promise<number> {
  if (!ps.length) return 0
  const res = await Promise.all(ps.map((p) => logPrediction(p)))
  return res.filter(Boolean).length
}

// ─────────────────────────────────────────────────────────────────────────────
// Settlement: parser de mercados + verdad-terreno desde ESPN
// ─────────────────────────────────────────────────────────────────────────────

/** Extrae la primera línea numérica de un texto de pick ("Over 2.5" → 2.5). */
function parseLine(pick: string): number | null {
  const m = pick.match(/-?\d+(\.\d+)?/)
  return m ? parseFloat(m[0]) : null
}

interface BoxTotals {
  corners: number | null
  cards: number | null   // amarillas + rojas, ambos equipos
}

/**
 * Decide el resultado de un pick dado el marcador final y (si aplica) los
 * totales de boxscore. Devuelve "won" | "lost" | "void".
 * "void" = no se puede verificar con datos reales (sin invención).
 */
function settleMarket(
  market: string,
  pick: string,
  homeScore: number,
  awayScore: number,
  box: BoxTotals,
): "won" | "lost" | "void" {
  const total = homeScore + awayScore
  const p = pick.trim().toLowerCase()
  const line = parseLine(pick)

  switch (market) {
    case "1x2": {
      // pick: "home"/"1", "draw"/"x", "away"/"2"
      const res = homeScore > awayScore ? "home" : homeScore < awayScore ? "away" : "draw"
      if (p.includes("home") || p === "1") return res === "home" ? "won" : "lost"
      if (p.includes("away") || p === "2") return res === "away" ? "won" : "lost"
      if (p.includes("draw") || p === "x") return res === "draw" ? "won" : "lost"
      return "void"
    }
    case "btts": {
      const both = homeScore > 0 && awayScore > 0
      if (p.includes("yes") || p.includes("si") || p.includes("sí")) return both ? "won" : "lost"
      if (p.includes("no")) return both ? "lost" : "won"
      return "void"
    }
    case "goals_ou": {
      if (line == null) return "void"
      if (p.includes("over") || p.includes("más") || p.includes("mas")) return total > line ? "won" : "lost"
      if (p.includes("under") || p.includes("menos")) return total < line ? "won" : "lost"
      return "void"
    }
    case "corners_ou": {
      if (line == null || box.corners == null) return "void"
      if (p.includes("over") || p.includes("más") || p.includes("mas")) return box.corners > line ? "won" : "lost"
      if (p.includes("under") || p.includes("menos")) return box.corners < line ? "won" : "lost"
      return "void"
    }
    case "cards_ou": {
      if (line == null || box.cards == null) return "void"
      if (p.includes("over") || p.includes("más") || p.includes("mas")) return box.cards > line ? "won" : "lost"
      if (p.includes("under") || p.includes("menos")) return box.cards < line ? "won" : "lost"
      return "void"
    }
    case "handicap": {
      // pick formato: "<team> hándicap +0.5" | "<team> hándicap -1" | etc.
      // El primer token decide qué lado recibe la línea: si empieza con el
      // nombre del local → se aplica al local; si no, al visitante.
      const m = pick.match(/(-?\d+(?:\.\d+)?)/)
      if (!m) return "void"
      const lineRaw = parseFloat(m[1])
      // Heurística de qué equipo cubre la línea: no tenemos los nombres
      // exactos en este scope (el ML loop solo recibe pick/market), así
      // que usamos la convención: si el texto contiene "home"|"local",
      // aplica al local; "away"|"visitante" al visitante. Si no, asumimos
      // que el primer token del pick es el local (formato value engine).
      const lc = p
      const isHomeSide = !/visit|away/.test(lc)
      const adj = isHomeSide ? homeScore + lineRaw : awayScore + lineRaw
      const opp = isHomeSide ? awayScore : homeScore
      if (adj > opp) return "won"
      if (adj < opp) return "lost"
      return "void"
    }
    default:
      return "void"
  }
}

/** Lee un stat numérico del boxscore de un equipo por etiqueta. */
function boxStat(team: any, ...labels: string[]): number | null {
  const stats: any[] = team?.statistics ?? []
  for (const lab of labels) {
    const s = stats.find((x) => (x.label ?? x.name ?? "").toLowerCase() === lab.toLowerCase())
    if (!s) continue
    const v = s.displayValue ?? s.value
    if (v == null) continue
    const n = parseFloat(String(v).replace("%", "").replace(",", ""))
    if (isFinite(n)) return n
  }
  return null
}

interface FinalScore {
  completed: boolean
  homeScore: number
  awayScore: number
  box: BoxTotals
}

/**
 * Obtiene el resultado FINAL real de un partido desde ESPN (summary endpoint).
 * Devuelve null si la API falla; { completed:false } si aún no terminó.
 */
async function fetchFinalFromEspn(slug: string, matchId: string): Promise<FinalScore | null> {
  try {
    const r = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/${encodeURIComponent(slug)}/summary?event=${encodeURIComponent(matchId)}`,
      { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(8000) },
    )
    if (!r.ok) return null
    const data = await r.json()

    const comp = data?.header?.competitions?.[0]
    const completed = !!comp?.status?.type?.completed
    const competitors: any[] = comp?.competitors ?? []
    const home = competitors.find((c) => c.homeAway === "home")
    const away = competitors.find((c) => c.homeAway === "away")
    const homeScore = parseInt(home?.score ?? "0") || 0
    const awayScore = parseInt(away?.score ?? "0") || 0

    // Totales de boxscore (corners + cards) sumando ambos equipos, si están.
    const teams: any[] = data?.boxscore?.teams ?? []
    let corners: number | null = null
    let cards: number | null = null
    for (const t of teams) {
      const ck = boxStat(t, "Corner Kicks")
      const yc = boxStat(t, "Yellow Cards")
      const rc = boxStat(t, "Red Cards")
      if (ck != null) corners = (corners ?? 0) + ck
      if (yc != null || rc != null) cards = (cards ?? 0) + (yc ?? 0) + (rc ?? 0)
    }

    return { completed, homeScore, awayScore, box: { corners, cards } }
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. settleGroundTruth — verdad terreno real
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Busca predicciones PENDIENTES cuyo kickoff ya pasó (con margen) y resuelve su
 * resultado contra ESPN. Agrupa por partido para hacer 1 sola llamada por match.
 */
export async function settleGroundTruth(): Promise<SettleResult> {
  const out: SettleResult = { scanned: 0, settled: 0, void: 0, stillPending: 0, errors: [] }
  const sb = createServiceClient()

  const cutoff = new Date(Date.now() - ML.SETTLE_GRACE_MIN * 60_000).toISOString()
  const { data: pending, error } = await sb
    .from("predictions_log")
    .select("id, match_id, league, market, pick, kickoff_iso")
    .eq("status", "pending")
    .lte("kickoff_iso", cutoff)
    .order("kickoff_iso", { ascending: true })
    .limit(ML.SETTLE_BATCH)

  if (error) {
    out.errors.push(`query pending: ${error.message}`)
    return out
  }
  out.scanned = pending?.length ?? 0
  if (!pending || pending.length === 0) return out

  // Agrupa por (league, match_id) para 1 fetch por partido
  const byMatch = new Map<string, { slug: string; matchId: string; rows: any[] }>()
  for (const row of pending) {
    const key = `${row.league}::${row.match_id}`
    if (!byMatch.has(key)) byMatch.set(key, { slug: row.league, matchId: row.match_id, rows: [] })
    byMatch.get(key)!.rows.push(row)
  }

  for (const { slug, matchId, rows } of byMatch.values()) {
    const final = await fetchFinalFromEspn(slug, matchId)
    if (!final) { out.stillPending += rows.length; continue }
    if (!final.completed) { out.stillPending += rows.length; continue }

    for (const row of rows) {
      const verdict = settleMarket(row.market, row.pick, final.homeScore, final.awayScore, final.box)
      const status = verdict === "void" ? "void" : verdict
      const { error: upErr } = await sb
        .from("predictions_log")
        .update({
          status,
          home_score: final.homeScore,
          away_score: final.awayScore,
          settled_at: new Date().toISOString(),
        })
        .eq("id", row.id)
      if (upErr) { out.errors.push(`update ${row.id}: ${upErr.message}`); continue }
      if (verdict === "void") out.void++
      else out.settled++
    }
  }

  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. computeBrierAndAccuracy — métricas reales vs. resultado
// ─────────────────────────────────────────────────────────────────────────────

interface SettledRow {
  league: string
  market: string
  model_prob: number
  odds: number | null
  status: "won" | "lost"
  context?: string | null
}

function brierFor(rows: SettledRow[]): PerfRow | null {
  if (rows.length === 0) return null
  let sumSq = 0, wins = 0, sumProb = 0, correct = 0
  let stake = 0, returned = 0
  for (const r of rows) {
    const outcome = r.status === "won" ? 1 : 0
    const prob = clamp(Number(r.model_prob) || 0, 0, 1)
    sumSq += (prob - outcome) ** 2
    sumProb += prob
    wins += outcome
    // accuracy: ¿el modelo "se inclinó" correctamente? (prob>=0.5 ↔ outcome)
    if ((prob >= 0.5 ? 1 : 0) === outcome) correct++
    // ROI flat-stake (1u por pick) cuando hay cuota
    if (r.odds && r.odds > 1) {
      stake += 1
      if (outcome === 1) returned += r.odds
    }
  }
  const n = rows.length
  return {
    scopeType: "global",
    scope: "all",
    samples: n,
    wins,
    accuracy: Math.round((correct / n) * 1000) / 1000,
    brierScore: Math.round((sumSq / n) * 10000) / 10000,
    avgModelProb: Math.round((sumProb / n) * 10000) / 10000,
    avgActual: Math.round((wins / n) * 10000) / 10000,
    roi: stake > 0 ? Math.round(((returned - stake) / stake) * 1000) / 1000 : 0,
  }
}

/**
 * Calcula Brier + Accuracy para los scopes global / por-liga / por-mercado sobre
 * la ventana de evaluación, y hace UPSERT en `model_performance` (clave única
 * as_of_date + scope_type + scope). Devuelve las filas calculadas.
 */
export async function computeBrierAndAccuracy(asOfDate?: string): Promise<PerfRow[]> {
  const sb = createServiceClient()
  const since = new Date(Date.now() - ML.WINDOW_DAYS * 86_400_000).toISOString()
  const today = asOfDate ?? new Date().toISOString().slice(0, 10)

  const { data, error } = await sb
    .from("predictions_log")
    .select("league, market, model_prob, odds, status, context")
    .in("status", ["won", "lost"])
    .gte("settled_at", since)
  if (error) {
    console.warn("[ml] computeBrier query error:", error.message)
    return []
  }
  const rows = (data ?? []) as SettledRow[]
  if (rows.length === 0) return []

  const results: PerfRow[] = []

  // ── AISLAMIENTO POR CONTEXTO ──────────────────────────────────────────────
  // Separamos los partidos de clubes (calibración por defecto) de los
  // internacionales. Los scopes global/league/market se computan SÓLO sobre
  // clubes — así un amistoso loco no contamina el ajuste de pesos del
  // Brasileirão. Por su lado, cada contexto recibe su propio peso global.
  const clubRows = rows.filter((r) => (r.context ?? "club") === "club")
  const intlRows = rows.filter((r) => (r.context ?? "club") !== "club")

  // Global (solo clubes — calibración base del motor)
  const g = brierFor(clubRows)
  if (g) results.push({ ...g, scopeType: "global", scope: "all" })

  // Por liga (solo clubes)
  const byLeague = new Map<string, SettledRow[]>()
  for (const r of clubRows) {
    if (!byLeague.has(r.league)) byLeague.set(r.league, [])
    byLeague.get(r.league)!.push(r)
  }
  for (const [league, lr] of byLeague) {
    const p = brierFor(lr)
    if (p) results.push({ ...p, scopeType: "league", scope: league })
  }

  // Por mercado (solo clubes — los mercados internacionales tienen su propio scope)
  const byMarket = new Map<string, SettledRow[]>()
  for (const r of clubRows) {
    if (!byMarket.has(r.market)) byMarket.set(r.market, [])
    byMarket.get(r.market)!.push(r)
  }
  for (const [market, mr] of byMarket) {
    const p = brierFor(mr)
    if (p) results.push({ ...p, scopeType: "market", scope: market })
  }

  // ── Por contexto ──────────────────────────────────────────────────────────
  // Un scope por cada valor de `context` (incluye club, intl_friendly,
  // intl_competitive). Esto alimenta `team_form_weights(scope_type='context')`
  // y permite que el motor aplique un multiplicador específico para
  // selecciones SIN afectar al fútbol de clubes.
  const byContext = new Map<string, SettledRow[]>()
  for (const r of rows) {
    const ctx = r.context ?? "club"
    if (!byContext.has(ctx)) byContext.set(ctx, [])
    byContext.get(ctx)!.push(r)
  }
  for (const [ctx, cr] of byContext) {
    const p = brierFor(cr)
    if (p) results.push({ ...p, scopeType: "context", scope: ctx })
  }

  // Por mercado dentro de internacionales (clave compuesta) — informativo
  // para auditoría. No se usa todavía como peso pero queda disponible.
  if (intlRows.length > 0) {
    const byIntlMarket = new Map<string, SettledRow[]>()
    for (const r of intlRows) {
      const key = `intl::${r.market}`
      if (!byIntlMarket.has(key)) byIntlMarket.set(key, [])
      byIntlMarket.get(key)!.push(r)
    }
    for (const [k, mr] of byIntlMarket) {
      const p = brierFor(mr)
      if (p) results.push({ ...p, scopeType: "market", scope: k })
    }
  }

  // Upsert (clave única: as_of_date, scope_type, scope)
  const payload = results.map((r) => ({
    as_of_date: today,
    scope_type: r.scopeType,
    scope: r.scope,
    samples: r.samples,
    wins: r.wins,
    accuracy: r.accuracy,
    brier_score: r.brierScore,
    avg_model_prob: r.avgModelProb,
    avg_actual: r.avgActual,
    roi: r.roi,
  }))
  const { error: upErr } = await sb
    .from("model_performance")
    .upsert(payload, { onConflict: "as_of_date,scope_type,scope" })
  if (upErr) console.warn("[ml] model_performance upsert error:", upErr.message)

  return results
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. adjustTeamFormWeights — auto-ajuste de pesos por calibración
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A partir de las métricas calculadas, ajusta los multiplicadores de
 * `team_form_weights` para los scopes liga y mercado:
 *
 *   targetWeight = clamp(avg_actual / avg_model_prob, 0.5, 1.5)
 *
 * Es decir: si el modelo predijo 60% pero solo acertó 45% en esa liga, está
 * sobreestimando → bajamos su confianza (peso < 1). Si predijo 50% y acertó 55%,
 * subimos (peso > 1). El movimiento se limita a MAX_WEIGHT_STEP por ejecución.
 * Solo actúa con muestras suficientes (anti-overfitting).
 */
export async function adjustTeamFormWeights(perf?: PerfRow[]): Promise<number> {
  const sb = createServiceClient()
  const rows = perf ?? (await computeBrierAndAccuracy())
  if (!rows.length) return 0

  // Pesos actuales para mover de forma incremental
  const { data: current } = await sb
    .from("team_form_weights")
    .select("scope_type, scope_key, weight")
  const currentMap = new Map<string, number>()
  for (const w of current ?? []) currentMap.set(`${w.scope_type}::${w.scope_key}`, Number(w.weight) || 1.0)

  const updates: any[] = []
  for (const r of rows) {
    if (r.scopeType === "global") continue                       // global no tiene peso propio
    if (r.samples < ML.MIN_SAMPLES_FOR_WEIGHT) continue          // muy poca muestra
    if (r.avgModelProb <= 0.01) continue

    const scopeType: WeightScopeType = r.scopeType === "league" ? "league" : "market"
    const key = `${scopeType}::${r.scope}`
    const cur = currentMap.get(key) ?? 1.0

    const target = clamp(r.avgActual / r.avgModelProb, ML.WEIGHT_MIN, ML.WEIGHT_MAX)
    // Movimiento limitado hacia el target
    const delta = clamp(target - cur, -ML.MAX_WEIGHT_STEP, ML.MAX_WEIGHT_STEP)
    const next = clamp(Math.round((cur + delta) * 10000) / 10000, ML.WEIGHT_MIN, ML.WEIGHT_MAX)
    if (Math.abs(next - cur) < 0.0005) continue                  // sin cambio relevante

    const reason =
      `cal: pred ${(r.avgModelProb * 100).toFixed(0)}% vs real ${(r.avgActual * 100).toFixed(0)}% ` +
      `(acc ${(r.accuracy * 100).toFixed(0)}%, brier ${r.brierScore.toFixed(3)}, n=${r.samples}) ` +
      `→ ${cur.toFixed(2)}→${next.toFixed(2)}`

    updates.push({
      scope_type: scopeType,
      scope_key: r.scope,
      weight: next,
      samples: r.samples,
      brier_score: r.brierScore,
      reason,
      updated_at: new Date().toISOString(),
    })
  }

  if (!updates.length) return 0
  const { error } = await sb
    .from("team_form_weights")
    .upsert(updates, { onConflict: "scope_type,scope_key" })
  if (error) { console.warn("[ml] team_form_weights upsert error:", error.message); return 0 }
  return updates.length
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. getTeamFormWeight — consulta OBLIGATORIA antes de emitir probabilidad
// ─────────────────────────────────────────────────────────────────────────────

// Cache en memoria (5 min) para el hot-path del motor de análisis.
let weightCache: Map<string, number> | null = null
let weightCacheUntil = 0
const WEIGHT_CACHE_TTL_MS = 5 * 60_000

async function loadWeightCache(): Promise<Map<string, number>> {
  if (weightCache && Date.now() < weightCacheUntil) return weightCache
  const map = new Map<string, number>()
  try {
    const sb = createServiceClient()
    const { data } = await sb.from("team_form_weights").select("scope_type, scope_key, weight")
    for (const w of data ?? []) map.set(`${w.scope_type}::${w.scope_key}`, Number(w.weight) || 1.0)
  } catch (e: any) {
    console.warn("[ml] loadWeightCache failed:", e?.message ?? e)
  }
  weightCache = map
  weightCacheUntil = Date.now() + WEIGHT_CACHE_TTL_MS
  return map
}

/**
 * Devuelve el multiplicador de calibración aprendido para un scope.
 * Default 1.0 (sin sesgo) si no hay dato. NUNCA lanza.
 */
export async function getTeamFormWeight(scopeType: WeightScopeType, scopeKey: string): Promise<number> {
  const map = await loadWeightCache()
  return map.get(`${scopeType}::${scopeKey}`) ?? 1.0
}

/**
 * Peso combinado liga × mercado (× equipo × context opcional) para aplicar a
 * una predicción concreta. Es la forma recomendada de consultar el aprendizaje
 * antes de emitir una probabilidad nueva.
 *
 * El parámetro `context` activa la dimensión de aislamiento de selecciones:
 * un partido marcado como `international_friendly` aplicará el peso aprendido
 * de amistosos SIN tocar el peso aprendido de clubes.
 */
export async function getCombinedFormWeight(args: {
  league?: string
  market?: string
  team?: string
  context?: MatchContext | string
}): Promise<number> {
  const map = await loadWeightCache()
  const wl = args.league  ? map.get(`league::${args.league}`)   ?? 1.0 : 1.0
  const wm = args.market  ? map.get(`market::${args.market}`)   ?? 1.0 : 1.0
  const wt = args.team    ? map.get(`team::${args.team}`)       ?? 1.0 : 1.0
  const wc = args.context ? map.get(`context::${args.context}`) ?? 1.0 : 1.0
  // Media geométrica suave (raíz cuarta cuando hay context, cúbica si no)
  // para no amplificar en exceso al combinar scopes.
  const factors = args.context ? wl * wm * wt * wc : wl * wm * wt
  const root = args.context ? 4 : 3
  const combined = Math.pow(factors, 1 / root)
  return clamp(Math.round(combined * 10000) / 10000, ML.WEIGHT_MIN, ML.WEIGHT_MAX)
}

/** Fuerza el refresco del cache de pesos (tras un ajuste del cron). */
export function invalidateWeightCache(): void {
  weightCache = null
  weightCacheUntil = 0
}

// ─────────────────────────────────────────────────────────────────────────────
// Orquestador — usado por el cron de 00:00 y 12:00
// ─────────────────────────────────────────────────────────────────────────────

export interface MlCycleResult {
  ranAt: string
  settle: SettleResult
  performance: PerfRow[]
  weightsAdjusted: number
}

/**
 * Ejecuta el ciclo completo: liquidar verdad-terreno → recalcular Brier/accuracy
 * → ajustar pesos. Es lo que invoca el cron.
 */
export async function runMlCycle(asOfDate?: string): Promise<MlCycleResult> {
  const settle = await settleGroundTruth()
  const performance = await computeBrierAndAccuracy(asOfDate)
  const weightsAdjusted = await adjustTeamFormWeights(performance)
  invalidateWeightCache()
  return { ranAt: new Date().toISOString(), settle, performance, weightsAdjusted }
}
