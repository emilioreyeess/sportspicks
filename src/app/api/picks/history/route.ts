/**
 * GET /api/picks/history
 *
 * Historial paginado de picks finalizados. Fuente única: `predictions_log`
 * (Supabase) — el pipeline diario los loguea allí y el cron `ml-settle` los
 * liquida contra ESPN. La query corre vía la RPC `get_picks_history_page`
 * para que la paginación y el filtrado por contexto vivan en Postgres.
 *
 * Query params:
 *   · before    — ISO timestamp; devuelve filas con kickoff_iso < before.
 *                 Omitir en la primera página → desde "ahora".
 *   · limit     — 1..200 (default 50)
 *   · context   — "club" (default) | "international_friendly" | "international_competitive" | "all"
 *
 * Response shape:
 *   {
 *     days: [{ date: "2026-06-01", label: "Lunes, 1 de junio", picks: [...] }, …],
 *     nextCursor: "2026-05-30T22:00:00.000Z" | null,
 *     count: number
 *   }
 */
import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { createServiceClient } from "@/lib/supabase/client"
import { settleGroundTruth } from "@/lib/learning/supabase-ml"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/* ── Lazy refresh: throttle in-memory por instancia ───────────────────────
   El cron ml-settle solo corre 1×/día (limitación Hobby). Cuando un user
   abre /historico antes del cron, intentamos liquidar los pending vencidos
   on-the-fly. Throttle de 5 min por instancia para no martillear ESPN. */
let lastLazyRefreshAt = 0
const LAZY_REFRESH_MIN_INTERVAL_MS = 5 * 60_000

async function maybeLazyRefresh(): Promise<void> {
  const now = Date.now()
  if (now - lastLazyRefreshAt < LAZY_REFRESH_MIN_INTERVAL_MS) return
  lastLazyRefreshAt = now

  // Pre-check: ¿hay value_picks pending cuyo kickoff ya pasó hace >130min?
  // Si NO, no perdemos tiempo invocando settleGroundTruth (escanea hasta 80
  // filas y hace fetch a ESPN). Esto mantiene el GET barato cuando todo
  // está al día.
  try {
    const sb = createServiceClient()
    const cutoff = new Date(now - 130 * 60_000).toISOString()
    const { count } = await sb
      .from("predictions_log")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .eq("source", "value_pick")
      .lte("kickoff_iso", cutoff)
    if (!count || count === 0) return

    const result = await settleGroundTruth()
    if (result.settled > 0 || result.void > 0) {
      // Purgamos caché de las rutas dependientes para que el siguiente
      // request del cliente vea los datos frescos sin esperar TTL.
      try {
        revalidatePath("/historico")
        revalidatePath("/value")
      } catch { /* fuera de App Router context — no crítico */ }
    }
  } catch (e: any) {
    console.warn("[/api/picks/history] lazy refresh warn:", e?.message ?? e)
  }
}

const MAX_LIMIT = 200
const DEFAULT_LIMIT = 50

interface RpcRow {
  id: string
  match_id: string
  league: string
  home_team: string | null
  away_team: string | null
  market: string
  pick: string
  odds: number | null
  model_prob: number | null
  edge: number | null
  kickoff_iso: string
  status: "won" | "lost" | "void"
  home_score: number | null
  away_score: number | null
  settled_at: string | null
  context: string | null
}

interface PickOut {
  id: string
  match_id: string
  league: string
  home_team: string | null
  away_team: string | null
  market: string
  selection: string
  odd: number | null
  model_prob: number | null
  edge: number | null
  kickoff_iso: string
  result: "WIN" | "LOSS" | "VOID"
  home_score: number | null
  away_score: number | null
  context: string | null
}

interface DayBlock {
  date: string         // YYYY-MM-DD
  label: string        // "Lunes, 1 de junio"
  picks: PickOut[]
  wins: number
  losses: number
  voids: number
}

/** "2026-06-01" → "Lunes, 1 de junio" */
function dayLabel(isoDate: string): string {
  try {
    const d = new Date(isoDate + "T12:00:00Z")
    const s = d.toLocaleDateString("es-ES", {
      weekday: "long", day: "numeric", month: "long",
    })
    return s.charAt(0).toUpperCase() + s.slice(1)
  } catch {
    return isoDate
  }
}

const RESULT_MAP: Record<string, PickOut["result"]> = {
  won: "WIN", lost: "LOSS", void: "VOID",
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const before = (sp.get("before") ?? "").trim()
  const limitRaw = parseInt(sp.get("limit") ?? "")
  const limit = Number.isFinite(limitRaw)
    ? Math.max(1, Math.min(MAX_LIMIT, limitRaw))
    : DEFAULT_LIMIT
  const contextParam = (sp.get("context") ?? "club").trim()
  const context = contextParam === "all" ? null : contextParam

  // Antes de leer, intenta liquidar pendings vencidos (throttled).
  // Esto evita esperar al cron diario para ver picks recién finalizados.
  await maybeLazyRefresh()

  try {
    const sb = createServiceClient()
    const { data, error } = await sb.rpc("get_picks_history_page", {
      p_before:  before || null,
      p_limit:   limit,
      p_context: context,
      p_user_id: null,
    })

    if (error) {
      console.error("[/api/picks/history] rpc error:", error.message)
      return NextResponse.json({ days: [], nextCursor: null, count: 0 }, { status: 200 })
    }

    const rows = (data ?? []) as RpcRow[]

    // Agrupar por fecha (YYYY-MM-DD del kickoff en UTC). Mantenemos el orden
    // descendente que ya nos da la RPC.
    const dayMap = new Map<string, DayBlock>()
    for (const r of rows) {
      const date = (r.kickoff_iso ?? "").slice(0, 10) || "—"
      if (!dayMap.has(date)) {
        dayMap.set(date, {
          date,
          label: dayLabel(date),
          picks: [],
          wins: 0, losses: 0, voids: 0,
        })
      }
      const block = dayMap.get(date)!
      const result = RESULT_MAP[r.status] ?? "VOID"
      block.picks.push({
        id: r.id,
        match_id: r.match_id,
        league: r.league,
        home_team: r.home_team,
        away_team: r.away_team,
        market: r.market,
        selection: r.pick,
        odd: r.odds,
        model_prob: r.model_prob != null ? Math.round(r.model_prob * 1000) / 10 : null, // 0..100
        edge: r.edge != null ? Math.round(r.edge * 1000) / 10 : null,
        kickoff_iso: r.kickoff_iso,
        result,
        home_score: r.home_score,
        away_score: r.away_score,
        context: r.context,
      })
      if      (result === "WIN")  block.wins++
      else if (result === "LOSS") block.losses++
      else                        block.voids++
    }

    const days = Array.from(dayMap.values())

    // Cursor de la siguiente página = kickoff_iso de la última fila recibida.
    // Si la RPC devolvió menos que `limit`, no hay más páginas.
    const nextCursor = rows.length >= limit ? rows[rows.length - 1].kickoff_iso : null

    return NextResponse.json({
      days,
      nextCursor,
      count: rows.length,
    })
  } catch (e: any) {
    console.error("[/api/picks/history] error:", e?.message ?? e)
    return NextResponse.json({ days: [], nextCursor: null, count: 0 }, { status: 200 })
  }
}
