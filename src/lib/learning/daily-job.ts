/**
 * Daily Learning Job — orquesta el ciclo completo:
 *
 *  1. Verifica resultados de los picks publicados ayer (vía ESPN)
 *  2. Actualiza cada PickRecord con su result (WIN/LOSS/VOID)
 *  3. Recalcula patterns sobre la ventana de WINDOW_DAYS
 *  4. Decide ajustes de pesos con safeguards
 *  5. Aplica ajustes y guarda nueva WeightsConfig
 *  6. Genera el LearningReport del día
 *
 * Se ejecuta vía POST /api/cron/daily-learning (Vercel Cron a las 00:05 UTC).
 *
 * Idempotente: si se llama dos veces el mismo día, no duplica trabajo.
 */

import type { PickRecord, LearningReport } from "./types"
import { LEARNING_CONFIG } from "./types"
import { getLearningStorage } from "./storage"
import { detectPatterns } from "./pattern-detector"
import { planAdjustments, applyAdjustments } from "./weight-adjuster"
import { ALL_SLUGS, fetchJSON } from "@/lib/engine"

// ─────────────────────────────────────────────────────────────────────────────

function normTeam(s: string): string {
  return (s || "").toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, "").trim()
}

function evaluateResult(
  pick: PickRecord,
  homeScore: number,
  awayScore: number,
): "WIN" | "LOSS" | "VOID" {
  const { market, selection, homeTeam, awayTeam } = pick
  const total = homeScore + awayScore

  if (market === "1X2") {
    if (selection === `Gana ${homeTeam}`) return homeScore > awayScore ? "WIN" : "LOSS"
    if (selection === `Gana ${awayTeam}`) return awayScore > homeScore ? "WIN" : "LOSS"
    if (selection === "Empate")           return homeScore === awayScore ? "WIN" : "LOSS"
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
    const isHome = selection.startsWith(homeTeam)
    const adj = isHome ? homeScore + line : awayScore + line
    const opp = isHome ? awayScore : homeScore
    if (adj > opp) return "WIN"
    if (adj < opp) return "LOSS"
    return "VOID"
  }
  return "VOID"
}

/** Descarga marcadores finales de un día desde ESPN para todas las ligas */
async function fetchResultsForDate(date: string): Promise<Map<string, { homeScore: number; awayScore: number }>> {
  const yyyymmdd = date.replace(/-/g, "")
  const results = new Map<string, { homeScore: number; awayScore: number }>()
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
        results.set(key, {
          homeScore: parseInt(home.score ?? "0", 10),
          awayScore: parseInt(away.score ?? "0", 10),
        })
      }
    } catch { /* ignorar liga sin datos */ }
  }))
  return results
}

// ─────────────────────────────────────────────────────────────────────────────

export interface RunResult {
  ok: boolean
  date: string
  report?: LearningReport
  error?: string
  skippedReason?: string
}

export async function runDailyLearning(targetDate?: string): Promise<RunResult> {
  const storage = await getLearningStorage()

  // Fecha objetivo: ayer por defecto
  const date = targetDate ?? new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
  const ranAt = new Date().toISOString()

  try {
    // Idempotencia: si ya hay reporte para esta fecha y todos sus picks tienen resultado, skip
    const existing = await storage.getReport(date)
    if (existing && existing.pending === 0) {
      return { ok: true, date, report: existing, skippedReason: "Ya procesado" }
    }

    // ── 1. Obtener picks del día y resultados de ESPN ──────────────────────
    const picks = await storage.getPicksByDate(date)
    if (picks.length === 0) {
      return { ok: true, date, skippedReason: `Sin picks registrados para ${date}` }
    }

    const results = await fetchResultsForDate(date)

    // ── 2. Actualizar cada pick con su resultado ───────────────────────────
    let updated = 0
    for (const p of picks) {
      if (p.result !== "PENDING") continue
      const key = `${normTeam(p.homeTeam)}|${normTeam(p.awayTeam)}`
      const score = results.get(key)
      if (!score) continue
      const r = evaluateResult(p, score.homeScore, score.awayScore)
      await storage.updatePickResult(p.pickId, r, score.homeScore, score.awayScore)
      updated++
    }

    // Recuperar la lista actualizada para los conteos
    const finalPicks = await storage.getPicksByDate(date)
    const wins    = finalPicks.filter((p) => p.result === "WIN").length
    const losses  = finalPicks.filter((p) => p.result === "LOSS").length
    const voids   = finalPicks.filter((p) => p.result === "VOID").length
    const pending = finalPicks.filter((p) => p.result === "PENDING").length
    const settled = wins + losses
    const winRate = settled > 0 ? wins / settled : 0
    const settledRecords = finalPicks.filter((p) => p.result === "WIN" || p.result === "LOSS")
    const roi = settled > 0
      ? (settledRecords.reduce((s, p) => s + (p.result === "WIN" ? p.odd - 1 : -1), 0) / settled) * 100
      : 0

    // ── 3. Recalcular patterns sobre la ventana ────────────────────────────
    const recentPicks = await storage.getRecentPicks(LEARNING_CONFIG.WINDOW_DAYS)
    const patterns = detectPatterns(recentPicks)
    await storage.savePatterns(patterns)

    // ── 4. Planificar y aplicar ajustes de pesos ───────────────────────────
    const currentWeights = await storage.getWeights()
    const decisions = planAdjustments({
      current: currentWeights,
      patterns,
      recentRecords: recentPicks,
      todayDate: date,
    })
    if (decisions.length > 0) {
      const newWeights = applyAdjustments(currentWeights, decisions, date)
      await storage.saveWeights(newWeights)
    }

    // ── 5. Generar y guardar reporte ───────────────────────────────────────
    const totalSettledGlobal = recentPicks.filter((p) => p.result === "WIN" || p.result === "LOSS").length
    const warnings: string[] = []
    if (totalSettledGlobal < 100) warnings.push(`Histórico bajo (${totalSettledGlobal} picks resueltos en ${LEARNING_CONFIG.WINDOW_DAYS}d) — los ajustes se atenúan automáticamente`)
    if (storage.isEphemeral()) warnings.push("Storage en memoria — los datos se borrarán al reiniciar. Configura Vercel KV para producción.")

    const report: LearningReport = {
      date,
      ranAt,
      totalPicksEvaluated: finalPicks.length,
      wins, losses, voids, pending,
      winRate, roi,
      patternsTop: patterns.slice(0, 10).map((p) => ({
        id: p.id,
        samples: p.samples,
        winRate: p.winRate,
        delta: p.deltaVsExpected,
        significant: p.significant,
      })),
      weightAdjustments: decisions,
      newPatternsDetected: patterns.filter((p) => p.significant).length,
      warnings,
    }
    await storage.saveReport(report)

    return { ok: true, date, report }
  } catch (e: any) {
    return { ok: false, date, error: e?.message ?? String(e) }
  }
}
