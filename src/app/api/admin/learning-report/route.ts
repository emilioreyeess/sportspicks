/**
 * GET /api/admin/learning-report
 *
 * Devuelve estado completo del Learning Engine:
 *  - últimos N reportes diarios
 *  - patterns actuales (significant + diagnóstico)
 *  - pesos vigentes + histórico de ajustes
 *  - estado del backend (KV / memory) + warnings
 *
 * Query opcional: ?reports=N (default 14)
 */
import { NextRequest, NextResponse } from "next/server"
import { getLearningStorage } from "@/lib/learning"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const limit = parseInt(url.searchParams.get("reports") ?? "14", 10)

  const storage = await getLearningStorage()
  const [reports, patterns, weights, dates] = await Promise.all([
    storage.getRecentReports(limit),
    storage.getPatterns(),
    storage.getWeights(),
    storage.getDatesWithPicks(60),
  ])

  // Stats agregadas de la ventana
  const recent = await storage.getRecentPicks(60)
  const settled = recent.filter((p) => p.result === "WIN" || p.result === "LOSS")
  const wins = settled.filter((p) => p.result === "WIN").length
  const winRate = settled.length ? wins / settled.length : 0
  const roi = settled.length
    ? (settled.reduce((s, p) => s + (p.result === "WIN" ? p.odd - 1 : -1), 0) / settled.length) * 100
    : 0

  return NextResponse.json({
    backend: storage.backendName(),
    ephemeral: storage.isEphemeral(),
    window_stats: {
      days: 60,
      total_picks: recent.length,
      settled: settled.length,
      wins,
      losses: settled.length - wins,
      win_rate: winRate,
      roi_pct: roi,
      dates_with_picks: dates.length,
    },
    weights,
    patterns: {
      total: patterns.length,
      significant: patterns.filter((p) => p.significant).length,
      top: patterns.slice(0, 30),
    },
    reports,
  })
}
