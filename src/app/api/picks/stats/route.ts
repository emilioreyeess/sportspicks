/**
 * GET /api/picks/stats
 *
 * Estadísticas globales agregadas del modelo. Una sola query SQL agregada
 * — NUNCA traemos miles de filas al cliente para calcular el winrate.
 *
 * Query params:
 *   · context   — "club" (default) | "international_friendly" | "international_competitive" | "all"
 *   · since     — ISO timestamp opcional; filtra picks cuyo kickoff >= since.
 *
 * Response:
 *   {
 *     total_settled: number,   // wins + losses (excluye voids y pending)
 *     wins: number,
 *     losses: number,
 *     voids: number,
 *     winrate_pct: number,     // 0..100 con 2 decimales
 *     avg_odd: number | null,
 *     roi_pct: number          // ganancia neta / stakes apostados (1u/pick)
 *   }
 */
import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const EMPTY = {
  total_settled: 0, wins: 0, losses: 0, voids: 0,
  winrate_pct: 0, avg_odd: null as number | null, roi_pct: 0,
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const contextParam = (sp.get("context") ?? "club").trim()
  const context = contextParam === "all" ? null : contextParam
  const since = (sp.get("since") ?? "").trim() || null

  try {
    const sb = createServiceClient()
    const { data, error } = await sb.rpc("get_picks_global_stats", {
      p_context: context,
      p_since:   since,
      p_user_id: null,
    })

    if (error) {
      console.error("[/api/picks/stats] rpc error:", error.message)
      return NextResponse.json(EMPTY, { status: 200 })
    }

    const row = Array.isArray(data) ? data[0] : data
    if (!row) return NextResponse.json(EMPTY, { status: 200 })

    return NextResponse.json({
      total_settled: Number(row.total_settled ?? 0),
      wins:          Number(row.wins ?? 0),
      losses:        Number(row.losses ?? 0),
      voids:         Number(row.voids ?? 0),
      winrate_pct:   Number(row.winrate_pct ?? 0),
      avg_odd:       row.avg_odd != null ? Number(row.avg_odd) : null,
      roi_pct:       Number(row.roi_pct ?? 0),
    })
  } catch (e: any) {
    console.error("[/api/picks/stats] error:", e?.message ?? e)
    return NextResponse.json(EMPTY, { status: 200 })
  }
}
