/**
 * GET /api/admin/history-csv
 *
 * Exporta el histórico AUDITABLE de picks liquidados como CSV (descarga).
 * Fuente durable: `predictions_log` (Supabase) — flips status pending→won/lost/void
 * en el settle. Genera el CSV al vuelo (Vercel-safe: sin fs, sin /tmp efímero).
 *
 * Protegido con requireAdmin() (sesión). Cabecera y formato vía csv-logger.
 *
 * Nota: predictions_log no almacena stake ni CLV → se exportan como stakeUnits=1
 * (flat) y closingLineValue=0. Para CLV real habría que capturar la cuota de
 * cierre en el settle (mejora futura).
 */
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { createServiceClient } from "@/lib/supabase/client"
import { toCsv } from "@/utils/csv-logger"
import type { PickRecord } from "@/data/picks"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const STATUS_MAP: Record<string, PickRecord["result"]> = {
  won: "Won", lost: "Lost", void: "Void",
}

export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  try {
    const sb = createServiceClient()
    const { data, error } = await sb
      .from("predictions_log")
      .select("id, home_team, away_team, market, odds, kickoff_iso, status, closing_line_value")
      .in("status", ["won", "lost", "void"])
      .order("kickoff_iso", { ascending: true })
      .limit(5000)

    if (error) {
      console.error("[history-csv] query error:", error.message)
      return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
    }

    const rows: PickRecord[] = (data ?? []).map((r: any) => ({
      id: String(r.id),
      date: (r.kickoff_iso ?? "").slice(0, 10),
      event: `${r.home_team ?? "?"} vs ${r.away_team ?? "?"}`,
      market: r.market ?? "",
      recommendedOdds: Number(r.odds) || 0,
      stakeUnits: 1,            // flat-stake (sin gestión de stake dinámico)
      closingLineValue: Number(r.closing_line_value) || 0,  // CLV real; null (partidos antiguos) → 0
      result: STATUS_MAP[r.status] ?? "Void",
    }))

    return new NextResponse(toCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="history.csv"',
        "Cache-Control": "no-store",
      },
    })
  } catch (e) {
    console.error("[history-csv] error:", e instanceof Error ? e.message : e)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
