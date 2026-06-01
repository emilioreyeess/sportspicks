/**
 * Yesterday-pick re-verification.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Problema histórico: el pipeline diario escribe `picks:yesterday` en KV una
 * sola vez (06:30 UTC). Si en ese momento algún partido aún no estaba marcado
 * como `completed` en ESPN, el pick se quedaba PENDING y nunca se re-verificaba
 * — la UI mostraba "Pendiente" todo el día aunque el partido hubiera terminado
 * a las 21:00 del día anterior.
 *
 * Este módulo re-evalúa los picks PENDING del snapshot guardado en KV/store y
 * los liquida contra los marcadores finales de ESPN (scoreboard por liga + día).
 * Lo invocan:
 *   1. GET /api/picks/yesterday (throttled, on-read)
 *   2. Cron /api/cron/ml-settle (post-ciclo ML)
 *
 * Idempotente: si no hay PENDING, no hace nada. Si ESPN no devuelve final aún,
 * el pick sigue PENDING. Nunca inventa resultados.
 */

import { ALL_SLUGS } from "@/lib/engine"
import { getStore, setYesterdayResults } from "@/lib/store"

const ESPN_TIMEOUT_MS = 6000
const ESPN_GRACE_MIN = 130 // margen tras kickoff antes de intentar liquidar

/* ── Normalización tolerante de nombres ESPN ────────────────────────────────
   ESPN devuelve a veces "Real Madrid", a veces "Real Madrid CF", a veces "Real
   Madrid C.F.". Aplicamos: lowercase → strip diacritics → quita puntuación →
   quita sufijos club ("fc", "cf", "afc", "sc", "ac", "1.fc", "fk") → trim. */
const CLUB_SUFFIXES = /\b(fc|cf|afc|sc|ac|cd|cp|ad|ud|sd|cf|fk|fsv|kv|vfb|vfl|borussia)\b/g

export function normTeam(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[._'`’]/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(CLUB_SUFFIXES, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** Devuelve un token-set para matching tolerante (substring + Jaccard). */
function tokenSet(s: string): Set<string> {
  return new Set(normTeam(s).split(" ").filter((t) => t.length >= 3))
}

/** Match laxo entre dos nombres de equipo. Devuelve true si:
 *   · normTeam(a) === normTeam(b), o
 *   · uno es substring (≥4 chars) del otro, o
 *   · sus token-sets comparten ≥1 token de ≥4 chars. */
function teamMatch(a: string, b: string): boolean {
  const na = normTeam(a)
  const nb = normTeam(b)
  if (!na || !nb) return false
  if (na === nb) return true
  if (na.length >= 4 && nb.includes(na)) return true
  if (nb.length >= 4 && na.includes(nb)) return true
  const ta = tokenSet(a)
  const tb = tokenSet(b)
  for (const t of ta) if (t.length >= 4 && tb.has(t)) return true
  return false
}

/* ── Evaluación del resultado por mercado ────────────────────────────────── */

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
    if (selection === "Empate") return homeScore === awayScore ? "WIN" : "LOSS"
    return "VOID"
  }
  if (market === "Over/Under 2.5") {
    if (selection === "Over 2.5 Goles") return total > 2 ? "WIN" : "LOSS"
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
    return "VOID"
  }
  return "VOID"
}

/* ── Recolección de marcadores finales ESPN ──────────────────────────────── */

interface FinalScore { homeName: string; awayName: string; homeScore: number; awayScore: number }

async function fetchDayFinals(yyyymmdd: string): Promise<FinalScore[]> {
  const out: FinalScore[] = []
  await Promise.all(ALL_SLUGS.map(async (slug) => {
    try {
      const res = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/soccer/${encodeURIComponent(slug)}/scoreboard?dates=${yyyymmdd}`,
        { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(ESPN_TIMEOUT_MS) },
      )
      if (!res.ok) return
      const data = await res.json()
      for (const ev of data?.events ?? []) {
        const comp = ev.competitions?.[0]
        if (!comp?.status?.type?.completed) continue
        const home = comp.competitors?.find((c: any) => c.homeAway === "home")
        const away = comp.competitors?.find((c: any) => c.homeAway === "away")
        if (!home?.team?.displayName || !away?.team?.displayName) continue
        out.push({
          homeName: home.team.displayName,
          awayName: away.team.displayName,
          homeScore: parseInt(home.score ?? "0", 10) || 0,
          awayScore: parseInt(away.score ?? "0", 10) || 0,
        })
      }
    } catch { /* liga con error → seguimos */ }
  }))
  return out
}

/* ── Throttle in-memory (anti-hammering ESPN desde GET) ──────────────────── */

let lastRefreshAt = 0
const REFRESH_MIN_INTERVAL_MS = 5 * 60_000 // 5 min entre re-verificaciones forzadas por GET

export interface RefreshOutcome {
  ran: boolean
  reason: string
  date: string | null
  before: { pending: number; settled: number }
  after:  { pending: number; settled: number; wins: number; losses: number; voids: number }
}

/**
 * Re-verifica los picks PENDING del snapshot "yesterday" actual. Si encuentra
 * cambios, persiste el snapshot actualizado (memoria + /tmp + KV).
 *
 * @param opts.force  ignora el throttle (úsalo desde cron).
 * @param opts.minPending  no hace nada si hay menos PENDING que este número.
 */
export async function refreshYesterdayPicks(opts: {
  force?: boolean
  minPending?: number
} = {}): Promise<RefreshOutcome> {
  const { force = false, minPending = 1 } = opts
  const now = Date.now()
  const store = getStore()
  const current = store.yesterday

  const out: RefreshOutcome = {
    ran: false,
    reason: "",
    date: current.date,
    before: { pending: 0, settled: 0 },
    after:  { pending: 0, settled: 0, wins: 0, losses: 0, voids: 0 },
  }

  if (!current.date || !current.picks?.length) {
    out.reason = "no-yesterday-snapshot"
    return out
  }

  const pending = current.picks.filter((p: any) => p?.result === "PENDING")
  out.before.pending = pending.length
  out.before.settled = current.picks.length - pending.length

  if (pending.length < minPending) {
    out.reason = "no-pending"
    return out
  }
  if (!force && (now - lastRefreshAt) < REFRESH_MIN_INTERVAL_MS) {
    out.reason = "throttled"
    return out
  }

  // Antes de pegarle a ESPN: ¿ha pasado al menos la grace post-kickoff?
  // (si todos los pending son partidos que aún están en curso, no perdemos
  // tiempo en una llamada que devolverá completed=false).
  const hasMatureKickoff = pending.some((p: any) => {
    const k = p?.kickoff_utc ? new Date(p.kickoff_utc).getTime() : NaN
    return isFinite(k) && (now - k) >= ESPN_GRACE_MIN * 60_000
  })
  if (!hasMatureKickoff && !force) {
    out.reason = "all-pending-too-fresh"
    return out
  }

  lastRefreshAt = now

  // Recolectar finales del día
  const yyyymmdd = current.date.replace(/-/g, "")
  const finals = await fetchDayFinals(yyyymmdd)

  // Resolver cada pick: si encontramos un final que matchea por nombres → liquidar.
  const updated = current.picks.map((pick: any) => {
    if (pick?.result && pick.result !== "PENDING") return pick
    const final = finals.find((f) =>
      teamMatch(f.homeName, pick.home_team) && teamMatch(f.awayName, pick.away_team)
    )
    if (!final) return pick
    const result = evaluateResult(pick, final.homeScore, final.awayScore)
    return {
      ...pick,
      result,
      home_score: final.homeScore,
      away_score: final.awayScore,
      settled_at: new Date().toISOString(),
    }
  })

  // Recalcular tally
  const wins   = updated.filter((p: any) => p.result === "WIN").length
  const losses = updated.filter((p: any) => p.result === "LOSS").length
  const voids  = updated.filter((p: any) => p.result === "VOID").length
  const stillPending = updated.filter((p: any) => p.result === "PENDING").length

  out.after = { pending: stillPending, settled: wins + losses + voids, wins, losses, voids }

  // Solo persistimos si hubo cambio real (evita rewrites innecesarios de KV)
  const changed = stillPending < pending.length
  if (changed) {
    setYesterdayResults(current.date, updated)
  }
  out.ran = changed
  out.reason = changed
    ? `settled ${pending.length - stillPending} pick(s)`
    : "no-final-found-yet"
  return out
}
