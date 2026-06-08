/**
 * GET /api/cron/capture-clv
 *
 * Captura el Closing Line Value (CLV): la CUOTA DE CIERRE de cada predicción
 * pendiente cuyo partido arranca en los próximos 15–45 minutos. Se guarda en
 * predictions_log.closing_line_value. Responsabilidad SEPARADA del settle.
 *
 * Seguridad: Authorization: Bearer ${CRON_SECRET} (fail-closed, ≥16 chars),
 * igual que los demás crons.
 *
 * NOTA Vercel Hobby: este endpoint debe dispararse cada ~15 min desde un
 * scheduler externo (no se agenda en vercel.json — Hobby solo permite 1/día).
 */
import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/client"
import { fetchJSON, extractOdds, type RealOdds } from "@/lib/engine"

export const runtime = "nodejs"
export const maxDuration = 60
export const dynamic = "force-dynamic"

const ESPN = "https://site.api.espn.com/apis/site/v2/sports/soccer"

/** Mapea (market, pick) a la cuota de cierre correspondiente de ESPN.
 *  Mismos tokens que settleMarket (no inventa formatos). null si no aplica. */
function closingOddFor(market: string, pick: string, odds: RealOdds): number | null {
  const m = (market ?? "").toLowerCase()
  const p = (pick ?? "").toLowerCase()
  if (m === "1x2") {
    if (p.includes("home") || p === "1") return odds.home ?? null
    if (p.includes("away") || p === "2") return odds.away ?? null
    if (p.includes("draw") || p === "x") return odds.draw ?? null
  }
  if (m === "goals_ou") {
    if (p.includes("over") || p.includes("más") || p.includes("mas")) return odds.over25 ?? null
    if (p.includes("under") || p.includes("menos")) return odds.under25 ?? null
  }
  // btts / corners_ou / cards_ou / handicap: ESPN no expone cuota fiable → null.
  return null
}

export async function GET(req: NextRequest) {
  // ── Auth Bearer, fail-closed ───────────────────────────────────────────────
  const secret = process.env.CRON_SECRET
  if (!secret || secret.length < 16) {
    console.error("[cron/capture-clv] CRON_SECRET no configurado o demasiado corto — rechazando")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const out = { scanned: 0, captured: 0, skipped: 0, errors: 0 }

  try {
    const sb = createServiceClient()
    const now = Date.now()
    const from = new Date(now + 15 * 60_000).toISOString()   // +15 min
    const to   = new Date(now + 45 * 60_000).toISOString()   // +45 min

    // 1. Predicciones pendientes en la ventana, sin CLV todavía.
    const { data: pending, error } = await sb
      .from("predictions_log")
      .select("id, league, match_id, market, pick, kickoff_iso")
      .eq("status", "pending")
      .is("closing_line_value", null)
      .gte("kickoff_iso", from)
      .lte("kickoff_iso", to)
      .limit(200)

    if (error) {
      console.error("[cron/capture-clv] query error:", error.message)
      return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
    }
    out.scanned = pending?.length ?? 0
    if (!pending || pending.length === 0) {
      return NextResponse.json({ ok: true, ...out })
    }

    // 2. Una sola llamada a ESPN por liga (slug) → mapa de eventos por id.
    const slugs = [...new Set(pending.map((p) => p.league).filter(Boolean) as string[])]
    const eventsBySlug = new Map<string, Map<string, any>>()
    for (const slug of slugs) {
      try {
        const data = await fetchJSON(`${ESPN}/${slug}/scoreboard`)
        const map = new Map<string, any>()
        for (const ev of data?.events ?? []) {
          const comp = ev.competitions?.[0]
          if (comp) map.set(String(ev.id), comp)
        }
        eventsBySlug.set(slug, map)
      } catch (e) {
        out.errors++
        console.warn(`[cron/capture-clv] scoreboard ${slug} falló:`, e instanceof Error ? e.message : e)
      }
    }

    // 3. Por cada predicción: extraer la cuota de cierre y actualizar. try/catch
    //    por fila → si una falla, seguimos con la siguiente.
    for (const row of pending) {
      try {
        const comp = eventsBySlug.get(row.league as string)?.get(String(row.match_id))
        if (!comp) { out.skipped++; continue }
        const odds = extractOdds(comp)
        if (!odds) { out.skipped++; continue }
        const clv = closingOddFor(row.market, row.pick, odds)
        if (clv == null || !Number.isFinite(clv)) { out.skipped++; continue }

        const { error: upErr } = await sb
          .from("predictions_log")
          .update({ closing_line_value: clv })
          .eq("id", row.id)
        if (upErr) { out.errors++; continue }
        out.captured++
      } catch (e) {
        out.errors++
        console.warn(`[cron/capture-clv] fila ${row.id} falló:`, e instanceof Error ? e.message : e)
      }
    }

    return NextResponse.json({ ok: true, ...out })
  } catch (e) {
    console.error("[cron/capture-clv] error:", e instanceof Error ? e.message : e)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
