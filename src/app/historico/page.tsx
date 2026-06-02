"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Icon } from "@/components/ui/icons"
import { useSession } from "next-auth/react"
import { PageHeader, Card, Button, Spinner, EmptyState, Badge } from "@/components/ui/primitives"

/* ────────────────────────────────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────────────────────────────────── */

type ResultType = "WIN" | "LOSS" | "VOID"

interface HistoryPick {
  id: string
  match_id: string
  league: string
  home_team: string | null
  away_team: string | null
  market: string
  selection: string
  odd: number | null
  model_prob: number | null   // 0..100
  edge: number | null         // 0..100
  kickoff_iso: string
  result: ResultType
  home_score: number | null
  away_score: number | null
  context: string | null
}

interface DayBlock {
  date: string
  label: string
  picks: HistoryPick[]
  wins: number
  losses: number
  voids: number
}

interface GlobalStats {
  total_settled: number
  wins: number
  losses: number
  voids: number
  winrate_pct: number
  avg_odd: number | null
  roi_pct: number
}

interface PersonalBet {
  id: string
  title: string
  stake: number
  combined_odds: number
  status: string
  created_at: string
  sport?: string
}

/* ────────────────────────────────────────────────────────────────────────────
   Style tokens (Apple-like)
   ──────────────────────────────────────────────────────────────────────────── */

const RESULT_TONE: Record<ResultType, { dot: string; chip: string; row: string }> = {
  WIN:  { dot: "bg-emerald-400", chip: "bg-emerald-500/[0.10] text-emerald-300", row: "" },
  LOSS: { dot: "bg-rose-400",    chip: "bg-rose-500/[0.10] text-rose-300",        row: "" },
  VOID: { dot: "bg-zinc-500",    chip: "bg-zinc-800/60 text-zinc-400",            row: "" },
}

const RESULT_LABEL: Record<ResultType, string> = { WIN: "WIN", LOSS: "LOSS", VOID: "VOID" }

const BET_STATUS_STYLE: Record<string, "emerald" | "rose" | "zinc" | "amber"> = {
  won: "emerald", lost: "rose", void: "zinc", pending: "amber",
}
const BET_STATUS_LABEL: Record<string, string> = {
  won: "Ganada", lost: "Perdida", void: "Anulada", pending: "Pendiente",
}

/* ────────────────────────────────────────────────────────────────────────────
   Hooks: stats + paginated history
   ──────────────────────────────────────────────────────────────────────────── */

function useGlobalStats() {
  const [stats, setStats] = useState<GlobalStats | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetch("/api/picks/stats", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setStats(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])
  return { stats, loading }
}

interface HistoryPage { days: DayBlock[]; nextCursor: string | null; count: number }

function mergeDays(prev: DayBlock[], next: DayBlock[]): DayBlock[] {
  const map = new Map<string, DayBlock>()
  for (const d of prev) map.set(d.date, d)
  for (const d of next) {
    const ex = map.get(d.date)
    if (!ex) { map.set(d.date, d); continue }
    map.set(d.date, {
      ...ex,
      picks:  [...ex.picks, ...d.picks],
      wins:   ex.wins   + d.wins,
      losses: ex.losses + d.losses,
      voids:  ex.voids  + d.voids,
    })
  }
  // Conservar orden DESC por fecha
  return Array.from(map.values()).sort((a, b) => (a.date < b.date ? 1 : -1))
}

function useHistory() {
  const [days, setDays] = useState<DayBlock[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [done, setDone] = useState(false)
  const fetchedFirst = useRef(false)

  const fetchPage = useCallback(async (before: string | null) => {
    const qs = new URLSearchParams({ limit: "50" })
    if (before) qs.set("before", before)
    const r = await fetch(`/api/picks/history?${qs}`, { cache: "no-store" })
    if (!r.ok) return null
    return (await r.json()) as HistoryPage
  }, [])

  useEffect(() => {
    if (fetchedFirst.current) return
    fetchedFirst.current = true
    ;(async () => {
      const page = await fetchPage(null)
      if (page) {
        setDays(page.days)
        setCursor(page.nextCursor)
        if (!page.nextCursor) setDone(true)
      }
      setLoading(false)
    })()
  }, [fetchPage])

  const loadMore = useCallback(async () => {
    if (loadingMore || done || !cursor) return
    setLoadingMore(true)
    const page = await fetchPage(cursor)
    if (page) {
      setDays((prev) => mergeDays(prev, page.days))
      setCursor(page.nextCursor)
      if (!page.nextCursor || page.count === 0) setDone(true)
    } else {
      setDone(true)
    }
    setLoadingMore(false)
  }, [cursor, done, fetchPage, loadingMore])

  return { days, loading, loadingMore, done, loadMore, hasAny: days.length > 0 }
}

/* ────────────────────────────────────────────────────────────────────────────
   Components
   ──────────────────────────────────────────────────────────────────────────── */

function HeroStats({ stats, loading }: { stats: GlobalStats | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-2xl bg-zinc-900/40 px-5 py-5 h-[90px] animate-pulse" />
        ))}
      </div>
    )
  }
  const winrate = stats?.winrate_pct ?? 0
  const wins    = stats?.wins ?? 0
  const losses  = stats?.losses ?? 0
  const roi     = stats?.roi_pct ?? 0

  const cells: Array<{
    label: string; value: string; sub?: string
    tone: "emerald" | "rose" | "amber" | "zinc"
  }> = [
    {
      label: "Aciertos globales",
      value: `${winrate.toFixed(1)}%`,
      sub: `${stats?.total_settled ?? 0} picks resueltos`,
      tone: winrate >= 50 ? "emerald" : "amber",
    },
    { label: "Verdes", value: String(wins),   sub: "WIN totales", tone: "emerald" },
    { label: "Rojos",  value: String(losses), sub: "LOSS totales", tone: "rose" },
  ]
  const toneClass = {
    emerald: "text-emerald-400",
    rose:    "text-rose-400",
    amber:   "text-amber-400",
    zinc:    "text-zinc-300",
  }
  return (
    <div className="grid grid-cols-3 gap-3">
      {cells.map((c) => (
        <div key={c.label} className="rounded-2xl bg-zinc-900/40 px-4 py-5 sm:px-5">
          <p className={`text-[28px] sm:text-[32px] font-bold tracking-tight leading-none ${toneClass[c.tone]}`}>
            {c.value}
          </p>
          <p className="text-[11px] font-semibold text-zinc-400 mt-3 uppercase tracking-wide">
            {c.label}
          </p>
          {c.sub && <p className="text-[11px] text-zinc-600 mt-1">{c.sub}</p>}
        </div>
      ))}
      {/* ROI secundario */}
      {stats && (
        <div className="col-span-3 rounded-2xl bg-zinc-900/40 px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">ROI a 1u/pick</p>
            <p className={`text-[20px] font-bold tracking-tight mt-1 ${roi >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {roi >= 0 ? "+" : ""}{roi.toFixed(2)}%
            </p>
          </div>
          {stats.avg_odd != null && (
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Cuota media</p>
              <p className="text-[20px] font-bold tracking-tight text-zinc-200 mt-1">
                @{stats.avg_odd.toFixed(2)}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PickRow({ pick }: { pick: HistoryPick }) {
  const tone = RESULT_TONE[pick.result]
  return (
    <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/[0.04] last:border-0">
      <span className={`h-2 w-2 shrink-0 rounded-full ${tone.dot}`} />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-white truncate">
          {pick.home_team ?? "?"} vs {pick.away_team ?? "?"}
        </p>
        <div className="flex items-center flex-wrap gap-x-2.5 gap-y-0.5 mt-0.5">
          <span className="text-[11.5px] text-zinc-500 truncate">{pick.selection}</span>
          {pick.odd != null && (
            <span className="text-[11.5px] font-semibold text-emerald-400/90">@{pick.odd.toFixed(2)}</span>
          )}
          {pick.model_prob != null && (
            <span className="text-[10.5px] text-zinc-600">IA {Math.round(pick.model_prob)}%</span>
          )}
          {pick.home_score != null && pick.away_score != null && (
            <span className="text-[10.5px] text-zinc-600 tabular-nums">
              {pick.home_score}–{pick.away_score}
            </span>
          )}
        </div>
      </div>
      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 ${tone.chip}`}>
        {RESULT_LABEL[pick.result]}
      </span>
    </div>
  )
}

function DaySection({ day }: { day: DayBlock }) {
  const settled = day.wins + day.losses
  const wr = settled > 0 ? Math.round((day.wins / settled) * 100) : null
  return (
    <section>
      {/* Divisor de fecha */}
      <div className="flex items-baseline justify-between px-1 mb-3">
        <h3 className="text-[14px] font-semibold text-white tracking-tight">{day.label}</h3>
        <div className="flex items-center gap-2 text-[11px] text-zinc-500">
          <span>
            <strong className="text-emerald-400">{day.wins}</strong>W
            <span className="text-zinc-700 mx-1">·</span>
            <strong className="text-rose-400">{day.losses}</strong>L
            {day.voids > 0 && (
              <>
                <span className="text-zinc-700 mx-1">·</span>
                <strong className="text-zinc-400">{day.voids}</strong>V
              </>
            )}
          </span>
          {wr != null && (
            <span className={`font-semibold ${wr >= 50 ? "text-emerald-400" : "text-rose-400"}`}>
              {wr}%
            </span>
          )}
        </div>
      </div>
      <Card variant="default" className="overflow-hidden">
        {day.picks.map((p) => <PickRow key={p.id} pick={p} />)}
      </Card>
    </section>
  )
}

function BetRow({ bet }: { bet: PersonalBet }) {
  const tone = BET_STATUS_STYLE[bet.status] ?? "zinc"
  const label = BET_STATUS_LABEL[bet.status] ?? bet.status
  const profit = bet.status === "won"
    ? ((bet.combined_odds - 1) * bet.stake)
    : bet.status === "lost"
    ? -bet.stake
    : 0
  return (
    <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/[0.04] last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-white truncate">{bet.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11.5px] text-zinc-500">
            {bet.stake}€ × @{bet.combined_odds}
          </span>
          {profit !== 0 && (
            <span className={`text-[11.5px] font-semibold ${profit > 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {profit > 0 ? "+" : ""}{profit.toFixed(2)}€
            </span>
          )}
        </div>
      </div>
      <Badge tone={tone}>{label}</Badge>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   PAGE
   ════════════════════════════════════════════════════════════════════════════ */

export default function HistoricoPage() {
  const { status } = useSession()
  const { stats, loading: statsLoading } = useGlobalStats()
  const { days, loading, loadingMore, done, loadMore, hasAny } = useHistory()
  const [bets, setBets] = useState<PersonalBet[]>([])
  const [betsLoading, setBetsLoading] = useState(true)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Carga de apuestas personales (independiente del feed de picks globales)
  useEffect(() => {
    if (status !== "authenticated") { setBetsLoading(false); return }
    fetch("/api/bets")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.bets) {
          const all = d.bets as PersonalBet[]
          setBets(all
            .filter((b) => b.status === "won" || b.status === "lost")
            .slice(0, 10))
        }
      })
      .catch(() => {})
      .finally(() => setBetsLoading(false))
  }, [status])

  // Scroll infinito — IntersectionObserver sobre el sentinel
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) loadMore()
    }, { rootMargin: "200px 0px" })
    io.observe(el)
    return () => io.disconnect()
  }, [loadMore])

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10 safe-x pb-24">
      <PageHeader
        icon="activity"
        title="Histórico"
        subtitle="Todos los picks del modelo, agrupados por día. Resultados verificados contra ESPN."
      />

      <div className="space-y-7">
        {/* ── Hero stats globales ─────────────────────────────────────────── */}
        <HeroStats stats={stats} loading={statsLoading} />

        {/* ── Timeline agrupado por fecha ────────────────────────────────── */}
        <section className="space-y-6">
          {loading ? (
            <div className="space-y-6">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="space-y-3">
                  <div className="h-4 w-40 rounded bg-zinc-900/40 animate-pulse" />
                  <div className="h-36 rounded-2xl bg-zinc-900/40 animate-pulse" />
                </div>
              ))}
            </div>
          ) : hasAny ? (
            <>
              {days.map((d) => <DaySection key={d.date} day={d} />)}
              {/* Sentinel + estado de paginación */}
              <div ref={sentinelRef} className="flex items-center justify-center py-6">
                {loadingMore ? (
                  <Spinner className="w-5 h-5" />
                ) : done ? (
                  <p className="text-[11px] text-zinc-600">Fin del histórico.</p>
                ) : (
                  <Button variant="ghost" size="sm" onClick={loadMore}>
                    Cargar más
                  </Button>
                )}
              </div>
            </>
          ) : (
            <Card variant="flat" className="px-6 py-14">
              <EmptyState
                icon="activity"
                title="Aún no hay picks resueltos"
                hint="En cuanto el pipeline diario genere picks y el cron los liquide contra ESPN, aparecerán aquí agrupados por fecha."
                action={
                  <Button variant="premium" size="md" iconRight="arrowRight" href="/value">
                    Ver picks de hoy
                  </Button>
                }
              />
            </Card>
          )}
        </section>

        {/* ── Apuestas personales (solo logueados) ───────────────────────── */}
        {status === "authenticated" && (
          <section>
            <div className="flex items-baseline justify-between px-1 mb-3">
              <h3 className="text-[14px] font-semibold text-white tracking-tight">Mis apuestas recientes</h3>
              <Link href="/bets" className="text-[11px] font-medium text-zinc-500 hover:text-zinc-300 transition-colors tap">
                Ver todas →
              </Link>
            </div>
            {betsLoading ? (
              <div className="h-28 rounded-2xl bg-zinc-900/40 animate-pulse" />
            ) : bets.length > 0 ? (
              <Card variant="default" className="overflow-hidden">
                {bets.map((b) => <BetRow key={b.id} bet={b} />)}
              </Card>
            ) : (
              <Card variant="flat" className="px-6 py-8">
                <EmptyState
                  icon="ticket"
                  title="Sin apuestas resueltas"
                  hint="Cuando registres y liquides tus apuestas personales, aparecerán aquí."
                  action={
                    <Button variant="secondary" size="md" iconRight="arrowRight" href="/bets">
                      Registrar una apuesta
                    </Button>
                  }
                />
              </Card>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
