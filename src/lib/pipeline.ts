/**
 * PIPELINE DIARIO — corre a las 00:00 y al arrancar el servidor.
 *
 * 1. Descarga partidos + cuotas reales (ESPN/DraftKings) de las 5 grandes ligas
 * 2. Descarga clasificaciones reales y forma reciente
 * 3. Corre el modelo Poisson ajustado por rival + motivación
 * 4. Genera value picks, combinadas (3 modos × 6 ligas) y picks de retos
 * 5. Valida y guarda en el store → las rutas /api/* responden al instante
 *
 * Todo con datos reales. Nada se inventa.
 */

import {
  ALL_SLUGS, LEAGUE_NAMES, clamp, impliedPct, fetchJSON,
  fetchStandings, classifyMotivation, extractOdds, fetchTeamForm, modelMatch, handicapProb,
  type LeagueTable, type Motivation, type RealOdds, type TeamForm, type ModelOut,
} from "@/lib/engine"
import { evaluatePick, type EvalCandidate, type EvalMatch, type PickEvaluation } from "@/lib/decision-engine"
import { recordPublishedPicks, preloadLearningCache, type PickRecord } from "@/lib/learning"
import {
  getStore, setStatus, addLog, recordError, setDailyResults, setNextRun, isFresh,
  setYesterdayResults,
} from "@/lib/store"

const LEAGUE_MAP: Record<string, string> = {
  "1": "esp.1", "2": "eng.1", "3": "ger.1", "4": "ita.1", "5": "fra.1",
}

// ─── Value engine — umbrales (calibrados para 3-8 picks/día manteniendo calidad) ─
const MIN_EDGE = 3
const MAX_EDGE = 15
const MIN_ODD = 1.40
const QUALITY_GATE = 56   // raised from 52 — stricter quality bar
const MAX_PICKS = 10
// Minimum odds for a handicap pick where the selected team is a clear underdog 1X2
const MIN_ODD_HANDICAP_UNDERDOG = 1.75
/** Mínimo de partidos jugados por equipo (ambos) para que el motor evalúe un
 *  partido. Si cualquiera de los dos tiene menos historia que esto (amistosos
 *  pre-temporada, debutantes de copa, equipos recién ascendidos sin muestra),
 *  el partido se omite del pipeline de forma controlada — nunca emitimos un
 *  pronóstico Poisson sobre 1-2 muestras. */
const MIN_GAMES_FOR_PICK = 4

// ─── Tipos ──────────────────────────────────────────────────────────────────

interface MatchModel {
  id: string; slug: string
  homeName: string; awayName: string
  homeId: string; awayId: string
  kickoff: string
  odds: RealOdds
  home: TeamForm; away: TeamForm
  homeMotiv: Motivation; awayMotiv: Motivation
  mdl: ModelOut
}

interface DailyData {
  matches: MatchModel[]
  leagueAvg: number
  fetchedAt: string
}

type OddKey = "home" | "draw" | "away" | "over25" | "under25" | "spreadHome" | "spreadAway"

// ─── Fase 1-4: descarga de datos reales ─────────────────────────────────────

async function fetchDailyData(): Promise<DailyData> {
  // Clasificaciones + marcadores de las 5 ligas en paralelo
  const tables = new Map<string, LeagueTable | null>()
  await Promise.all(ALL_SLUGS.map(async (slug) => {
    tables.set(slug, await fetchStandings(slug))
  }))

  interface RawMatch {
    ev: any; slug: string
    homeName: string; awayName: string; homeId: string; awayId: string
    odds: RealOdds
  }
  const raw: RawMatch[] = []

  for (const slug of ALL_SLUGS) {
    const data = await fetchJSON(`https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard`)
    for (const ev of data?.events ?? []) {
      const comp = ev.competitions?.[0]
      if (!comp || comp.status?.type?.completed) continue
      const home = comp.competitors?.find((c: any) => c.homeAway === "home")
      const away = comp.competitors?.find((c: any) => c.homeAway === "away")
      if (!home?.team?.id || !away?.team?.id) continue
      // Validación: fecha de inicio válida
      if (!ev.date || isNaN(new Date(ev.date).getTime())) continue
      // Solo partidos de HOY — descartar pasados Y futuros (días siguientes)
      const kickoffDate = ev.date?.slice(0, 10)
      const now = new Date()
      const todayUTC = now.toISOString().split("T")[0]
      // Allow today in UTC and also today-1 in case of timezone offset (UTC vs local)
      const yesterdayUTC = new Date(Date.now() - 86400000).toISOString().split("T")[0]
      const tomorrowUTC = new Date(Date.now() + 86400000).toISOString().split("T")[0]
      // Only accept TODAY (strict)
      if (!kickoffDate || kickoffDate === yesterdayUTC || kickoffDate >= tomorrowUTC) continue
      const odds = extractOdds(comp)
      if (!odds) continue
      raw.push({
        ev, slug,
        homeName: home.team.displayName, awayName: away.team.displayName,
        homeId: String(home.team.id), awayId: String(away.team.id),
        odds,
      })
    }
  }

  // Forma reciente real de cada equipo (acotado para limitar llamadas)
  // Con 14 ligas necesitamos cuota más amplia para captar oportunidades globales
  const queue = raw.slice(0, 56)
  interface WithForm extends RawMatch { home: TeamForm; away: TeamForm }
  const withForm: WithForm[] = []
  let skippedNoData = 0
  await Promise.all(queue.map(async (m) => {
    const [home, away] = await Promise.all([
      fetchTeamForm(m.slug, m.homeId),
      fetchTeamForm(m.slug, m.awayId),
    ])
    if (!home || !away) { skippedNoData++; return }
    // SKIP CONTROLADO: si alguno de los dos equipos no tiene suficientes
    // partidos jugados, el motor no puede calcular un Edge fiable. Se omite
    // sin romper el pipeline. Esto cubre el caso "amistosos sin historial"
    // y "debutantes de copa".
    if (home.gamesPlayed < MIN_GAMES_FOR_PICK || away.gamesPlayed < MIN_GAMES_FOR_PICK) {
      skippedNoData++
      return
    }
    withForm.push({ ...m, home, away })
  }))
  if (skippedNoData > 0) {
    addLog(`⏭️  ${skippedNoData} partido(s) omitido(s) por volumen de datos insuficiente (amistosos / debutantes)`)
  }

  // Media de goles POR LIGA (cada competición tiene su propio entorno goleador)
  const globalAvg = withForm.length
    ? withForm.flatMap((w) => [w.home.goalsFor, w.away.goalsFor]).reduce((s, v) => s + v, 0) / (withForm.length * 2)
    : 1.4
  const byLeague: Record<string, number[]> = {}
  for (const w of withForm) {
    (byLeague[w.slug] ?? (byLeague[w.slug] = [])).push(w.home.goalsFor, w.away.goalsFor)
  }
  const leagueAvgBySlug: Record<string, number> = {}
  for (const [slug, arr] of Object.entries(byLeague)) {
    leagueAvgBySlug[slug] = arr.length >= 4 ? arr.reduce((s, v) => s + v, 0) / arr.length : globalAvg
  }

  const matches: MatchModel[] = withForm.map((m) => {
    const table = tables.get(m.slug) ?? null
    const homeMotiv = classifyMotivation(m.homeId, table)
    const awayMotiv = classifyMotivation(m.awayId, table)
    const effAvg = leagueAvgBySlug[m.slug] ?? globalAvg
    const mdl = modelMatch(m.home, m.away, homeMotiv, awayMotiv, effAvg)
    return {
      id: m.ev.id, slug: m.slug,
      homeName: m.homeName, awayName: m.awayName,
      homeId: m.homeId, awayId: m.awayId,
      kickoff: m.ev.date, odds: m.odds,
      home: m.home, away: m.away, homeMotiv, awayMotiv, mdl,
    }
  })

  return { matches, leagueAvg: globalAvg, fetchedAt: new Date().toISOString() }
}

// ─── Fase 5: motor de value picks ────────────────────────────────────────────

function daysBetween(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86400000
}

interface Candidate {
  market: string; selection: string; key: OddKey
  prob: number; contextScore: number
  story: string; extra: string[]; suppressed?: boolean
}

function shortStatus(m: Motivation): string { return m.status.split(" — ")[0] }

/** Contexto de una apuesta a un equipo (1X2 o hándicap) */
function sideContext(
  teamName: string, mine: Motivation, theirs: Motivation,
  myForm: TeamForm, theirForm: TeamForm, iTired: boolean, theyTired: boolean,
) {
  const motivDiff = mine.factor - theirs.factor
  const formDiff = myForm.formPoints - theirForm.formPoints
  const restEdge = (theyTired && !iTired) ? 1 : (iTired && !theyTired) ? -1 : 0
  const contextScore = clamp(50 + motivDiff * 180 + formDiff * 22 + restEdge * 12, 0, 100)
  const factors: string[] = []
  if (motivDiff > 0.05) factors.push(`tiene más en juego (${shortStatus(mine).toLowerCase()}) que su rival (${shortStatus(theirs).toLowerCase()})`)
  if (formDiff > 0.12 && myForm.form) factors.push(`llega en mejor forma reciente (${myForm.form} vs ${theirForm.form || "—"})`)
  if (theyTired && !iTired) factors.push(`tiene ventaja de descanso (el rival llega con el calendario congestionado)`)
  const story = factors.length ? `El mercado infravalora a ${teamName}: ${factors.join("; ")}.` : ""
  return { contextScore, story }
}

function buildCandidates(m: MatchModel): Candidate[] {
  const { home, away, homeMotiv, awayMotiv, mdl, kickoff } = m
  const homeRest = home.recentDates[0] ? daysBetween(kickoff, home.recentDates[0]) : 7
  const awayRest = away.recentDates[0] ? daysBetween(kickoff, away.recentDates[0]) : 7
  const homeTired = homeRest <= 3 || home.recentDates.filter((d) => daysBetween(kickoff, d) <= 14).length >= 4
  const awayTired = awayRest <= 3 || away.recentDates.filter((d) => daysBetween(kickoff, d) <= 14).length >= 4
  const expTotal = mdl.lambdaHome + mdl.lambdaAway
  const cands: Candidate[] = []

  // 1X2
  const sides = [
    { key: "home" as OddKey, name: m.homeName, prob: mdl.pHome, mine: homeMotiv, theirs: awayMotiv, myF: home, thF: away, iT: homeTired, thT: awayTired },
    { key: "away" as OddKey, name: m.awayName, prob: mdl.pAway, mine: awayMotiv, theirs: homeMotiv, myF: away, thF: home, iT: awayTired, thT: homeTired },
  ]
  for (const s of sides) {
    const ctx = sideContext(s.name, s.mine, s.theirs, s.myF, s.thF, s.iT, s.thT)
    cands.push({
      market: "1X2", selection: `Gana ${s.name}`, key: s.key, prob: s.prob,
      contextScore: ctx.contextScore, story: ctx.story, suppressed: s.mine.dead,
      extra: [
        `Motivación ${s.name}: ${s.mine.status}`,
        `Motivación rival: ${s.theirs.status}`,
        `Forma reciente: ${s.name} ${s.myF.form || "—"} · rival ${s.thF.form || "—"}`,
      ],
    })
  }

  // Empate (X) — MUY restrictivo: solo en partidos genuinamente equilibrados
  if (m.odds.draw) {
    const closeness    = 1 - Math.abs(mdl.pHome - mdl.pAway)
    const motivBalance = Math.abs(homeMotiv.factor - awayMotiv.factor) < 0.08
    const formBalance  = Math.abs(home.formPoints - away.formPoints) < 0.18
    const drawWorthy   = closeness > 0.85 && motivBalance && formBalance && mdl.pDraw >= 0.27
    if (drawWorthy) {
      cands.push({
        market: "1X2", selection: "Empate", key: "draw", prob: mdl.pDraw,
        contextScore: clamp(40 + closeness * 35 + (motivBalance ? 10 : 0) + (formBalance ? 8 : 0), 0, 100),
        story: `Partido genuinamente equilibrado: probabilidades ${Math.round(mdl.pHome * 100)}/${Math.round(mdl.pDraw * 100)}/${Math.round(mdl.pAway * 100)}, motivación y forma similares.`,
        extra: [
          `Probabilidades modelo 1/X/2: ${Math.round(mdl.pHome * 100)}% / ${Math.round(mdl.pDraw * 100)}% / ${Math.round(mdl.pAway * 100)}%`,
          `Goles esperados: ${m.homeName} ${mdl.lambdaHome.toFixed(2)} — ${m.awayName} ${mdl.lambdaAway.toFixed(2)}`,
        ],
      })
    }
  }

  // Over 2.5 — solo si el modelo proyecta CLARAMENTE muchos goles
  if (expTotal >= 3.05 && home.over25Pct >= 0.55 && away.over25Pct >= 0.55 && mdl.pOver >= 0.58) {
    const attackCtx = (home.over25Pct + away.over25Pct) / 2
    cands.push({
      market: "Over/Under 2.5", selection: "Over 2.5 Goles", key: "over25", prob: mdl.pOver,
      contextScore: clamp((attackCtx - 0.45) * 200 + (expTotal - 3.0) * 30 + 42, 0, 100),
      story: `Entorno claramente ofensivo: el modelo proyecta ${expTotal.toFixed(2)} goles y ambos equipos superan el 55% en Over recientes.`,
      extra: [
        `Goles esperados (Poisson): ${m.homeName} ${mdl.lambdaHome.toFixed(2)} — ${m.awayName} ${mdl.lambdaAway.toFixed(2)}`,
        `Over 2.5 reciente: ${m.homeName} ${Math.round(home.over25Pct * 100)}% · ${m.awayName} ${Math.round(away.over25Pct * 100)}%`,
      ],
    })
  }

  // Under 2.5 — solo si el modelo proyecta CLARAMENTE pocos goles
  if (expTotal <= 2.30 && (home.cleanSheetPct >= 0.30 || away.cleanSheetPct >= 0.30) && mdl.pUnder >= 0.58) {
    const defCtx = (home.cleanSheetPct + away.cleanSheetPct) / 2
    cands.push({
      market: "Over/Under 2.5", selection: "Under 2.5 Goles", key: "under25", prob: mdl.pUnder,
      contextScore: clamp((defCtx - 0.2) * 180 + (2.5 - expTotal) * 45 + 42, 0, 100),
      story: `Pronóstico claro de pocos goles: el modelo proyecta ${expTotal.toFixed(2)} y al menos una defensa mantiene la portería a 0 con frecuencia.`,
      extra: [
        `Goles esperados (Poisson): ${m.homeName} ${mdl.lambdaHome.toFixed(2)} — ${m.awayName} ${mdl.lambdaAway.toFixed(2)}`,
        `Portería a 0 reciente: ${m.homeName} ${Math.round(home.cleanSheetPct * 100)}% · ${m.awayName} ${Math.round(away.cleanSheetPct * 100)}%`,
      ],
    })
  }

  // Hándicap (si hay cuota real de spread)
  if (m.odds.spreadLine != null && m.odds.spreadHome && m.odds.spreadAway) {
    const hp = handicapProb(mdl.lambdaHome, mdl.lambdaAway, m.odds.spreadLine)
    const fmt = (n: number) => (n > 0 ? `+${n}` : `${n}`)
    const hSides = [
      { key: "spreadHome" as OddKey, name: m.homeName, prob: hp.home, line: m.odds.spreadLine, mine: homeMotiv, theirs: awayMotiv, myF: home, thF: away, iT: homeTired, thT: awayTired },
      { key: "spreadAway" as OddKey, name: m.awayName, prob: hp.away, line: -m.odds.spreadLine, mine: awayMotiv, theirs: homeMotiv, myF: away, thF: home, iT: awayTired, thT: homeTired },
    ]
    for (const s of hSides) {
      const ctx = sideContext(s.name, s.mine, s.theirs, s.myF, s.thF, s.iT, s.thT)
      cands.push({
        market: "Hándicap", selection: `${s.name} hándicap ${fmt(s.line)}`, key: s.key, prob: s.prob,
        contextScore: ctx.contextScore, story: ctx.story, suppressed: s.mine.dead,
        extra: [
          `Goles esperados (Poisson): ${m.homeName} ${mdl.lambdaHome.toFixed(2)} — ${m.awayName} ${mdl.lambdaAway.toFixed(2)}`,
          `Motivación ${s.name}: ${s.mine.status}`,
        ],
      })
    }
  }

  return cands
}

function valueTier(q: number): string {
  if (q >= 78) return "SAFE"
  if (q >= 66) return "HIGH"
  return "MEDIUM"
}

/**
 * COMMON SENSE ENGINE — bloquea picks que un analista profesional NO recomendaría.
 * Combina probabilidad absoluta + contexto + sentido deportivo.
 * "¿Esto tiene sentido futbolístico?"  → si NO, se descarta.
 */
function commonSensePass(c: Candidate, m: MatchModel): boolean {
  // ─── 1X2 ganador (home/away) ──────────────────────────────────────────────
  if (c.market === "1X2" && (c.key === "home" || c.key === "away")) {
    // Favorito claro del modelo
    if (c.prob >= 0.55) return true
    // Contestado pero con contexto fuerte (motivación/forma/fatiga)
    if (c.prob >= 0.45 && c.contextScore >= 60) return true
    // Underdog moderado solo si el rival está "muerto" o con contexto extremo
    const oppDead = c.key === "home" ? m.awayMotiv.dead : m.homeMotiv.dead
    if (c.prob >= 0.40 && oppDead && c.contextScore >= 55) return true
    return false // probabilidad < 40% → underdog absurdo, fuera
  }
  // ─── Empate ───────────────────────────────────────────────────────────────
  if (c.market === "1X2" && c.key === "draw") {
    // Ya filtrado en buildCandidates (equilibrio); aquí pisos absolutos
    return c.prob >= 0.28 && c.contextScore >= 55
  }
  // ─── Over/Under 2.5 ────────────────────────────────────────────────────────
  if (c.market === "Over/Under 2.5") {
    return c.prob >= 0.58 && c.contextScore >= 42
  }
  // ─── Hándicap ─────────────────────────────────────────────────────────────
  if (c.market === "Hándicap") {
    // Reject underdog-with-advantage at short odds (e.g. Arsenal +0.5 @ 1.60 vs PSG)
    // If the team is a clear 1X2 underdog but receives a positive handicap line,
    // the odds must compensate for the inherent risk.
    if (c.key === "spreadAway") {
      const awayProb1x2 = m.mdl.pAway
      const isUnderdog   = awayProb1x2 < 0.40
      const positiveSpread = m.odds.spreadLine != null && m.odds.spreadLine > 0  // line > 0 means away gets +
      const oddVal = m.odds[c.key] ?? 0
      if (isUnderdog && positiveSpread && oddVal < MIN_ODD_HANDICAP_UNDERDOG) return false
    }
    if (c.key === "spreadHome") {
      const homeProb1x2 = m.mdl.pHome
      const isUnderdog   = homeProb1x2 < 0.40
      const positiveSpread = m.odds.spreadLine != null && m.odds.spreadLine < 0  // negative line means home gets +
      const oddVal = m.odds[c.key] ?? 0
      if (isUnderdog && positiveSpread && oddVal < MIN_ODD_HANDICAP_UNDERDOG) return false
    }
    if (c.prob >= 0.55) return true
    if (c.prob >= 0.45 && c.contextScore >= 60) return true
    return false
  }
  return true
}

/** Riesgo del pick — combina probabilidad absoluta, cuota y calidad. */
function riskTier(prob: number, odd: number, quality: number): "low" | "mid" | "high" {
  if (prob >= 0.58 && odd <= 1.95 && quality >= 65) return "low"
  if (prob >= 0.43 && odd <= 3.0  && quality >= 55) return "mid"
  return "high"
}

/** Construye el candidato de evaluación para el motor de decisión */
function toEvalCandidate(c: Candidate, m: MatchModel, odd: number): EvalCandidate {
  const edge = Math.round((c.prob * 100 - impliedPct(odd)) * 10) / 10
  const reliability = (Math.min(m.home.gamesPlayed, 10) + Math.min(m.away.gamesPlayed, 10)) / 20
  const edgeScore = 25 + clamp((edge - MIN_EDGE) / (MAX_EDGE - MIN_EDGE), 0, 1) * 75
  const marketScore = clamp((odd - MIN_ODD) / (4.5 - MIN_ODD), 0, 1) * 100
  const baseQuality = Math.round(0.38 * edgeScore + 0.30 * c.contextScore + 0.16 * marketScore + 0.16 * reliability * 100)
  return {
    market: c.market, selection: c.selection, key: c.key,
    prob: c.prob, contextScore: c.contextScore,
    odd, edge, baseQuality,
  }
}

function toEvalMatch(m: MatchModel): EvalMatch {
  return {
    id: m.id, homeName: m.homeName, awayName: m.awayName,
    slug: m.slug, kickoff: m.kickoff, odds: m.odds,
    home: m.home, away: m.away,
    homeMotiv: m.homeMotiv, awayMotiv: m.awayMotiv,
    mdl: m.mdl,
  }
}

export function computeValuePicks(data: DailyData): { picks: any[]; note?: string; auditTrail: any[] } {
  const picks: any[] = []
  const auditTrail: any[] = []   // motivos de rechazo de cada candidato (admin only)

  for (const m of data.matches) {
    const evalMatch = toEvalMatch(m)
    interface BestEntry {
      c: Candidate; odd: number; edge: number; quality: number
      evaluation: PickEvaluation
    }
    let best: BestEntry | null = null

    for (const c of buildCandidates(m)) {
      if (c.suppressed) continue
      const odd = m.odds[c.key]
      if (!odd || !isFinite(odd) || odd < MIN_ODD) continue

      const evalCand = toEvalCandidate(c, m, odd)
      if (evalCand.edge < MIN_EDGE || evalCand.edge > MAX_EDGE) continue
      if (!commonSensePass(c, m)) continue

      // ────────── MOTOR DE DECISIÓN ──────────
      const evaluation = evaluatePick(evalCand, evalMatch)

      if (!evaluation.pass || !evaluation.professionallyDefendable) {
        auditTrail.push({
          match: `${m.homeName} vs ${m.awayName}`,
          league: LEAGUE_NAMES[m.slug] ?? m.slug,
          selection: c.selection,
          rejected: evaluation.rejectReasons,
          scores: evaluation.gate.scores,
          uncertainty: evaluation.uncertainty.reasons,
          contradictions: evaluation.contradiction.conflicts,
        })
        continue
      }

      if (!best || evalCand.baseQuality > best.quality) {
        best = { c, odd, edge: evalCand.edge, quality: evalCand.baseQuality, evaluation }
      }
    }
    if (!best) continue

    // Usamos la PROB DE CONSENSO (mejor estimación que c.prob solo)
    const consensusProb = best.evaluation.consensus.prob
    const conf = Math.round(consensusProb * 100)
    const imp = impliedPct(best.odd)
    const recomputedEdge = Math.round((consensusProb * 100 - imp) * 10) / 10
    const valueReason = best.c.story ||
      `El mercado valora esta selección en ${imp}%; el consenso de modelos la sitúa en ${(consensusProb * 100).toFixed(1)}%.`

    const risk = riskTier(consensusProb, best.odd, best.quality)
    const ev = best.evaluation

    picks.push({
      id: m.id,
      home_team: m.homeName, away_team: m.awayName,
      league_name: LEAGUE_NAMES[m.slug] ?? m.slug, kickoff_utc: m.kickoff,
      market: best.c.market, selection: best.c.selection,
      confidence_pct: conf, confidence_tier: valueTier(best.quality),
      model_prob: Math.round(consensusProb * 1000) / 10,
      best_odd: best.odd, value_edge: recomputedEdge, bookmaker: m.odds.provider,
      quality_score: best.quality, value_reason: valueReason,
      risk_tier: risk,
      result: "PENDING", plan_required: best.quality >= 72 ? "premium" : "basic",
      // ─── Trazabilidad del motor de decisión (visible en PickDetail) ───
      engine: {
        consensus_prob: Math.round(consensusProb * 1000) / 10,
        consensus_agreement: Math.round(ev.consensus.agreement * 100),
        uncertainty: ev.uncertainty.score,
        contradiction: ev.contradiction.score,
        models: ev.consensus.models.map((x) => ({
          name: x.name, prob: Math.round(x.prob * 1000) / 10,
          confidence: Math.round(x.confidence * 100), rationale: x.rationale,
        })),
        uncertainty_reasons: ev.uncertainty.reasons,
        contradictions: ev.contradiction.conflicts,
      },
      reasons: [
        `💡 ${valueReason}`,
        ...best.c.extra,
        `Cuota real (${m.odds.provider}): ${best.odd.toFixed(2)} → prob. implícita ${imp}%`,
        `Consenso 5 modelos: ${conf}% · Acuerdo entre modelos: ${Math.round(ev.consensus.agreement * 100)}%`,
        `Incertidumbre: ${ev.uncertainty.score}/100 · Contradicciones: ${ev.contradiction.score}/100`,
        `Score de calidad: ${best.quality}/100 · Riesgo ${risk === "low" ? "🟢 conservador" : risk === "mid" ? "🟡 medio" : "🔴 alto"}`,
      ],
    })
  }

  picks.sort((a, b) => b.quality_score - a.quality_score)
  const MIN_DAILY_PICKS = 7

  // FALLBACK: if strict engine yields fewer than MIN_DAILY_PICKS, add best remaining
  // candidates with relaxed thresholds (skip decision-engine, lower quality gate to 40)
  if (picks.length < MIN_DAILY_PICKS) {
    const publishedMatchIds = new Set(picks.map((p: any) => p.id))
    const fallbackCandidates: any[] = []

    for (const m of data.matches) {
      if (publishedMatchIds.has(m.id)) continue // already have a pick for this match
      for (const c of buildCandidates(m)) {
        if (c.suppressed) continue
        const odd = m.odds[c.key]
        if (!odd || !isFinite(odd) || odd < MIN_ODD) continue
        const evalCand = toEvalCandidate(c, m, odd)
        // Relaxed: edge >= 1.5 (was 3), quality >= 40 (was 52)
        if (evalCand.edge < 1.5 || evalCand.edge > MAX_EDGE) continue
        if (evalCand.baseQuality < 40) continue
        if (!commonSensePass(c, m)) continue
        const consensusProb = evalCand.prob
        const conf = Math.round(consensusProb * 100)
        const imp = impliedPct(odd)
        const valueReason = c.story ||
          `El modelo estima ${(consensusProb * 100).toFixed(1)}% frente al ${imp}% implícito de la cuota (edge +${evalCand.edge.toFixed(1)}%).`
        const risk = riskTier(consensusProb, odd, evalCand.baseQuality)
        fallbackCandidates.push({
          id: m.id,
          home_team: m.homeName, away_team: m.awayName,
          league_name: LEAGUE_NAMES[m.slug] ?? m.slug, kickoff_utc: m.kickoff,
          market: c.market, selection: c.selection,
          confidence_pct: conf, confidence_tier: "MEDIUM",
          model_prob: Math.round(consensusProb * 1000) / 10,
          best_odd: odd, value_edge: evalCand.edge, bookmaker: m.odds.provider,
          quality_score: evalCand.baseQuality, value_reason: valueReason,
          risk_tier: risk,
          result: "PENDING", plan_required: "basic",
          _fallback: true, // internal marker
          engine: { consensus_prob: Math.round(consensusProb * 1000) / 10, consensus_agreement: 50, uncertainty: 40, contradiction: 30, models: [] },
          reasons: [
            `💡 ${valueReason}`,
            ...c.extra,
            `Cuota real (${m.odds.provider}): ${odd.toFixed(2)} → prob. implícita ${imp}%`,
            `Score de calidad: ${evalCand.baseQuality}/100 · Pick de completado (umbrales relajados)`,
          ],
        })
        break // one fallback pick per match
      }
      if (picks.length + fallbackCandidates.length >= MIN_DAILY_PICKS) break
    }
    fallbackCandidates.sort((a, b) => b.quality_score - a.quality_score)
    const needed = MIN_DAILY_PICKS - picks.length
    picks.push(...fallbackCandidates.slice(0, needed))
    const seen = new Set<string>()
    const deduped = picks.filter((p: any) => { if (seen.has(p.id)) return false; seen.add(p.id); return true })
    picks.length = 0
    picks.push(...deduped)
    picks.sort((a: any, b: any) => b.quality_score - a.quality_score)
  }

  const capped = picks.slice(0, MAX_PICKS)
  return {
    picks: capped,
    auditTrail: auditTrail.slice(0, 40),  // top 40 para no llenar logs
    note: capped.length === 0
      ? "Hoy ningún partido supera el motor de validación (consenso, incertidumbre, contradicciones). No publicamos picks por publicar."
      : undefined,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECOND OPINION — busca un pick alternativo en el MISMO partido
// ═══════════════════════════════════════════════════════════════════════════════

export interface SecondOpinionResult {
  found: boolean
  pick?: any
  /** Qué cambió respecto al pick original */
  changes?: {
    market_from: string;       market_to: string
    selection_from: string;    selection_to: string
    odd_from: number;          odd_to: number
    edge_from: number;         edge_to: number
    quality_from: number;      quality_to: number
    why_changed: string
  }
  reason?: string             // si found=false
}

/**
 * Encuentra un pick alternativo para un partido dado, excluyendo selecciones
 * ya mostradas. Aplica el motor de decisión completo — solo devuelve algo si
 * iguala o mejora el quality del original.
 */
export function findAlternativePick(
  data: DailyData,
  matchId: string,
  originalSelection: string,
  originalMarket: string,
  originalQuality: number,
  excludeSelections: string[] = [],
): SecondOpinionResult {
  const m = data.matches.find((x) => x.id === matchId)
  if (!m) return { found: false, reason: "Partido no encontrado o ya jugado" }

  const evalMatch = toEvalMatch(m)
  const excluded = new Set([originalSelection, ...excludeSelections])

  let best: { c: Candidate; odd: number; quality: number; evaluation: PickEvaluation } | null = null

  for (const c of buildCandidates(m)) {
    if (c.suppressed) continue
    if (excluded.has(c.selection)) continue        // no repetir
    if (c.market === originalMarket && c.selection === originalSelection) continue
    const odd = m.odds[c.key]
    if (!odd || !isFinite(odd) || odd < MIN_ODD) continue

    const evalCand = toEvalCandidate(c, m, odd)
    if (evalCand.edge < MIN_EDGE || evalCand.edge > MAX_EDGE) continue
    if (!commonSensePass(c, m)) continue

    const evaluation = evaluatePick(evalCand, evalMatch)
    if (!evaluation.pass || !evaluation.professionallyDefendable) continue
    if (evalCand.baseQuality < originalQuality) continue   // no degradar

    if (!best || evalCand.baseQuality > best.quality) {
      best = { c, odd, quality: evalCand.baseQuality, evaluation }
    }
  }

  if (!best) {
    return {
      found: false,
      reason: "No se encontró una alternativa que iguale o mejore la calidad del pick actual.",
    }
  }

  const ev = best.evaluation
  const consensusProb = ev.consensus.prob
  const imp = impliedPct(best.odd)
  const recomputedEdge = Math.round((consensusProb * 100 - imp) * 10) / 10
  const risk = riskTier(consensusProb, best.odd, best.quality)
  const valueReason = best.c.story ||
    `Tras reanalizar, el consenso sitúa esta selección en ${(consensusProb * 100).toFixed(1)}% vs el ${imp}% del mercado.`

  // ── Explicación de qué cambió ────────────────────────────────────────────
  const marketChanged = best.c.market !== originalMarket
  let whyChanged: string
  if (marketChanged) {
    whyChanged = `Se cambió el mercado de "${originalMarket}" a "${best.c.market}" porque tras revisar contexto, forma y modelo, esta selección tiene mejor respaldo: consenso ${Math.round(consensusProb * 100)}%, incertidumbre solo ${ev.uncertainty.score}/100 y sin contradicciones relevantes.`
  } else {
    whyChanged = `Se mantiene el mercado "${best.c.market}" pero con selección distinta. La revisión del consenso (${Math.round(consensusProb * 100)}%) y el contexto justifican esta alternativa.`
  }

  return {
    found: true,
    pick: {
      id: `${m.id}-alt`,
      home_team: m.homeName, away_team: m.awayName,
      league_name: LEAGUE_NAMES[m.slug] ?? m.slug, kickoff_utc: m.kickoff,
      market: best.c.market, selection: best.c.selection,
      confidence_pct: Math.round(consensusProb * 100),
      confidence_tier: valueTier(best.quality),
      model_prob: Math.round(consensusProb * 1000) / 10,
      best_odd: best.odd, value_edge: recomputedEdge, bookmaker: m.odds.provider,
      quality_score: best.quality, value_reason: valueReason,
      risk_tier: risk,
      result: "PENDING", plan_required: best.quality >= 72 ? "premium" : "basic",
      is_second_opinion: true,
      engine: {
        consensus_prob: Math.round(consensusProb * 1000) / 10,
        consensus_agreement: Math.round(ev.consensus.agreement * 100),
        uncertainty: ev.uncertainty.score,
        contradiction: ev.contradiction.score,
        models: ev.consensus.models.map((x) => ({
          name: x.name, prob: Math.round(x.prob * 1000) / 10,
          confidence: Math.round(x.confidence * 100), rationale: x.rationale,
        })),
      },
      reasons: [
        `🔄 Segunda opinión: ${whyChanged}`,
        ...best.c.extra,
        `Consenso 5 modelos: ${Math.round(consensusProb * 100)}% · Acuerdo ${Math.round(ev.consensus.agreement * 100)}%`,
        `Cuota real (${m.odds.provider}): ${best.odd.toFixed(2)} → edge ${recomputedEdge >= 0 ? "+" : ""}${recomputedEdge}%`,
        `Score de calidad: ${best.quality}/100 · Riesgo ${risk === "low" ? "🟢" : risk === "mid" ? "🟡" : "🔴"}`,
      ],
    },
    changes: {
      market_from:    originalMarket,    market_to:    best.c.market,
      selection_from: originalSelection, selection_to: best.c.selection,
      odd_from:       0,                 odd_to:       best.odd,
      edge_from:      0,                 edge_to:      recomputedEdge,
      quality_from:   originalQuality,   quality_to:   best.quality,
      why_changed:    whyChanged,
    },
  }
}

// ─── Combinadas ──────────────────────────────────────────────────────────────

const COMBI_MODES: Record<string, { legs: number; minProb: number; minOdd: number; maxOdd: number; label: string; sort: "prob" | "odd" }> = {
  safe:     { legs: 2, minProb: 0.58, minOdd: 1.20, maxOdd: 2.6, label: "Segura",     sort: "prob" },
  balanced: { legs: 3, minProb: 0.50, minOdd: 1.30, maxOdd: 3.5, label: "Balanceada", sort: "prob" },
  dream:    { legs: 4, minProb: 0.38, minOdd: 1.50, maxOdd: 8.0, label: "Soñadora",   sort: "odd"  },
}

/** Pool de selecciones candidatas para combinadas — pre-computado en el pipeline */
export interface PoolEntry {
  matchId: string
  match: string
  league: string
  slug: string
  market: string
  selection: string
  odd: number
  prob: number          // 0-1, prob del modelo
  reasoning: string
  homeDead: boolean
  awayDead: boolean
}

export function buildCombinadaPool(data: DailyData, excludeMatchIds: Set<string> = new Set()): PoolEntry[] {
  const pool: PoolEntry[] = []
  for (const m of data.matches) {
    // Segregation: skip matches already used as value picks
    if (excludeMatchIds.has(m.id)) continue
    const matchName = `${m.homeName} vs ${m.awayName}`
    const league = LEAGUE_NAMES[m.slug] ?? m.slug
    for (const c of buildCandidates(m)) {
      if (c.suppressed) continue
      const odd = m.odds[c.key]
      if (!odd || odd <= 1.10) continue  // slightly tighter floor than before
      // Apply common-sense gate to combinada candidates too (no absurd underdogs)
      if (!commonSensePass(c, m)) continue
      pool.push({
        matchId: m.id, match: matchName, league, slug: m.slug,
        market: c.market, selection: c.selection,
        odd, prob: c.prob,
        reasoning: c.story || `Modelo ${Math.round(c.prob * 100)}%`,
        homeDead: m.homeMotiv.dead, awayDead: m.awayMotiv.dead,
      })
    }
  }
  return pool
}

/**
 * Selecciona una combinada del pool con variedad — cada llamada da algo distinto.
 * Filtra por modo + liga, deduplica por partido, toma el top-K por la métrica
 * del modo y muestrea cfg.legs al azar de ese top → siempre alta calidad pero
 * sin repetirse en cada regeneración.
 */
export function pickCombinadaFromPool(pool: PoolEntry[], mode: string, leagueId: string): any {
  const cfg = COMBI_MODES[mode] ?? COMBI_MODES.balanced
  const slug = leagueId ? LEAGUE_MAP[leagueId] : null

  let eligible = pool.filter((p) => p.odd >= cfg.minOdd && p.odd <= cfg.maxOdd && p.prob >= cfg.minProb)
  if (slug) eligible = eligible.filter((p) => p.slug === slug)
  // En segura/balanceada descartamos partidos donde ambos equipos están "muertos"
  if (cfg.sort === "prob") eligible = eligible.filter((p) => !(p.homeDead && p.awayDead))

  // Mejor selección por partido según la métrica del modo
  const byMatch = new Map<string, PoolEntry>()
  for (const p of eligible) {
    const cur = byMatch.get(p.matchId)
    const better = !cur || (cfg.sort === "prob" ? p.prob > cur.prob : p.odd > cur.odd)
    if (better) byMatch.set(p.matchId, p)
  }
  const perMatch = [...byMatch.values()]

  if (perMatch.length < cfg.legs) {
    // FALLBACK 1: try without league filter if one was specified
    if (slug) {
      let fallback = pool.filter((p) => p.odd >= cfg.minOdd && p.odd <= cfg.maxOdd && p.prob >= cfg.minProb)
      if (cfg.sort === "prob") fallback = fallback.filter((p) => !(p.homeDead && p.awayDead))
      const fbByMatch = new Map<string, PoolEntry>()
      for (const p of fallback) {
        const cur = fbByMatch.get(p.matchId)
        const better = !cur || (cfg.sort === "prob" ? p.prob > cur.prob : p.odd > cur.odd)
        if (better) fbByMatch.set(p.matchId, p)
      }
      const fbPerMatch = [...fbByMatch.values()]
      if (fbPerMatch.length >= cfg.legs) {
        // use multi-league fallback
        fbPerMatch.sort((a, b) => (cfg.sort === "prob" ? b.prob - a.prob : b.odd - a.odd))
        const topK = fbPerMatch.slice(0, Math.max(cfg.legs * 3, cfg.legs + 4))
        for (let i = topK.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          const t = topK[i]; topK[i] = topK[j]; topK[j] = t
        }
        const chosen = topK.slice(0, cfg.legs)
        return {
          mode: cfg.label, date: new Date().toISOString().split("T")[0],
          fallback_reason: "Liga sin suficientes selecciones hoy — combinada con las mejores de todas las ligas",
          legs: chosen.map((l) => ({ match: l.match, league: l.league, selection: l.selection, odd: l.odd, prob: Math.round(l.prob * 100), market: l.market, reasoning: l.reasoning })),
          combined_odd: Math.round(chosen.reduce((a, l) => a * l.odd, 1) * 100) / 100,
          combined_prob: Math.round(chosen.reduce((a, l) => a * l.prob, 1) * 1000) / 10,
        }
      }
    }
    // FALLBACK 2: relax prob threshold by 0.05
    const relaxed = pool.filter((p) => p.odd >= cfg.minOdd && p.odd <= cfg.maxOdd && p.prob >= Math.max(cfg.minProb - 0.05, 0.35))
    const rxByMatch = new Map<string, PoolEntry>()
    for (const p of relaxed) {
      const cur = rxByMatch.get(p.matchId)
      const better = !cur || (cfg.sort === "prob" ? p.prob > cur.prob : p.odd > cur.odd)
      if (better) rxByMatch.set(p.matchId, p)
    }
    const rxPerMatch = [...rxByMatch.values()]
    if (rxPerMatch.length >= cfg.legs) {
      rxPerMatch.sort((a, b) => (cfg.sort === "prob" ? b.prob - a.prob : b.odd - a.odd))
      const topK = rxPerMatch.slice(0, Math.max(cfg.legs * 3, cfg.legs + 4))
      for (let i = topK.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const t = topK[i]; topK[i] = topK[j]; topK[j] = t
      }
      const chosen = topK.slice(0, cfg.legs)
      return {
        mode: cfg.label, date: new Date().toISOString().split("T")[0],
        fallback_reason: "Umbrales ligeramente relajados para completar la combinada",
        legs: chosen.map((l) => ({ match: l.match, league: l.league, selection: l.selection, odd: l.odd, prob: Math.round(l.prob * 100), market: l.market, reasoning: l.reasoning })),
        combined_odd: Math.round(chosen.reduce((a, l) => a * l.odd, 1) * 100) / 100,
        combined_prob: Math.round(chosen.reduce((a, l) => a * l.prob, 1) * 1000) / 10,
      }
    }
    return { error: `Solo ${perMatch.length} selección(es) válidas hoy. Prueba otro modo.` }
  }

  // Top-K por métrica, luego muestreo aleatorio → variedad en cada regeneración
  perMatch.sort((a, b) => (cfg.sort === "prob" ? b.prob - a.prob : b.odd - a.odd))
  const topK = perMatch.slice(0, Math.max(cfg.legs * 3, cfg.legs + 4))
  // Fisher-Yates
  for (let i = topK.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const t = topK[i]; topK[i] = topK[j]; topK[j] = t
  }
  const chosen = topK.slice(0, cfg.legs)

  return {
    mode: cfg.label,
    date: new Date().toISOString().split("T")[0],
    legs: chosen.map((l) => ({
      match: l.match, league: l.league, selection: l.selection,
      odd: l.odd, prob: Math.round(l.prob * 100), market: l.market,
      reasoning: l.reasoning,
    })),
    combined_odd: Math.round(chosen.reduce((a, l) => a * l.odd, 1) * 100) / 100,
    combined_prob: Math.round(chosen.reduce((a, l) => a * l.prob, 1) * 1000) / 10,
  }
}

// ─── Retos V2 ────────────────────────────────────────────────────────────────

interface RetoSpec {
  id: string; emoji: string; title: string
  days: number; targetOdd: number; nLegs: number
  /** Rango de cuota válido para CADA pata individual — evita combos absurdos */
  minLegOdd: number; maxLegOdd: number
  /** Rango de cuota TOTAL aceptable — validación estricta antes de publicar el pick */
  minFinalOdd: number; maxFinalOdd: number
  difficulty: string; description: string
  stake: number; simulResult: number; color: string
}

/**
 * Retos: 4 desafíos con mini-combinadas diarias.
 * nLegs controla cuántos picks se combinan para llegar a la cuota objetivo.
 * Conservador usa 1 pick directo. Los demás combinan 2 picks de cuotas bajas.
 * Ej: Élite objetivo 3.0 → 2 picks a ~1.73 cada uno (mucho más realista que buscar un solo pick a 3.0)
 */
const RETO_SPECS_V2: RetoSpec[] = [
  {
    id: "conservador", emoji: "🟢", title: "Conservador",
    days: 10, targetOdd: 1.30, nLegs: 1,
    minLegOdd: 1.25, maxLegOdd: 1.35,
    minFinalOdd: 1.25, maxFinalOdd: 1.35,
    difficulty: "Baja",
    description: "10 días · 1 pick diario a cuota entre 1.25 y 1.35. Alta probabilidad, riesgo mínimo. El reto para construir racha.",
    stake: 10, simulResult: 138, color: "emerald",   // 10×1.30^10 ≈ 138€
  },
  {
    id: "intermedio", emoji: "⭐", title: "Intermedio",
    days: 10, targetOdd: 1.50, nLegs: 1,
    minLegOdd: 1.45, maxLegOdd: 1.55,
    minFinalOdd: 1.45, maxFinalOdd: 1.55,
    difficulty: "Media",
    description: "10 días · 1 pick diario a cuota entre 1.45 y 1.55. Equilibrio perfecto entre valor y probabilidad.",
    stake: 10, simulResult: 576, color: "amber",     // 10×1.50^10 ≈ 576€
  },
  {
    id: "avanzado", emoji: "🔥", title: "Avanzado",
    days: 5, targetOdd: 2.00, nLegs: 2,
    minLegOdd: 1.35, maxLegOdd: 1.58,               // ~√2.00 ≈ 1.41 por pata
    minFinalOdd: 1.90, maxFinalOdd: 2.10,
    difficulty: "Alta",
    description: "5 días · Combinada de 2 picks con cuota total entre 1.90 y 2.10.",
    stake: 10, simulResult: 320, color: "rose",      // 10×2.00^5 = 320€
  },
  {
    id: "pro", emoji: "👑", title: "PRO",
    days: 5, targetOdd: 3.00, nLegs: 2,
    minLegOdd: 1.60, maxLegOdd: 1.90,               // ~√3.00 ≈ 1.73 por pata
    minFinalOdd: 2.80, maxFinalOdd: 3.20,
    difficulty: "Muy alta",
    description: "5 días · Combinada de 2 picks con cuota total entre 2.80 y 3.20.",
    stake: 10, simulResult: 2430, color: "violet",   // 10×3.00^5 = 2430€
  },
]

interface RetoPick {
  match_name: string; league: string; kickoff: string
  selection: string; market: string
  odd: number       // cuota individual del pick
  odds: number[]    // siempre array para consistencia estructural
  model_prob: number; implied_prob: number; edge: number
  quality: number; confidence: string; reasons: string[]
}

interface RetoCombo {
  picks: RetoPick[]
  combined_odd: number
  combined_prob: number  // 0-100 combined (product)
}

// Helper: score and build a RetoPick from a raw candidate
type RawCand = { match: MatchModel; c: Candidate; odd: number; edge: number; quality: number }

function buildRetoPick(rc: RawCand): RetoPick {
  const m = rc.match
  const impliedProb = impliedPct(rc.odd)
  const reasons: string[] = []
  if (rc.c.story) reasons.push(`💡 ${rc.c.story}`)
  reasons.push(
    `📊 Prob. modelo: ${Math.round(rc.c.prob * 100)}% · Implícita: ${impliedProb}%`,
    `📈 Edge: +${rc.edge.toFixed(1)}% · Calidad: ${rc.quality}/100`,
    ...rc.c.extra,
  )
  return {
    match_name: `${m.homeName} vs ${m.awayName}`,
    league: LEAGUE_NAMES[m.slug] ?? m.slug,
    kickoff: m.kickoff,
    selection: rc.c.selection,
    market: rc.c.market,
    odd: rc.odd,
    odds: [rc.odd],
    model_prob: Math.round(rc.c.prob * 100),
    implied_prob: impliedProb,
    edge: rc.edge,
    quality: rc.quality,
    confidence: rc.quality >= 75 ? "Alta" : rc.quality >= 60 ? "Media" : "Moderada",
    reasons,
  }
}

/**
 * Genera la mini-combinada diaria para un reto.
 *
 * Para nLegs=1: busca el mejor pick cuya cuota esté cerca de targetOdd.
 * Para nLegs=2: busca la mejor PAREJA de picks (partidos distintos) cuyo
 *   producto de cuotas se acerque a targetOdd (±25%). Esto permite usar
 *   picks de cuotas bajas y mercados variados (Under, Hándicap, etc.)
 *   en lugar de forzar un único pick de cuota alta.
 */
function computeRetoCombi(
  data: DailyData,
  spec: RetoSpec,
  usedMatches: Set<string>,
): RetoCombo | null {

  // Pool amplio de candidatos con edge positivo (sin filtro de cuota todavía)
  const cands: RawCand[] = []
  for (const m of data.matches) {
    const reliability = (Math.min(m.home.gamesPlayed, 10) + Math.min(m.away.gamesPlayed, 10)) / 20
    for (const c of buildCandidates(m)) {
      if (c.suppressed) continue
      const odd = m.odds[c.key]
      if (!odd || !isFinite(odd) || odd < 1.10 || odd > 7.0) continue
      if (c.prob < 0.42) continue
      if (!commonSensePass(c, m)) continue
      const edge = Math.round((c.prob * 100 - impliedPct(odd)) * 10) / 10
      if (edge < 0.8) continue
      const edgeScore = 25 + clamp((edge - 0.8) / 12, 0, 1) * 75
      const quality = Math.round(0.45 * edgeScore + 0.40 * c.contextScore + 0.15 * reliability * 100)
      cands.push({ match: m, c, odd, edge, quality })
    }
  }
  cands.sort((a, b) => b.quality - a.quality)

  // Pool filtrado por rango de cuota POR PATA (garantiza cuotas con sentido)
  const legPool = cands
    .filter((rc) => rc.odd >= spec.minLegOdd && rc.odd <= spec.maxLegOdd)
    .slice(0, 40)

  // ── 1 pata ────────────────────────────────────────────────────────────────
  if (spec.nLegs === 1) {
    // legPool ya filtra por [minLegOdd, maxLegOdd] = [minFinalOdd, maxFinalOdd]
    const legSorted = [...legPool]
      .filter((rc) => !usedMatches.has(rc.match.id))
      .sort((a, b) => {
        const da = Math.abs(a.odd - spec.targetOdd) / spec.targetOdd
        const db = Math.abs(b.odd - spec.targetOdd) / spec.targetOdd
        return (da - db) * 0.6 + (b.quality - a.quality) * 0.4 / 100
      })
    if (legSorted.length === 0) return null  // sin cuotas en rango → no publicar
    const rc = legSorted[0]
    // Validación estricta de cuota final
    if (rc.odd < spec.minFinalOdd || rc.odd > spec.maxFinalOdd) return null
    usedMatches.add(rc.match.id)
    return {
      picks: [buildRetoPick(rc)],
      combined_odd: Math.round(rc.odd * 100) / 100,
      combined_prob: Math.round(rc.c.prob * 100),
    }
  }

  // ── 2 patas: buscar pareja cuyo producto esté en [minFinalOdd, maxFinalOdd] ──
  // Ambas patas deben estar en [minLegOdd, maxLegOdd] Y su producto en el rango final
  let bestPair: [RawCand, RawCand] | null = null
  let bestScore = -Infinity

  const eligible = legPool.filter((rc) => !usedMatches.has(rc.match.id))

  for (let i = 0; i < eligible.length; i++) {
    for (let j = i + 1; j < eligible.length; j++) {
      if (eligible[i].match.id === eligible[j].match.id) continue
      const combined = eligible[i].odd * eligible[j].odd
      // Validación estricta: el producto debe estar en el rango final del reto
      if (combined < spec.minFinalOdd || combined > spec.maxFinalOdd) continue
      const deviation = Math.abs(combined - spec.targetOdd) / spec.targetOdd
      const score = (eligible[i].quality + eligible[j].quality) / 2 - deviation * 60
      if (score > bestScore) { bestScore = score; bestPair = [eligible[i], eligible[j]] }
    }
  }

  if (!bestPair) return null  // sin combinación válida en el rango → no publicar

  usedMatches.add(bestPair[0].match.id)
  usedMatches.add(bestPair[1].match.id)
  const combined_odd = Math.round(bestPair[0].odd * bestPair[1].odd * 100) / 100
  const combined_prob = Math.round(bestPair[0].c.prob * bestPair[1].c.prob * 10000) / 100
  return { picks: bestPair.map(buildRetoPick), combined_odd, combined_prob }
}

/**
 * Greedy N-leg combo (for nLegs ≥ 3).
 * Target per-leg odd = targetOdd^(1/nLegs).
 * Picks the N best candidates (different matches) closest to the per-leg target,
 * then validates the product is within [minFinalOdd, maxFinalOdd].
 */
function computeRetoCombiN(
  data: DailyData,
  spec: RetoSpec,
  usedMatches: Set<string>,
): RetoCombo | null {
  const nLegs = spec.nLegs
  const tol = 0.18

  // Per-leg target and range
  const legTarget = Math.pow(spec.targetOdd, 1 / nLegs)
  const minLeg = legTarget * (1 - tol)
  const maxLeg = legTarget * (1 + tol)

  // Build full candidate pool
  const cands: RawCand[] = []
  for (const m of data.matches) {
    const reliability = (Math.min(m.home.gamesPlayed, 10) + Math.min(m.away.gamesPlayed, 10)) / 20
    for (const c of buildCandidates(m)) {
      if (c.suppressed) continue
      const odd = m.odds[c.key]
      if (!odd || !isFinite(odd) || odd < 1.10 || odd > 7.0) continue
      if (c.prob < 0.42) continue
      if (!commonSensePass(c, m)) continue
      const edge = Math.round((c.prob * 100 - impliedPct(odd)) * 10) / 10
      if (edge < 0.8) continue
      const edgeScore = 25 + clamp((edge - 0.8) / 12, 0, 1) * 75
      const quality = Math.round(0.45 * edgeScore + 0.40 * c.contextScore + 0.15 * reliability * 100)
      if (odd < minLeg || odd > maxLeg) continue
      cands.push({ match: m, c, odd, edge, quality })
    }
  }

  // Sort by proximity to per-leg target then quality
  cands.sort((a, b) => {
    const da = Math.abs(a.odd - legTarget)
    const db = Math.abs(b.odd - legTarget)
    return da - db + (b.quality - a.quality) * 0.003
  })

  // Greedily pick N candidates from distinct matches (not already used)
  const selected: RawCand[] = []
  const inCombo = new Set<string>()
  for (const rc of cands) {
    if (usedMatches.has(rc.match.id) || inCombo.has(rc.match.id)) continue
    selected.push(rc)
    inCombo.add(rc.match.id)
    if (selected.length === nLegs) break
  }

  if (selected.length < nLegs) return null

  const combined = selected.reduce((p, rc) => p * rc.odd, 1)
  const minFinal = spec.targetOdd * (1 - tol - 0.05)
  const maxFinal = spec.targetOdd * (1 + tol + 0.05)
  if (combined < minFinal || combined > maxFinal) return null

  selected.forEach((rc) => usedMatches.add(rc.match.id))
  const combined_odd = Math.round(combined * 100) / 100
  const combined_prob = Math.round(selected.reduce((p, rc) => p * rc.c.prob, 1) * 10000) / 100
  return { picks: selected.map(buildRetoPick), combined_odd, combined_prob }
}

export function computeRetos(data: DailyData): { challenges: any[]; note?: string } {
  const usedMatches = new Set<string>()

  const challenges = RETO_SPECS_V2.map((spec) => {
    const daily_combo = computeRetoCombi(data, spec, usedMatches)

    // Simulation path: compounding stake × targetOdd each day
    const path: number[] = []
    let val = spec.stake
    for (let d = 0; d < spec.days; d++) {
      val = Math.round(val * spec.targetOdd * 100) / 100
      path.push(Math.round(val))
    }

    return {
      id: spec.id,
      emoji: spec.emoji,
      title: spec.title,
      days: spec.days,
      target_odd: spec.targetOdd,
      n_legs: spec.nLegs,
      difficulty: spec.difficulty,
      color: spec.color,
      description: spec.description,
      simulation: { stake: spec.stake, result: spec.simulResult, path },
      daily_combo,
    }
  })

  return {
    challenges,
    note: challenges.every((c) => !c.daily_combo)
      ? "Sin partidos con cuotas válidas para los retos hoy."
      : undefined,
  }
}

// ─── Verificación de resultados ──────────────────────────────────────────────

function normTeam(s: string): string {
  return (s || "").toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, "").trim()
}

function evaluateResult(
  pick: any,
  homeScore: number,
  awayScore: number,
): "WIN" | "LOSS" | "VOID" {
  const { market, selection, home_team, away_team } = pick
  const total = homeScore + awayScore

  if (market === "1X2") {
    if (selection === `Gana ${home_team}`) return homeScore > awayScore ? "WIN" : "LOSS"
    if (selection === `Gana ${away_team}`) return awayScore > homeScore ? "WIN" : "LOSS"
    if (selection === "Empate")            return homeScore === awayScore ? "WIN" : "LOSS"
    return "VOID"
  }

  if (market === "Over/Under 2.5") {
    if (selection === "Over 2.5 Goles")  return total > 2 ? "WIN" : "LOSS"
    if (selection === "Under 2.5 Goles") return total < 3 ? "WIN" : "LOSS"
    return "VOID"
  }

  if (market === "Hándicap") {
    const m = selection.match(/hándicap ([+-]?\d+\.?\d*)$/)
    if (!m) return "VOID"
    const line = parseFloat(m[1])
    const isHome = selection.startsWith(home_team)
    const adj = isHome ? homeScore + line : awayScore + line
    const opp = isHome ? awayScore : homeScore
    if (adj > opp) return "WIN"
    if (adj < opp) return "LOSS"
    return "VOID" // push
  }

  return "VOID"
}

async function checkPickResults(picks: any[], date: string): Promise<any[]> {
  if (!picks.length) return picks
  const yyyymmdd = date.replace(/-/g, "")

  // Recoger todos los resultados finales del día en todas las ligas
  const resultMap = new Map<string, { homeScore: number; awayScore: number }>()

  await Promise.all(ALL_SLUGS.map(async (slug) => {
    try {
      const data = await fetchJSON(
        `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${yyyymmdd}`,
      )
      for (const ev of data?.events ?? []) {
        const comp = ev.competitions?.[0]
        if (!comp?.status?.type?.completed) continue
        const home = comp.competitors?.find((c: any) => c.homeAway === "home")
        const away = comp.competitors?.find((c: any) => c.homeAway === "away")
        if (!home || !away) continue
        const key = `${normTeam(home.team.displayName)}|${normTeam(away.team.displayName)}`
        resultMap.set(key, {
          homeScore: parseInt(home.score ?? "0", 10),
          awayScore: parseInt(away.score ?? "0", 10),
        })
      }
    } catch { /* ignore */ }
  }))

  return picks.map((pick) => {
    if (pick.result !== "PENDING") return pick
    const key = `${normTeam(pick.home_team)}|${normTeam(pick.away_team)}`
    const match = resultMap.get(key)
    if (!match) return pick // not completed or not found
    const result = evaluateResult(pick, match.homeScore, match.awayScore)
    return { ...pick, result, home_score: match.homeScore, away_score: match.awayScore }
  })
}

// ─── Orquestación ────────────────────────────────────────────────────────────

// Promesa de la ejecución en curso — las llamadas concurrentes se enganchan a ella
let currentRun: Promise<void> | null = null

export function runPipeline(reason = "scheduled"): Promise<void> {
  if (currentRun) return currentRun // ya hay un run en marcha → se comparte
  currentRun = (async () => {
    setStatus("running")
    addLog(`▶️  Pipeline iniciado (${reason})`)
    const t0 = Date.now()
    try {
      // ── Verificar resultados del día anterior ──────────────────────────────────
      // Fuentes en orden de fiabilidad:
      //   1. In-memory store (instancia caliente, misma ejecución)
      //   2. KV (compartido entre instancias Vercel — sobrevive cold starts)
      // Si no hay picks de ayer en ninguna fuente, el GET /api/picks/yesterday los
      // devolverá vacíos y el cliente caerá al fallback de localStorage.
      const prevStore = getStore()
      const today = new Date().toISOString().split("T")[0]
      const yesterdayDate = new Date(Date.now() - 86_400_000).toISOString().split("T")[0]

      // --- Caso A: store caliente con picks de ayer ---
      if (prevStore.date && prevStore.date !== today && prevStore.valuePicks.length > 0) {
        addLog(`📋 Verificando resultados del ${prevStore.date} (store caliente)…`)
        try {
          const verified = await checkPickResults(prevStore.valuePicks, prevStore.date)
          const wins    = verified.filter((p: any) => p.result === "WIN").length
          const losses  = verified.filter((p: any) => p.result === "LOSS").length
          const pending = verified.filter((p: any) => p.result === "PENDING").length
          setYesterdayResults(prevStore.date, verified)
          addLog(`✅ Resultados verificados: ${wins}W ${losses}L ${pending} pendientes`)
        } catch (e: any) {
          addLog(`⚠️  Error verificando resultados: ${e?.message ?? e}`)
        }
      } else {
        // --- Caso B: cold start — intentar recuperar picks de ayer desde KV ---
        try {
          const { cacheGet } = await import("@/lib/kv")
          const kvYesterday = await cacheGet<{ date: string; picks: any[] }>("picks:today-raw")
          if (kvYesterday?.date === yesterdayDate && kvYesterday.picks?.length > 0) {
            addLog(`📋 Verificando resultados del ${kvYesterday.date} (fuente: KV)…`)
            const verified = await checkPickResults(kvYesterday.picks, kvYesterday.date)
            const wins    = verified.filter((p: any) => p.result === "WIN").length
            const losses  = verified.filter((p: any) => p.result === "LOSS").length
            const pending = verified.filter((p: any) => p.result === "PENDING").length
            setYesterdayResults(kvYesterday.date, verified)
            addLog(`✅ Resultados verificados (cold KV): ${wins}W ${losses}L ${pending} pendientes`)
          }
        } catch (e: any) {
          addLog(`ℹ️  Sin picks previos en KV: ${e?.message ?? e}`)
        }
      }

      let data: DailyData | null = null
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          addLog(`📥 Descargando datos reales (intento ${attempt}/3)…`)
          data = await fetchDailyData()
          if (data.matches.length > 0) break
          addLog(`⚠️  0 partidos válidos en el intento ${attempt}`)
        } catch (e: any) {
          addLog(`⚠️  Error en intento ${attempt}: ${e?.message ?? e}`)
        }
        if (attempt < 3) await new Promise((r) => setTimeout(r, 3000 * attempt))
      }

      if (!data) throw new Error("No se pudieron descargar los datos tras 3 intentos")
      addLog(`✅ ${data.matches.length} partidos con datos reales completos`)

      // Precargar pesos y patterns del Learning Engine antes de evaluar
      await preloadLearningCache()

      const { picks, note: picksNote, auditTrail } = computeValuePicks(data)
      addLog(`🎯 ${picks.length} value picks generados (motor de decisión + learning activo)`)
      if (auditTrail.length > 0) {
        addLog(`🔍 ${auditTrail.length} candidatos rechazados — ver /admin para auditoría`)
      }
      // Snapshot del DailyData + audit para Second Opinion y /admin
      const s = getStore()
      s.dailyData = data
      s.lastAuditTrail = auditTrail

      // Registrar los picks publicados en el Learning Storage (para verificación mañana)
      if (picks.length > 0) {
        const today = new Date().toISOString().slice(0, 10)
        const records: PickRecord[] = picks.map((p: any) => ({
          pickId: `vp-${today}-${p.id}-${p.market}-${p.selection}`.replace(/\s+/g, "_").slice(0, 200),
          date: today,
          matchId: p.id,
          league: data.matches.find((mm) => mm.id === p.id)?.slug ?? "",
          leagueName: p.league_name,
          homeTeam: p.home_team, awayTeam: p.away_team,
          market: p.market, selection: p.selection,
          selectionType:
            p.selection.startsWith("Gana ") ? `1X2-${p.selection === `Gana ${p.home_team}` ? "home" : "away"}` :
            p.selection === "Empate" ? "1X2-draw" :
            p.selection === "Over 2.5 Goles" ? "Over25" :
            p.selection === "Under 2.5 Goles" ? "Under25" :
            p.market === "Hándicap" ? "Handicap" : p.market,
          odd: p.best_odd, impliedProb: impliedPct(p.best_odd),
          modelProb: p.model_prob,
          consensusProb: p.engine?.consensus_prob ?? p.model_prob,
          edge: p.value_edge, qualityScore: p.quality_score,
          riskTier: p.risk_tier,
          uncertaintyScore: p.engine?.uncertainty ?? 0,
          contradictionScore: p.engine?.contradiction ?? 0,
          consensusAgreement: p.engine?.consensus_agreement ?? 0,
          contextSnapshot: {
            homeForm: data.matches.find((mm) => mm.id === p.id)?.home.form ?? "",
            awayForm: data.matches.find((mm) => mm.id === p.id)?.away.form ?? "",
            homeMotivStatus: data.matches.find((mm) => mm.id === p.id)?.homeMotiv.status ?? "",
            awayMotivStatus: data.matches.find((mm) => mm.id === p.id)?.awayMotiv.status ?? "",
            expGoals: ((data.matches.find((mm) => mm.id === p.id)?.mdl.lambdaHome ?? 0) +
                       (data.matches.find((mm) => mm.id === p.id)?.mdl.lambdaAway ?? 0)),
          },
          result: "PENDING",
        }))
        recordPublishedPicks(records).catch((e) => addLog(`⚠️  Learning storage: ${e?.message ?? e}`))
        addLog(`📝 ${records.length} picks registrados en Learning Engine`)
      }

      // Segregation: combinada pool excludes matches already used as value picks
      const valuePickMatchIds = new Set<string>(picks.map((p: any) => p.id))
      const combinadaPool = buildCombinadaPool(data, valuePickMatchIds)
      addLog(`🎲 Pool de combinadas: ${combinadaPool.length} selecciones candidatas (${valuePickMatchIds.size} partidos excluidos por value picks)`)

      const { challenges, note: retosNote } = computeRetos(data)
      addLog(`🏆 ${challenges.length} retos con pick diario real`)

      const todayDate = new Date().toISOString().split("T")[0]
      setDailyResults({
        date: todayDate,
        valuePicks: picks, picksNote,
        combinadaPool, retos: challenges, retosNote,
        matches: data.matches.length,
        durationMs: Date.now() - t0,
      })

      // Guardar los picks de HOY en KV como "today-raw" para que mañana el pipeline
      // pueda recuperarlos en cold start y verificar sus resultados via ESPN.
      // TTL: 36h (suficiente para que el cron de las 6:30 AM los encuentre al día siguiente).
      if (picks.length > 0) {
        ;(async () => {
          try {
            const { cacheSet } = await import("@/lib/kv")
            await cacheSet("picks:today-raw", { date: todayDate, picks }, 36 * 3600)
            addLog(`💾 Picks de hoy guardados en KV (${picks.length} picks · ${todayDate})`)
          } catch { /* KV no disponible — /tmp es el fallback */ }
        })()
      }

      addLog(`🟢 Pipeline completado en ${((Date.now() - t0) / 1000).toFixed(1)}s`)
    } catch (e: any) {
      recordError(`Pipeline falló: ${e?.message ?? e}`)
      if (getStore().valuePicks.length === 0) setStatus("error")
      else setStatus("ready")
    }
  })()
  currentRun.finally(() => { currentRun = null })
  return currentRun
}

/** Stale-while-revalidate: si los datos no son frescos, refresca en segundo plano */
export function ensureFresh(maxAgeMs = 4 * 3600_000): void {
  if (!isFresh(maxAgeMs) && !currentRun) {
    runPipeline("stale-refresh").catch(() => {})
  }
}

/** Cold start: garantiza datos de HOY antes de responder (espera el run en curso) */
export async function ensureWarm(): Promise<void> {
  startScheduler() // idempotente — activa el cron 00:00 si aún no está
  const s = getStore()
  const today = new Date().toISOString().split("T")[0]
  if (s.meta.lastSuccessAt && s.date === today) return
  await runPipeline("cold-start")
}

// ─── Reto personalizado PRO ──────────────────────────────────────────────────

/**
 * Genera un pick único para una cuota objetivo libre.
 * Exclusivo para usuarios PRO. Reutiliza el DailyData cacheado del pipeline.
 *
 * Tolerancia final: ±13% de la cuota objetivo.
 * Para nLegs=2 las patas individuales tienen rango derivado de √targetOdd.
 */
export function computeCustomRetoPick(
  targetOdd: number,
  nLegs: 1 | 2 | 3 | 4,
): { picks: any[]; combined_odd: number; combined_prob: number } | null {
  const store = getStore()
  if (!store.dailyData) return null
  const data: DailyData = store.dailyData as DailyData

  const tol = 0.13   // ±13% tolerancia para retos personalizados

  let minLegOdd: number, maxLegOdd: number
  if (nLegs === 1) {
    minLegOdd = targetOdd * (1 - tol)
    maxLegOdd = targetOdd * (1 + tol)
  } else {
    const legTarget = Math.pow(targetOdd, 1 / nLegs)
    minLegOdd = legTarget * (1 - tol - 0.04)
    maxLegOdd = legTarget * (1 + tol + 0.04)
  }

  const legLabel = nLegs === 1 ? "pick simple" : `combinada ${nLegs} picks`

  const customSpec: RetoSpec = {
    id: "custom",
    emoji: "⚙️",
    title: "Personalizado",
    days: 1,
    targetOdd,
    nLegs,
    minLegOdd: Math.round(minLegOdd * 100) / 100,
    maxLegOdd: Math.round(maxLegOdd * 100) / 100,
    minFinalOdd: Math.round(targetOdd * (1 - tol) * 100) / 100,
    maxFinalOdd: Math.round(targetOdd * (1 + tol) * 100) / 100,
    difficulty: "Custom",
    description: `Cuota personalizada ~${targetOdd.toFixed(2)} · ${legLabel}`,
    stake: 10,
    simulResult: 0,
    color: "violet",
  }

  // Use N-leg greedy algorithm for 3+ legs
  if (nLegs >= 3) {
    return computeRetoCombiN(data, customSpec, new Set<string>())
  }
  return computeRetoCombi(data, customSpec, new Set<string>())
}

// ─── Scheduler diario (00:00) ────────────────────────────────────────────────

let scheduled = false

export function startScheduler(): void {
  if (scheduled) return
  scheduled = true
  addLog("🗓️  Scheduler diario activado (ejecuta a las 00:00)")

  // Calienta el store al arrancar
  runPipeline("boot").catch(() => {})

  function scheduleNextMidnight() {
    const now = new Date()
    const next = new Date(now)
    next.setHours(24, 0, 30, 0) // 00:00:30 del día siguiente
    const ms = next.getTime() - now.getTime()
    setNextRun(next.toISOString())
    setTimeout(() => {
      runPipeline("daily-00:00").catch(() => {})
      scheduleNextMidnight()
    }, ms)
  }
  scheduleNextMidnight()

  // Refresco de cuotas cada 4h (stale-while-revalidate suave)
  setInterval(() => ensureFresh(4 * 3600_000), 60 * 60_000)
}
