/**
 * GET /api/picks/yesterday — "Value Picks de ayer", 100% REAL desde `predictions_log`.
 *
 * REGLA (cero mocks / cero fallback):
 *  - SOLO filas con source='value_pick' → los value picks que emite el pipeline
 *    diario (tienen cuota real). Se EXCLUYE source='analysis_view': predicciones
 *    que se loguean al abrir el análisis de un partido, SIN cuota (odds NULL). Si
 *    se colaban, aparecían "partidos fantasma" a cuota 0 (p.ej. France–Iraq) y
 *    DESPLAZABAN a los value picks reales (Shamrock Rovers) por el límite.
 *  - Ventana de fecha = AYER en UTC estricto (consistente con la noción de "hoy"
 *    del pipeline, que también usa el día UTC).
 *  - Se incluye 'pending': si el cron de settle aún no resolvió un value pick
 *    válido de ayer, debe verse como Pendiente, no desaparecer.
 *
 * Si no hay value picks de ayer → picks: []. La UI muestra el estado vacío limpio
 * ("No hubo Value Picks ayer"). NUNCA se hace render de datos falsos ni de fallback.
 */
import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"   // nunca cachear: datos reales del día anterior
export const revalidate = 0

const STATUS_MAP: Record<string, "WIN" | "LOSS" | "VOID" | "PENDING"> = {
  won: "WIN", lost: "LOSS", void: "VOID", pending: "PENDING",
}

export async function GET() {
  // ── Cálculo DINÁMICO de "ayer" en UTC estricto ──
  const now = new Date()
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const yesterdayStart = new Date(todayStart.getTime() - 86_400_000)
  const fromIso = yesterdayStart.toISOString()   // ayer 00:00:00Z
  const toIso = todayStart.toISOString()         // hoy  00:00:00Z (exclusivo)

  try {
    const sb = createServiceClient()
    const { data, error } = await sb
      .from("predictions_log")
      .select("id, league, home_team, away_team, market, pick, odds, model_prob, status, kickoff_iso")
      .eq("source", "value_pick")                        // SOLO value picks reales (no analysis_view)
      .in("status", ["won", "lost", "void", "pending"])  // incluye pending → no descartar picks válidos sin settle
      .gte("kickoff_iso", fromIso)
      .lt("kickoff_iso", toIso)
      .order("kickoff_iso", { ascending: false })
      .limit(20)
    if (error || !data) return NextResponse.json({ date: fromIso.slice(0, 10), picks: [] })

    const picks = data.map((p: any) => {
      const odd = typeof p.odds === "number" ? p.odds : Number(p.odds)
      return {
        id: p.id,
        league_name: p.league ?? undefined,
        home_team: p.home_team,
        away_team: p.away_team,
        market: p.market ?? undefined,
        selection: p.pick,
        // Cuota SOLO si es un número real (>1). Nunca renderizar "@ 0" desde un NULL.
        best_odd: Number.isFinite(odd) && odd > 1 ? odd : undefined,
        model_prob: typeof p.model_prob === "number" ? p.model_prob * (p.model_prob <= 1 ? 100 : 1) : 0,
        result: STATUS_MAP[p.status] ?? "PENDING",
      }
    })
    return NextResponse.json({ date: fromIso.slice(0, 10), picks })
  } catch {
    return NextResponse.json({ date: fromIso.slice(0, 10), picks: [] })
  }
}
