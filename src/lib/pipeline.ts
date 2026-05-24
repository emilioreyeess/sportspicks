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
import {
  getStore, setStatus, addLog, recordError, setDailyResults, setNextRun, isFresh,
} from "@/lib/store"

const LEAGUE_MAP: Record<string, string> = {
  "1": "esp.1", "2": "eng.1", "3": "ger.1", "4": "ita.1", "5": "fra.1",
}

// ─── Value engine — umbrales (calibrados para 3-8 picks/día manteniendo calidad) ─
const MIN_EDGE = 3
const MAX_EDGE = 15
const MIN_ODD = 1.40
const QUALITY_GATE = 52
const MAX_PICKS = 10

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
  await Promise.all(queue.map(async (m) => {
    const [home, away] = await Promise.all([
      fetchTeamForm(m.slug, m.homeId),
      fetchTeamForm(m.slug, m.awayId),
    ])
    if (home && away) withForm.push({ ...m, home, away })
  }))

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
    if (c.prob >= 0.55) return true
    if (c.prob >= 0.45 && c.contextScore >= 55) return true
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

export function computeValuePicks(data: DailyData): { picks: any[]; note?: string } {
  const picks: any[] = []

  for (const m of data.matches) {
    const reliability = (Math.min(m.home.gamesPlayed, 10) + Math.min(m.away.gamesPlayed, 10)) / 20
    let best: { c: Candidate; odd: number; edge: number; quality: number } | null = null

    for (const c of buildCandidates(m)) {
      if (c.suppressed) continue
      const odd = m.odds[c.key]
      if (!odd || !isFinite(odd) || odd < MIN_ODD) continue // validación de cuota
      const edge = Math.round((c.prob * 100 - impliedPct(odd)) * 10) / 10
      if (edge < MIN_EDGE || edge > MAX_EDGE) continue

      const edgeScore = 25 + clamp((edge - MIN_EDGE) / (MAX_EDGE - MIN_EDGE), 0, 1) * 75
      const marketScore = clamp((odd - MIN_ODD) / (4.5 - MIN_ODD), 0, 1) * 100
      const quality = Math.round(0.38 * edgeScore + 0.30 * c.contextScore + 0.16 * marketScore + 0.16 * reliability * 100)

      if (!commonSensePass(c, m)) continue           // ¿lo aprobaría un analista pro?
      if (quality < QUALITY_GATE) continue
      if (!best || quality > best.quality) best = { c, odd, edge, quality }
    }
    if (!best) continue

    const conf = Math.round(best.c.prob * 100)
    const imp = impliedPct(best.odd)
    const valueReason = best.c.story ||
      `El mercado valora esta selección en ${imp}%; el modelo la sitúa en ${(best.c.prob * 100).toFixed(1)}%.`

    const risk = riskTier(best.c.prob, best.odd, best.quality)
    picks.push({
      id: m.id,
      home_team: m.homeName, away_team: m.awayName,
      league_name: LEAGUE_NAMES[m.slug] ?? m.slug, kickoff_utc: m.kickoff,
      market: best.c.market, selection: best.c.selection,
      confidence_pct: conf, confidence_tier: valueTier(best.quality),
      model_prob: Math.round(best.c.prob * 1000) / 10,
      best_odd: best.odd, value_edge: best.edge, bookmaker: m.odds.provider,
      quality_score: best.quality, value_reason: valueReason,
      risk_tier: risk,
      result: "PENDING", plan_required: best.quality >= 72 ? "premium" : "basic",
      reasons: [
        `💡 ${valueReason}`,
        ...best.c.extra,
        `Cuota real (${m.odds.provider}): ${best.odd.toFixed(2)} → prob. implícita ${imp}%`,
        `Probabilidad del modelo: ${(best.c.prob * 100).toFixed(1)}% → edge real +${best.edge.toFixed(1)}%`,
        `Score de calidad: ${best.quality}/100 · Riesgo ${risk === "low" ? "🟢 conservador" : risk === "mid" ? "🟡 medio" : "🔴 alto"}`,
      ],
    })
  }

  picks.sort((a, b) => b.quality_score - a.quality_score)
  const capped = picks.slice(0, MAX_PICKS)
  return {
    picks: capped,
    note: capped.length === 0
      ? "Hoy el modelo no detecta valor real con respaldo de contexto. No publicamos picks por publicar."
      : undefined,
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

export function buildCombinadaPool(data: DailyData): PoolEntry[] {
  const pool: PoolEntry[] = []
  for (const m of data.matches) {
    const matchName = `${m.homeName} vs ${m.awayName}`
    const league = LEAGUE_NAMES[m.slug] ?? m.slug
    for (const c of buildCandidates(m)) {
      if (c.suppressed) continue
      const odd = m.odds[c.key]
      if (!odd || odd <= 1.05) continue
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
    return { error: `Solo ${perMatch.length} selección(es) cumplen el modo ${cfg.label} para esta liga hoy. Prueba otra liga u otro modo.` }
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
    days: 15, targetOdd: 1.25, nLegs: 1,
    difficulty: "Baja",
    description: "15 días · 1 pick diario a cuota ~1.25. Alta probabilidad, riesgo mínimo. El reto para construir racha.",
    stake: 10, simulResult: 284, color: "emerald",
  },
  {
    id: "balanceado", emoji: "⭐", title: "Balanceado",
    days: 10, targetOdd: 1.40, nLegs: 2,
    difficulty: "Media",
    description: "10 días · Mini-combinada de 2 picks a cuota ~1.18 cada uno. Más variedad, mismo objetivo.",
    stake: 10, simulResult: 289, color: "amber",
  },
  {
    id: "agresivo", emoji: "🔥", title: "Agresivo",
    days: 5, targetOdd: 2.00, nLegs: 2,
    difficulty: "Alta",
    description: "5 días · Mini-combinada de 2 picks a cuota ~1.41 cada uno. Mercados variados, cuota objetivo 2.0.",
    stake: 10, simulResult: 320, color: "rose",
  },
  {
    id: "elite", emoji: "👑", title: "Élite",
    days: 4, targetOdd: 3.00, nLegs: 2,
    difficulty: "Muy alta",
    description: "4 días · Mini-combinada de 2 picks a cuota ~1.73 cada uno. Value real, sin buscar picks imposibles.",
    stake: 10, simulResult: 810, color: "violet",
  },
]

interface RetoPick {
  match: string; league: string; kickoff: string
  selection: string; market: string; odd: number
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
    match: `${m.homeName} vs ${m.awayName}`,
    league: LEAGUE_NAMES[m.slug] ?? m.slug,
    kickoff: m.kickoff,
    selection: rc.c.selection,
    market: rc.c.market,
    odd: rc.odd,
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

  // Construir pool de candidatos calificados (sin restricción de cuota aquí)
  const cands: RawCand[] = []

  for (const m of data.matches) {
    const reliability = (Math.min(m.home.gamesPlayed, 10) + Math.min(m.away.gamesPlayed, 10)) / 20

    for (const c of buildCandidates(m)) {
      if (c.suppressed) continue
      const odd = m.odds[c.key]
      if (!odd || !isFinite(odd) || odd < 1.06 || odd > 7.0) continue
      if (c.prob < 0.42) continue
      if (!commonSensePass(c, m)) continue
      const edge = Math.round((c.prob * 100 - impliedPct(odd)) * 10) / 10
      if (edge < 0.8) continue

      const edgeScore = 25 + clamp((edge - 0.8) / 12, 0, 1) * 75
      const quality = Math.round(0.45 * edgeScore + 0.40 * c.contextScore + 0.15 * reliability * 100)
      cands.push({ match: m, c, odd, edge, quality })
    }
  }

  // Ordenar por calidad descendente y tomar top-30
  cands.sort((a, b) => b.quality - a.quality)
  const pool = cands.slice(0, 30)

  // ── 1 pata ────────────────────────────────────────────────────────────────
  if (spec.nLegs === 1) {
    // Buscar pick cuya cuota esté dentro del 25% del objetivo
    for (const rc of pool) {
      if (usedMatches.has(rc.match.id)) continue
      const dev = Math.abs(rc.odd - spec.targetOdd) / spec.targetOdd
      if (dev > 0.25) continue
      usedMatches.add(rc.match.id)
      return {
        picks: [buildRetoPick(rc)],
        combined_odd: Math.round(rc.odd * 100) / 100,
        combined_prob: Math.round(rc.c.prob * 100),
      }
    }
    // fallback: mejor disponible sin restricción de cuota
    const best = pool.find((rc) => !usedMatches.has(rc.match.id))
    if (!best) return null
    usedMatches.add(best.match.id)
    return {
      picks: [buildRetoPick(best)],
      combined_odd: Math.round(best.odd * 100) / 100,
      combined_prob: Math.round(best.c.prob * 100),
    }
  }

  // ── 2 patas: buscar pareja con producto ≈ targetOdd ───────────────────────
  let bestPair: [RawCand, RawCand] | null = null
  let bestScore = -Infinity

  for (let i = 0; i < pool.length; i++) {
    if (usedMatches.has(pool[i].match.id)) continue
    for (let j = i + 1; j < pool.length; j++) {
      if (usedMatches.has(pool[j].match.id)) continue
      if (pool[i].match.id === pool[j].match.id) continue
      const combined = pool[i].odd * pool[j].odd
      const deviation = Math.abs(combined - spec.targetOdd) / spec.targetOdd
      if (deviation > 0.28) continue   // ±28% del objetivo
      const score = (pool[i].quality + pool[j].quality) / 2 - deviation * 70
      if (score > bestScore) { bestScore = score; bestPair = [pool[i], pool[j]] }
    }
  }

  if (bestPair) {
    usedMatches.add(bestPair[0].match.id)
    usedMatches.add(bestPair[1].match.id)
    const combined_odd = Math.round(bestPair[0].odd * bestPair[1].odd * 100) / 100
    const combined_prob = Math.round(bestPair[0].c.prob * bestPair[1].c.prob * 10000) / 100
    return { picks: bestPair.map(buildRetoPick), combined_odd, combined_prob }
  }

  // Fallback: los 2 mejores disponibles sin restricción de cuota objetivo
  const avail: RawCand[] = []
  const seenMatches = new Set<string>()
  for (const rc of pool) {
    if (usedMatches.has(rc.match.id) || seenMatches.has(rc.match.id)) continue
    seenMatches.add(rc.match.id)
    avail.push(rc)
    if (avail.length === 2) break
  }
  if (avail.length === 0) return null
  for (const rc of avail) usedMatches.add(rc.match.id)
  const combined_odd = Math.round(avail.reduce((a, rc) => a * rc.odd, 1) * 100) / 100
  const combined_prob = Math.round(avail.reduce((a, rc) => a * rc.c.prob, 1) * 10000) / 100
  return { picks: avail.map(buildRetoPick), combined_odd, combined_prob }
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

      const { picks, note: picksNote } = computeValuePicks(data)
      addLog(`🎯 ${picks.length} value picks generados`)

      const combinadaPool = buildCombinadaPool(data)
      addLog(`🎲 Pool de combinadas: ${combinadaPool.length} selecciones candidatas`)

      const { challenges, note: retosNote } = computeRetos(data)
      addLog(`🏆 ${challenges.length} retos con pick diario real`)

      setDailyResults({
        date: new Date().toISOString().split("T")[0],
        valuePicks: picks, picksNote,
        combinadaPool, retos: challenges, retosNote,
        matches: data.matches.length,
        durationMs: Date.now() - t0,
      })
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
