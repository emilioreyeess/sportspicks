/**
 * Motor de análisis ZERO-HALLUCINATION — SportsPicks Analytics (STEP 4)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Calcula probabilidades reales a partir EXCLUSIVAMENTE de datos verificables de
 * ESPN (forma reciente, goles a favor/contra, corners y tarjetas de boxscore).
 * Si un dato no existe, el campo se devuelve como `null` → el frontend muestra
 * "N/A". NUNCA se inventa un número.
 *
 * Modelo:
 *   · Goles esperados (λ) = mezcla de ataque propio y defensa rival, con ventaja
 *     de localía moderada.
 *   · 1X2, Over/Under y BTTS se derivan de una matriz de marcadores Poisson.
 *   · Corners y tarjetas se estiman con Poisson sobre las medias reales por
 *     partido (solo si hay muestras de boxscore).
 *   · Antes de emitir cada probabilidad se consulta `team_form_weights`
 *     (getCombinedFormWeight) y se calibra el resultado hacia su baseline.
 */

import { getCombinedFormWeight } from "@/lib/learning/supabase-ml"
import { cacheFetch, CK, TTL } from "@/lib/kv"

// ─────────────────────────────────────────────────────────────────────────────
// Utilidades Poisson
// ─────────────────────────────────────────────────────────────────────────────

function poissonPmf(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0
  let logp = -lambda + k * Math.log(lambda)
  for (let i = 2; i <= k; i++) logp -= Math.log(i)
  return Math.exp(logp)
}

/** Matriz de probabilidad de marcador (0..max goles por equipo). */
function scoreMatrix(lh: number, la: number, max = 10): number[][] {
  const ph = Array.from({ length: max + 1 }, (_, i) => poissonPmf(i, lh))
  const pa = Array.from({ length: max + 1 }, (_, i) => poissonPmf(i, la))
  const m: number[][] = []
  for (let i = 0; i <= max; i++) {
    m[i] = []
    for (let j = 0; j <= max; j++) m[i][j] = ph[i] * pa[j]
  }
  return m
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

const pct = (x: number) => Math.round(clamp(x, 0, 1) * 1000) / 10   // 0..100, 1 decimal

/**
 * Calibración: acerca una probabilidad cruda a su baseline según el peso
 * aprendido. weight<1 (modelo históricamente sobreconfiado) → menos extremo;
 * weight>1 → más confiado. baseline 0.5 para binarios.
 */
function calibrate(raw: number, baseline: number, weight: number): number {
  return clamp(baseline + (raw - baseline) * weight, 0.001, 0.999)
}

// ─────────────────────────────────────────────────────────────────────────────
// Datos de equipo desde ESPN (verificables)
// ─────────────────────────────────────────────────────────────────────────────

export interface TeamModel {
  id: string
  name: string
  played: number
  gfpg: number | null          // goles a favor por partido
  gapg: number | null          // goles en contra por partido
  bttsPct: number | null       // %
  over25Pct: number | null     // %
  form: string[]               // últimos resultados W/D/L
  cornersForAvg: number | null
  cornersAgainstAvg: number | null
  cardsAvg: number | null      // amarillas+rojas por partido (propio)
  advSamples: number
}

function parseScore(s: any): number {
  if (s == null) return 0
  if (typeof s === "number") return s
  if (typeof s === "string") return parseInt(s) || 0
  if (typeof s === "object" && s.displayValue) return parseInt(s.displayValue) || 0
  return 0
}

function getStat(team: any, ...labels: string[]): number | null {
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

/**
 * Construye el modelo de un equipo a partir de su calendario ESPN + los
 * boxscores de sus últimos partidos. Todo real; nulls donde no haya dato.
 */
async function _fetchTeamModelRaw(slug: string, teamId: string): Promise<TeamModel | null> {
  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/${encodeURIComponent(slug)}/teams/${encodeURIComponent(teamId)}/schedule`,
      { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(9000) },
    )
    if (!res.ok) return null
    const data = await res.json()

    const teamName = data?.team?.displayName ?? "Equipo"
    const events: any[] = data?.events ?? []
    const completed = events.filter((ev) => ev.competitions?.[0]?.status?.type?.completed)

    let gf = 0, ga = 0, btts = 0, over25 = 0
    const form: string[] = []
    for (const ev of completed) {
      const comp = ev.competitions[0]
      const me = comp.competitors?.find((c: any) => String(c.team?.id) === String(teamId))
      const opp = comp.competitors?.find((c: any) => String(c.team?.id) !== String(teamId))
      if (!me || !opp) continue
      const myScore = parseScore(me.score)
      const oppScore = parseScore(opp.score)
      gf += myScore; ga += oppScore
      if (myScore > 0 && oppScore > 0) btts++
      if (myScore + oppScore > 2) over25++
      if (me.winner) form.push("W")
      else if (opp.winner) form.push("L")
      else form.push("D")
    }

    const played = form.length

    // Avanzadas (corners/cards) desde boxscores de los últimos 6 partidos.
    const recent = [...completed]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6)

    const summaries = await Promise.all(recent.map(async (ev) => {
      try {
        const r = await fetch(
          `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/summary?event=${ev.id}`,
          { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(7000) },
        )
        if (!r.ok) return null
        return await r.json()
      } catch { return null }
    }))

    let cF = 0, cA = 0, cards = 0, samples = 0
    for (const summary of summaries) {
      if (!summary) continue
      const teams: any[] = summary?.boxscore?.teams ?? []
      const me = teams.find((t) => String(t.team?.id) === String(teamId))
      const opp = teams.find((t) => String(t.team?.id) !== String(teamId))
      if (!me) continue
      const ck = getStat(me, "Corner Kicks")
      const ckA = getStat(opp, "Corner Kicks")
      const yc = getStat(me, "Yellow Cards")
      const rc = getStat(me, "Red Cards")
      let had = false
      if (ck != null) { cF += ck; had = true }
      if (ckA != null) cA += ckA
      if (yc != null) cards += yc
      if (rc != null) cards += rc
      if (had) samples++
    }

    return {
      id: String(teamId),
      name: teamName,
      played,
      gfpg: played ? gf / played : null,
      gapg: played ? ga / played : null,
      bttsPct: played ? Math.round((btts / played) * 100) : null,
      over25Pct: played ? Math.round((over25 / played) * 100) : null,
      form: form.slice(-6),
      cornersForAvg: samples ? Math.round((cF / samples) * 10) / 10 : null,
      cornersAgainstAvg: samples ? Math.round((cA / samples) * 10) / 10 : null,
      cardsAvg: samples ? Math.round((cards / samples) * 10) / 10 : null,
      advSamples: samples,
    }
  } catch {
    return null
  }
}

/**
 * Cached wrapper around _fetchTeamModelRaw.
 * Team season stats change at most once per matchday → 10 min TTL is safe.
 * Multiple users opening the same match analysis share one ESPN call set.
 */
export async function fetchTeamModel(slug: string, teamId: string): Promise<TeamModel | null> {
  return cacheFetch(
    CK.teamModel(slug, teamId),
    TTL.TEAM_MODEL,
    () => _fetchTeamModelRaw(slug, teamId),
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Análisis del partido
// ─────────────────────────────────────────────────────────────────────────────

export interface OuLine {
  line: number
  over: number | null   // % o null (N/A)
  under: number | null
  estimate: number | null
}

export interface MatchAnalysis {
  home: TeamModel | null
  away: TeamModel | null
  expectedGoalsHome: number | null
  expectedGoalsAway: number | null
  // 1X2
  prob1: number | null
  probX: number | null
  prob2: number | null
  // BTTS
  bttsYes: number | null
  bttsNo: number | null
  // Goles
  over15: number | null
  under15: number | null
  over25: number | null
  under25: number | null
  goalsLine: number | null
  goalsEstimate: number | null
  // Corners / tarjetas (estimación O/U)
  corners: OuLine | null
  cards: OuLine | null
  /** Selección destacada por mercado (para registrar en el ML loop). */
  picks: { market: string; pick: string; prob: number }[]
  dataComplete: boolean
  /** True si hay volumen de datos suficiente para emitir probabilidades. */
  dataSufficient: boolean
  /** Mensaje legible para la UI cuando dataSufficient === false. */
  dataIssue: string | null
}

/** Mínimo de partidos jugados por equipo para que el motor emita probabilidades.
 *  Por debajo de esto (amistosos sin historia, debutantes de copa, etc.) el motor
 *  omite el partido de forma controlada en lugar de inventar números. */
export const MIN_GAMES_FOR_ANALYSIS = 3

const HOME_ADV = 1.10
const AWAY_ADJ = 0.95

/** Línea O/U: redondea la estimación a la .5 más cercana inferior + 0.5. */
function ouLineFor(estimate: number): number {
  return Math.max(0.5, Math.round(estimate - 0.5) + 0.5)
}

/** Prob. de superar `line` (entero+0.5) en una Poisson de media `lambda`. */
function poissonOver(line: number, lambda: number): number {
  // P(X > line) = 1 - P(X <= floor(line))
  const kMax = Math.floor(line)
  let cdf = 0
  for (let k = 0; k <= kMax; k++) cdf += poissonPmf(k, lambda)
  return clamp(1 - cdf, 0, 1)
}

export async function analyzeMatch(args: {
  league: string
  home: TeamModel | null
  away: TeamModel | null
}): Promise<MatchAnalysis> {
  const { league, home, away } = args

  // Pesos aprendidos por mercado (consulta OBLIGATORIA antes de emitir prob.)
  const [w1x2, wbtts, wgoals, wcorners, wcards] = await Promise.all([
    getCombinedFormWeight({ league, market: "1x2" }),
    getCombinedFormWeight({ league, market: "btts" }),
    getCombinedFormWeight({ league, market: "goals_ou" }),
    getCombinedFormWeight({ league, market: "corners_ou" }),
    getCombinedFormWeight({ league, market: "cards_ou" }),
  ])

  const out: MatchAnalysis = {
    home, away,
    expectedGoalsHome: null, expectedGoalsAway: null,
    prob1: null, probX: null, prob2: null,
    bttsYes: null, bttsNo: null,
    over15: null, under15: null, over25: null, under25: null,
    goalsLine: null, goalsEstimate: null,
    corners: null, cards: null,
    picks: [],
    dataComplete: false,
    dataSufficient: false,
    dataIssue: null,
  }

  // ── Guarda de volumen de datos ────────────────────────────────────────────
  // Amistosos, debuts de copa o selecciones sin historial reciente entran aquí
  // con `played < MIN_GAMES_FOR_ANALYSIS`. En lugar de emitir un Poisson sobre
  // 1-2 muestras (que sería literalmente inventarnos un pronóstico), el motor
  // se planta y devuelve un MatchAnalysis vacío con `dataIssue` explicado.
  const homePlayed = home?.played ?? 0
  const awayPlayed = away?.played ?? 0
  if (!home || !away) {
    out.dataIssue = "No hay datos de uno o ambos equipos en ESPN."
    return out
  }
  if (homePlayed < MIN_GAMES_FOR_ANALYSIS || awayPlayed < MIN_GAMES_FOR_ANALYSIS) {
    out.dataIssue = `Volumen de datos insuficiente para un pronóstico fiable (${home.name}: ${homePlayed} partidos · ${away.name}: ${awayPlayed} partidos · mínimo ${MIN_GAMES_FOR_ANALYSIS}).`
    return out
  }

  // ── Goles / 1X2 / BTTS / O/U (requiere gfpg+gapg de ambos) ────────────────
  if (home?.gfpg != null && home?.gapg != null && away?.gfpg != null && away?.gapg != null) {
    const lh = clamp(((home.gfpg + away.gapg) / 2) * HOME_ADV, 0.15, 6)
    const la = clamp(((away.gfpg + home.gapg) / 2) * AWAY_ADJ, 0.15, 6)
    out.expectedGoalsHome = Math.round(lh * 100) / 100
    out.expectedGoalsAway = Math.round(la * 100) / 100

    const m = scoreMatrix(lh, la, 10)
    let pHome = 0, pDraw = 0, pAway = 0
    for (let i = 0; i <= 10; i++) for (let j = 0; j <= 10; j++) {
      if (i > j) pHome += m[i][j]
      else if (i === j) pDraw += m[i][j]
      else pAway += m[i][j]
    }
    // Calibración 1X2 (baseline 1/3) y renormalización
    let c1 = calibrate(pHome, 1 / 3, w1x2)
    let cX = calibrate(pDraw, 1 / 3, w1x2)
    let c2 = calibrate(pAway, 1 / 3, w1x2)
    const s = c1 + cX + c2
    c1 /= s; cX /= s; c2 /= s
    out.prob1 = pct(c1); out.probX = pct(cX); out.prob2 = pct(c2)

    // BTTS
    const bttsYesRaw = (1 - Math.exp(-lh)) * (1 - Math.exp(-la))
    const by = calibrate(bttsYesRaw, 0.5, wbtts)
    out.bttsYes = pct(by); out.bttsNo = pct(1 - by)

    // Total de goles ~ Poisson(lh+la)
    const lt = lh + la
    out.goalsEstimate = Math.round(lt * 100) / 100
    const o15 = calibrate(poissonOver(1.5, lt), 0.5, wgoals)
    const o25 = calibrate(poissonOver(2.5, lt), 0.5, wgoals)
    out.over15 = pct(o15); out.under15 = pct(1 - o15)
    out.over25 = pct(o25); out.under25 = pct(1 - o25)
    out.goalsLine = 2.5

    // Picks destacados (favorito 1X2, lean BTTS, lean O/U 2.5)
    const best1x2 = [
      { pick: "Home", prob: c1 }, { pick: "Draw", prob: cX }, { pick: "Away", prob: c2 },
    ].sort((a, b) => b.prob - a.prob)[0]
    out.picks.push({ market: "1x2", pick: best1x2.pick, prob: best1x2.prob })
    out.picks.push({ market: "btts", pick: by >= 0.5 ? "Yes" : "No", prob: Math.max(by, 1 - by) })
    out.picks.push({ market: "goals_ou", pick: o25 >= 0.5 ? "Over 2.5" : "Under 2.5", prob: Math.max(o25, 1 - o25) })
  }

  // ── Corners O/U (requiere medias de ambos) ───────────────────────────────
  if (home?.cornersForAvg != null && away?.cornersForAvg != null) {
    // Estimación de corners totales: ataque propio + corners concedidos rival.
    const homeC = home.cornersAgainstAvg != null
      ? (home.cornersForAvg + away.cornersAgainstAvg) / 2 + (home.cornersForAvg) / 2
      : home.cornersForAvg
    const awayC = away.cornersAgainstAvg != null
      ? (away.cornersForAvg + home.cornersAgainstAvg) / 2 + (away.cornersForAvg) / 2
      : away.cornersForAvg
    const estimate = clamp((homeC + awayC) / 2 + (home.cornersForAvg + away.cornersForAvg) / 2, 3, 18)
    const line = ouLineFor(estimate)
    const overRaw = poissonOver(line, estimate)
    const over = calibrate(overRaw, 0.5, wcorners)
    out.corners = {
      line,
      estimate: Math.round(estimate * 10) / 10,
      over: pct(over),
      under: pct(1 - over),
    }
    out.picks.push({ market: "corners_ou", pick: `${over >= 0.5 ? "Over" : "Under"} ${line}`, prob: Math.max(over, 1 - over) })
  } else {
    out.corners = null   // N/A
  }

  // ── Tarjetas O/U (requiere medias de ambos) ──────────────────────────────
  if (home?.cardsAvg != null && away?.cardsAvg != null) {
    const estimate = clamp(home.cardsAvg + away.cardsAvg, 1, 12)
    const line = ouLineFor(estimate)
    const overRaw = poissonOver(line, estimate)
    const over = calibrate(overRaw, 0.5, wcards)
    out.cards = {
      line,
      estimate: Math.round(estimate * 10) / 10,
      over: pct(over),
      under: pct(1 - over),
    }
    out.picks.push({ market: "cards_ou", pick: `${over >= 0.5 ? "Over" : "Under"} ${line}`, prob: Math.max(over, 1 - over) })
  } else {
    out.cards = null     // N/A
  }

  out.dataComplete = out.prob1 != null && out.corners != null && out.cards != null
  // dataSufficient = el motor pudo emitir al menos 1X2 (gfpg+gapg de ambos
  // estaban disponibles). Corners/cards pueden seguir siendo null sin invalidar
  // el análisis: la UI los muestra como N/A.
  out.dataSufficient = out.prob1 != null
  if (!out.dataSufficient && out.dataIssue == null) {
    out.dataIssue = "Faltan goles a favor o en contra de uno de los equipos en ESPN."
  }
  return out
}
