/**
 * MOTOR CUANTITATIVO COMPARTIDO — datos 100% reales de ESPN.
 *
 * Lo usan /api/picks y /api/combinadas para garantizar la MISMA lógica:
 *  - Cuotas reales de DraftKings (vía scoreboard de ESPN)
 *  - Modelo Poisson ajustado por rival con regresión a la media
 *  - Motor de motivación con la clasificación real (campeón, descenso, Europa)
 *
 * Nada se inventa. Si una fuente no existe, la función devuelve null.
 */

export const SHRINK_K = 8          // regresión a la media (muestra pequeña)
export const MIN_GAMES = 5         // datos insuficientes por debajo de esto

export const LEAGUE_NAMES: Record<string, string> = {
  "esp.1":            "LaLiga",
  "eng.1":            "Premier League",
  "ger.1":            "Bundesliga",
  "ita.1":            "Serie A",
  "fra.1":            "Ligue 1",
  "usa.1":            "MLS",
  "arg.1":            "Liga Argentina",
  "bra.1":            "Brasileirão",
  "por.1":            "Primeira Liga",
  "uefa.champions":   "Champions League",
  "uefa.europa":      "Europa League",
  "UEFA.NL":          "UEFA Nations League",
  "mex.1":            "Liga MX",
  "ned.1":            "Eredivisie",
  "tur.1":            "Süper Lig",
  "sau.1":            "Saudi Pro League",
  "sco.1":            "Scottish Premiership",
  "bel.1":            "Pro League Bélgica",
  "col.1":            "Liga BetPlay",
  "chi.1":            "Primera División Chile",
  "jpn.1":            "J1 League",
  "FIFA.WC":          "Mundial 2026 (Clasificación)",
  "CONCACAF.WC":      "Clasificación CONCACAF",
  "CONMEBOL.WC":      "Clasificación CONMEBOL",
  "UEFA.EURO":        "UEFA Euro",
  "CONCACAF.NATIONS": "Nations League CONCACAF",
}

export const ALL_SLUGS = [
  // Top 5 Europa
  "esp.1", "eng.1", "ger.1", "ita.1", "fra.1",
  // Competiciones europeas
  "uefa.champions", "uefa.europa", "UEFA.NL",
  // Otras europeas
  "por.1", "ned.1", "tur.1", "sco.1", "bel.1",
  // América
  "usa.1", "arg.1", "bra.1", "mex.1", "col.1", "chi.1",
  // Oriente Medio & Asia
  "sau.1", "jpn.1", "kor.1", "chn.1",
  // Ligas menores ACTIVAS EN VERANO (fallback de volumen para retos/combinadas
  // cuando las top europeas están en parón). Si ESPN no cubre alguna, su fetch
  // devuelve null y se ignora — sin coste.
  "nor.1", "swe.1", "fin.1", "irl.1", "usa.2", "bra.2",
  // Mundial & Selecciones
  "FIFA.WC", "CONCACAF.WC", "CONMEBOL.WC", "UEFA.EURO",
  "CONCACAF.NATIONS",
]

/** Perfil cualitativo por competición — el motor lo usa como contexto, no genera picks. */
export const LEAGUE_PROFILE: Record<string, { label: string; intensity: number; notes: string }> = {
  "esp.1":          { label: "LaLiga · técnica",        intensity: 1.00, notes: "Equipos técnicos, ritmo medio" },
  "eng.1":          { label: "Premier · ritmo alto",    intensity: 1.05, notes: "Transiciones rápidas, presión alta" },
  "ger.1":          { label: "Bundesliga · abierta",    intensity: 1.00, notes: "Marcadores abiertos, mucha presión" },
  "ita.1":          { label: "Serie A · táctica",       intensity: 1.00, notes: "Defensiva, marcadores ajustados" },
  "fra.1":          { label: "Ligue 1",                 intensity: 1.00, notes: "Liga de perfil mixto" },
  "usa.1":          { label: "MLS · ritmo alto",        intensity: 1.05, notes: "Ofensiva, ataques rápidos, muchos córners" },
  "arg.1":          { label: "Argentina · intensa",     intensity: 1.12, notes: "Mucha falta y tarjeta, marcador ajustado" },
  "bra.1":          { label: "Brasileirão · competitiva", intensity: 1.08, notes: "Igualada, sorpresas frecuentes" },
  "por.1":          { label: "Primeira",                intensity: 1.00, notes: "Top 3 vs resto, ojo con descenso" },
  "uefa.champions": { label: "Champions · alta tensión", intensity: 1.10, notes: "Tensión competitiva máxima" },
  "mex.1":          { label: "Liga MX · competitiva",   intensity: 1.05, notes: "Ida y vuelta, equipos parejos" },
  "ned.1":          { label: "Eredivisie · abierta",    intensity: 1.05, notes: "Ofensiva, muchos goles" },
  "tur.1":          { label: "Süper Lig · intensa",     intensity: 1.08, notes: "Muy competitiva, alta intensidad" },
  "sau.1":          { label: "Saudi Pro League",        intensity: 1.02, notes: "Liga en expansión, grandes fichajes" },
  "sco.1":          { label: "Scottish Premiership",   intensity: 1.03, notes: "Celtic dominante, dinámicas claras" },
}

// ─── Helpers numéricos ─────────────────────────────────────────────────────────

export function clamp(v: number, lo: number, hi: number) { return Math.min(Math.max(v, lo), hi) }

export function parseScoreNum(s: any): number {
  if (s == null) return 0
  if (typeof s === "number") return s
  if (typeof s === "string") return parseInt(s) || 0
  if (typeof s === "object" && s.displayValue) return parseInt(s.displayValue) || 0
  return 0
}

export function impliedPct(odd: number): number {
  return Math.round((1 / odd) * 1000) / 10
}

/**
 * True Odds (cuota justa) + Edge a partir de la probabilidad del modelo y la
 * cuota del mercado. `isValue` exige edge positivo y < 50% (filtro anti-ruido
 * de API / cuotas erróneas).
 */
export function calculateValueMetrics(modelProbability: number, bookmakerOdds: number) {
  if (modelProbability <= 0 || modelProbability > 1 || !bookmakerOdds) {
    return { isValue: false, trueOdds: 0, edge: 0 }
  }
  const trueOdds = 1 / modelProbability
  const edgeDecimal = (bookmakerOdds * modelProbability) - 1
  const edgePercentage = Number((edgeDecimal * 100).toFixed(2))
  const isValue = edgePercentage > 0 && edgePercentage < 50 // Filtro anti-ruido de API

  return {
    isValue,
    trueOdds: Number(trueOdds.toFixed(2)),
    edge: edgePercentage,
  }
}

/** Cuota americana ("+145", "-110", 235) → decimal */
export function americanToDecimal(a: any): number | null {
  if (a == null) return null
  const n = typeof a === "number" ? a : parseInt(String(a).replace(/[+\s]/g, ""))
  if (!isFinite(n) || n === 0) return null
  const dec = n > 0 ? n / 100 + 1 : 100 / Math.abs(n) + 1
  return Math.round(dec * 100) / 100
}

export function poisson(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0
  let p = Math.exp(-lambda)
  for (let i = 1; i <= k; i++) p *= lambda / i
  return p
}

export function shrink(raw: number, n: number, mean: number): number {
  return (raw * n + mean * SHRINK_K) / (n + SHRINK_K)
}

export async function fetchJSON(url: string, timeout = 8000): Promise<any | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(timeout) })
    if (!res.ok) return null
    return await res.json()
  } catch { return null }
}

// ─── Clasificación + motor de motivación (standings reales de ESPN) ────────────

export interface TableRow {
  teamId: string; name: string
  rank: number; points: number
  played: number; gamesRemaining: number
}
export interface LeagueTable { rows: TableRow[]; byId: Map<string, TableRow>; N: number }

export async function fetchStandings(slug: string): Promise<LeagueTable | null> {
  const data = await fetchJSON(`https://site.api.espn.com/apis/v2/sports/soccer/${slug}/standings`)
  const entries: any[] = data?.children?.[0]?.standings?.entries ?? []
  if (entries.length < 6) return null

  const stat = (e: any, name: string): number => {
    const s = (e.stats ?? []).find((x: any) => x.name === name)
    return s ? Number(s.value) || 0 : 0
  }

  const rows: TableRow[] = entries.map((e: any) => ({
    teamId: String(e.team?.id),
    name: e.team?.displayName ?? "",
    rank: stat(e, "rank"),
    points: stat(e, "points"),
    played: stat(e, "gamesPlayed"),
    gamesRemaining: 0,
  }))

  const N = rows.length
  const totalGames = (N - 1) * 2
  for (const r of rows) r.gamesRemaining = Math.max(0, totalGames - r.played)
  rows.sort((a, b) => (a.rank || 99) - (b.rank || 99))

  const byId = new Map<string, TableRow>()
  for (const r of rows) byId.set(r.teamId, r)
  return { rows, byId, N }
}

export interface Motivation {
  status: string         // texto legible
  factor: number         // multiplica la fuerza ofensiva (0.80-1.06)
  rank: number
  available: boolean
  dead: boolean          // true = equipo sin nada en juego (campeón/descendido/salvado sin Europa)
}

export const NEUTRAL_MOTIV: Motivation = {
  status: "Contexto de clasificación no disponible", factor: 1.0, rank: 0, available: false, dead: false,
}

export function classifyMotivation(teamId: string, table: LeagueTable | null): Motivation {
  if (!table) return NEUTRAL_MOTIV
  const me = table.byId.get(teamId)
  if (!me) return NEUTRAL_MOTIV

  const { rows, N } = table
  const myMax = me.points + me.gamesRemaining * 3
  const leader = rows[0]
  const runnerUp = rows[1]
  const seventh = rows[Math.min(6, N - 1)]
  const bottom3 = rows.slice(N - 3)
  const firstSafe = rows[N - 4]

  const canReachEurope = myMax >= (seventh?.points ?? 999)
  const caughtByDropZone = bottom3.some(b => b.teamId !== teamId && (b.points + b.gamesRemaining * 3) >= me.points)
  const stillCanDrop = me.rank >= N - 6 && caughtByDropZone && me.gamesRemaining > 0

  if (me.rank === 1 && runnerUp && me.points > runnerUp.points + runnerUp.gamesRemaining * 3) {
    return { status: `Campeón confirmado (${me.rank}º) — sin objetivos, riesgo de rotación`, factor: 0.82, rank: me.rank, available: true, dead: true }
  }
  if (firstSafe && myMax < firstSafe.points && me.rank >= N - 3) {
    return { status: `Descendido matemáticamente (${me.rank}º) — nada en juego`, factor: 0.80, rank: me.rank, available: true, dead: true }
  }
  if (stillCanDrop) {
    return { status: `Pelea por la permanencia (${me.rank}º) — máxima motivación`, factor: 1.06, rank: me.rank, available: true, dead: false }
  }
  if (me.rank > 1 && me.rank <= 4 && myMax >= leader.points && me.gamesRemaining > 0) {
    return { status: `Lucha por el título (${me.rank}º) — alta motivación`, factor: 1.04, rank: me.rank, available: true, dead: false }
  }
  if (me.rank === 1) {
    return { status: `Líder (${me.rank}º) — peleando el título`, factor: 1.0, rank: me.rank, available: true, dead: false }
  }
  if (me.rank <= 8 && canReachEurope && me.gamesRemaining > 0) {
    return { status: `Pelea por puestos europeos (${me.rank}º) — motivado`, factor: 1.0, rank: me.rank, available: true, dead: false }
  }
  if (!stillCanDrop && !canReachEurope) {
    return { status: `Sin objetivos (${me.rank}º) — salvado y sin opciones europeas`, factor: 0.84, rank: me.rank, available: true, dead: true }
  }
  return { status: `Media tabla (${me.rank}º) — motivación moderada`, factor: 0.93, rank: me.rank, available: true, dead: false }
}

// ─── Cuotas reales de ESPN (proveedor: DraftKings u otro) ──────────────────────

export interface RealOdds {
  provider: string
  home?: number; draw?: number; away?: number
  over25?: number; under25?: number
  spreadLine?: number; spreadHome?: number; spreadAway?: number
  // BTTS — Ambos Marcan (mercado REAL ID 8 de API-Football: "Yes"/"No").
  bttsYes?: number; bttsNo?: number
  // Doble Oportunidad (mercado REAL de API-Football, no derivado de 1X2).
  // Respaldo legítimo cuando un partido no tiene 1X2 publicado.
  doubleChance?: { homeDraw?: number; homeAway?: number; drawAway?: number }
}

export function extractOdds(comp: any): RealOdds | null {
  const o = comp?.odds?.[0]
  if (!o) return null
  const provider = o.provider?.name ?? "Casa de apuestas"
  const ml = o.moneyline
  const homeAm = ml?.home?.close?.odds ?? ml?.home?.open?.odds
  const awayAm = ml?.away?.close?.odds ?? ml?.away?.open?.odds
  const drawAm = o.drawOdds?.moneyLine

  const line = o.overUnder
  const overLine = o.total?.over?.close?.line ?? o.total?.over?.open?.line ?? ""
  const is25 = line === 2.5 || String(overLine).includes("2.5")
  const overAm = is25 ? (o.total?.over?.close?.odds ?? o.total?.over?.open?.odds) : null
  const underAm = is25 ? (o.total?.under?.close?.odds ?? o.total?.under?.open?.odds) : null

  const odds: RealOdds = {
    provider,
    home: americanToDecimal(homeAm) ?? undefined,
    draw: americanToDecimal(drawAm) ?? undefined,
    away: americanToDecimal(awayAm) ?? undefined,
    over25: americanToDecimal(overAm) ?? undefined,
    under25: americanToDecimal(underAm) ?? undefined,
  }

  // Hándicap (point spread) — solo líneas .5 para evitar empate de hándicap (push)
  const spRaw = o.pointSpread?.home?.close?.line ?? o.pointSpread?.home?.open?.line
  const spLine = spRaw != null ? parseFloat(String(spRaw)) : NaN
  if (isFinite(spLine) && Math.abs(spLine % 1) === 0.5) {
    const sh = americanToDecimal(o.pointSpread?.home?.close?.odds ?? o.pointSpread?.home?.open?.odds)
    const sa = americanToDecimal(o.pointSpread?.away?.close?.odds ?? o.pointSpread?.away?.open?.odds)
    if (sh && sa) { odds.spreadLine = spLine; odds.spreadHome = sh; odds.spreadAway = sa }
  }

  if (!odds.home && !odds.away && !odds.over25 && !odds.under25) return null
  return odds
}

// [ELIMINADO] fetchEventOddsCore — scraping de cuotas de ESPN. El motor de
// predicciones ahora lee las cuotas EXCLUSIVAMENTE de API-Football (/odds) vía
// fetchFixtureOddsAF() en footballApi.ts. Cero scraping de cuotas de ESPN.

/** Probabilidad de cubrir hándicap a partir de los goles esperados (líneas .5) */
export function handicapProb(lambdaHome: number, lambdaAway: number, line: number): { home: number; away: number } {
  const MAX = 8
  let home = 0, away = 0
  for (let i = 0; i <= MAX; i++) {
    for (let j = 0; j <= MAX; j++) {
      const p = poisson(i, lambdaHome) * poisson(j, lambdaAway)
      if ((i - j) + line > 0) home += p
      else away += p
    }
  }
  return { home, away }
}

// ─── Forma reciente real (schedule de ESPN) ────────────────────────────────────

export interface TeamForm {
  goalsFor: number; goalsAgainst: number
  over25Pct: number; cleanSheetPct: number
  gamesPlayed: number
  form: string            // ej "WWDLW"
  formPoints: number      // 0-1 (últimos 5)
  recentDates: string[]   // fechas ISO de partidos completados, desc
}

export async function fetchTeamForm(slug: string, teamId: string): Promise<TeamForm | null> {
  const data = await fetchJSON(
    `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/teams/${teamId}/schedule`, 6000
  )
  if (!data) return null
  const completed: any[] = (data?.events ?? [])
    .filter((ev: any) => ev.competitions?.[0]?.status?.type?.completed)
    .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
  if (completed.length < MIN_GAMES) return null

  const last10 = completed.slice(0, 10)
  let gf = 0, ga = 0, over25 = 0, cs = 0
  const results: string[] = []
  const recentDates: string[] = []

  for (const ev of last10) {
    const comp = ev.competitions[0]
    const me = comp.competitors?.find((c: any) => String(c.team?.id) === String(teamId))
    const opp = comp.competitors?.find((c: any) => String(c.team?.id) !== String(teamId))
    if (!me || !opp) continue
    const myScore = parseScoreNum(me.score)
    const oppScore = parseScoreNum(opp.score)
    gf += myScore; ga += oppScore
    if (myScore + oppScore > 2) over25++
    if (oppScore === 0) cs++
    results.push(myScore > oppScore ? "W" : myScore < oppScore ? "L" : "D")
    recentDates.push(ev.date)
  }

  const n = last10.length
  const last5 = results.slice(0, 5)
  const formPts = last5.reduce((s, r) => s + (r === "W" ? 3 : r === "D" ? 1 : 0), 0)
  return {
    goalsFor: gf / n, goalsAgainst: ga / n,
    over25Pct: over25 / n, cleanSheetPct: cs / n,
    gamesPlayed: n,
    form: last5.join(""),
    formPoints: last5.length ? formPts / (last5.length * 3) : 0.5,
    recentDates,
  }
}

// ─── Modelo Poisson ajustado por rival + motivación ────────────────────────────

export interface ModelOut {
  lambdaHome: number; lambdaAway: number
  pHome: number; pDraw: number; pAway: number
  pOver: number; pUnder: number
}

export function modelMatch(
  home: TeamForm, away: TeamForm,
  homeMotiv: Motivation, awayMotiv: Motivation,
  leagueAvg: number,
  // OPCIÓN C — pesos por confederación (1.0 = sin efecto, p.ej. clubes). En
  // partidos de selecciones se pasa el peso del analista para ponderar la fuerza
  // base ANTES del Poisson. Default 1.0 → comportamiento idéntico al anterior.
  confedWeightHome = 1, confedWeightAway = 1,
): ModelOut {
  const la = clamp(leagueAvg, 1.0, 2.0)

  const hGF = shrink(home.goalsFor, home.gamesPlayed, la)
  const hGA = shrink(home.goalsAgainst, home.gamesPlayed, la)
  const aGF = shrink(away.goalsFor, away.gamesPlayed, la)
  const aGA = shrink(away.goalsAgainst, away.gamesPlayed, la)

  // La fuerza base (goles esperados) se multiplica por el peso de confederación
  // ANTES de derivar las probabilidades Poisson (1X2 / Over-Under).
  let lh = (hGF * aGA) / la * 1.10 * homeMotiv.factor * confedWeightHome
  let lw = (aGF * hGA) / la * 0.92 * awayMotiv.factor * confedWeightAway
  lh = clamp(lh, 0.15, 4.5)
  lw = clamp(lw, 0.15, 4.5)

  const MAX = 8
  let pH = 0, pD = 0, pA = 0, pO = 0, pU = 0
  for (let i = 0; i <= MAX; i++) {
    for (let j = 0; j <= MAX; j++) {
      const p = poisson(i, lh) * poisson(j, lw)
      if (i > j) pH += p
      else if (i === j) pD += p
      else pA += p
      if (i + j >= 3) pO += p
      else pU += p
    }
  }
  return { lambdaHome: lh, lambdaAway: lw, pHome: pH, pDraw: pD, pAway: pA, pOver: pO, pUnder: pU }
}
