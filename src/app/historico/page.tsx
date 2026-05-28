"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Icon } from "@/components/ui/icons"
import { useSession } from "next-auth/react"

// ── Types ─────────────────────────────────────────────────────────────────────

type ResultType = "WIN" | "LOSS" | "VOID" | "PENDING"

interface MonthStats {
  won: number
  lost: number
  profit: number
  winrate: number
  topSport: string | null
}

interface HistoricalPick {
  id?: string
  home_team: string
  away_team: string
  league?: string
  market: string
  selection: string
  best_odd?: number
  model_prob?: number
  result: ResultType
  home_score?: number
  away_score?: number
  date?: string
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

// ── Helpers ───────────────────────────────────────────────────────────────────

const RESULT_STYLE: Record<ResultType, string> = {
  WIN:     "text-emerald-400 bg-emerald-500/10 border-emerald-700/40",
  LOSS:    "text-rose-400 bg-rose-500/10 border-rose-700/40",
  VOID:    "text-zinc-400 bg-zinc-800 border-zinc-700",
  PENDING: "text-amber-400 bg-amber-500/10 border-amber-700/40",
}

const RESULT_LABEL: Record<ResultType, string> = {
  WIN: "WIN", LOSS: "LOSS", VOID: "VOID", PENDING: "⏳",
}

const BET_STATUS_STYLE: Record<string, string> = {
  won:     "text-emerald-400 bg-emerald-500/10 border-emerald-700/40",
  lost:    "text-rose-400 bg-rose-500/10 border-rose-700/40",
  void:    "text-zinc-400 bg-zinc-800 border-zinc-700",
  pending: "text-amber-400 bg-amber-500/10 border-amber-700/40",
}

const BET_STATUS_LABEL: Record<string, string> = {
  won: "Ganada ✓", lost: "Perdida ✗", void: "Anulada", pending: "Pendiente",
}

function yesterday() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().split("T")[0]
}

// ── Yesterday picks — server store (most reliable) + localStorage fallback ────

function useYesterdayPicks() {
  const [picks, setPicks] = useState<HistoricalPick[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const dateKey = yesterday()

    // 1️⃣ Try server store first (pipeline-verified results survive cold restarts via /tmp)
    fetch("/api/picks/yesterday")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.picks?.length) {
          setPicks(d.picks.map((p: any) => ({ ...p, date: d.date ?? dateKey })))
          setLoading(false)
          return
        }

        // 2️⃣ Fallback: localStorage picks enriched via ESPN
        const stored = (() => {
          try {
            const raw = localStorage.getItem(`sp_picks_${dateKey}`)
            return raw ? JSON.parse(raw) : null
          } catch { return null }
        })()

        if (!stored || !Array.isArray(stored) || stored.length === 0) {
          setLoading(false)
          return
        }

        // Enrich stored picks with ESPN results
        fetch("/api/picks/yesterday", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: dateKey, picks: stored }),
        })
          .then(r => r.ok ? r.json() : null)
          .then(d2 => {
            if (d2?.picks) setPicks(d2.picks.map((p: any) => ({ ...p, date: dateKey })))
            else setPicks(stored.map((p: any) => ({ ...p, result: "PENDING", date: dateKey })))
          })
          .catch(() => setPicks(stored.map((p: any) => ({ ...p, result: "PENDING", date: dateKey }))))
          .finally(() => setLoading(false))
      })
      .catch(() => setLoading(false))
  }, [])

  return { picks, loading }
}

// ── Components ────────────────────────────────────────────────────────────────

function PickRow({ pick }: { pick: HistoricalPick }) {
  const result = (pick.result ?? "PENDING") as ResultType
  return (
    <div className="px-5 py-3.5 flex items-center gap-3 border-b border-zinc-800/40 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-white truncate">{pick.home_team} vs {pick.away_team}</p>
        <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
          <span className="text-[11px] text-zinc-500">{pick.selection}</span>
          {pick.best_odd && (
            <span className="text-[11px] font-black text-emerald-400">@{pick.best_odd.toFixed(2)}</span>
          )}
          {pick.model_prob !== undefined && (
            <span className="text-[10px] text-zinc-600">IA {Math.round(pick.model_prob)}%</span>
          )}
          {pick.home_score !== undefined && (
            <span className="text-[10px] text-zinc-600">{pick.home_score}–{pick.away_score}</span>
          )}
        </div>
      </div>
      <span className={`text-[9px] font-black px-2 py-1 rounded-lg border shrink-0 ${RESULT_STYLE[result]}`}>
        {RESULT_LABEL[result]}
      </span>
    </div>
  )
}

function BetRow({ bet }: { bet: PersonalBet }) {
  const s = bet.status as string
  const style = BET_STATUS_STYLE[s] ?? BET_STATUS_STYLE.pending
  const label = BET_STATUS_LABEL[s] ?? s
  return (
    <div className="px-4 py-3 flex items-center gap-3 border-b border-zinc-800/40 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-white truncate">{bet.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-zinc-500">{bet.stake}€ × @{bet.combined_odds}</span>
          {s === "won" && (
            <span className="text-[11px] font-bold text-emerald-400">
              +{((bet.combined_odds - 1) * bet.stake).toFixed(2)}€
            </span>
          )}
        </div>
      </div>
      <span className={`text-[9px] font-black px-2 py-1 rounded-lg border shrink-0 ${style}`}>
        {label}
      </span>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const SPORT_EMOJI: Record<string, string> = {
  football: "⚽", basketball: "🏀", tennis: "🎾", baseball: "⚾", hockey: "🏒", other: "🏅",
}

export default function HistoricoPage() {
  const { status } = useSession()
  const { picks, loading: picksLoading } = useYesterdayPicks()
  const [bets, setBets] = useState<PersonalBet[]>([])
  const [betsLoading, setBetsLoading] = useState(true)
  const [monthStats, setMonthStats] = useState<MonthStats | null>(null)

  useEffect(() => {
    if (status !== "authenticated") { setBetsLoading(false); return }
    fetch("/api/bets")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.bets) {
          const allBets = d.bets as PersonalBet[]
          // Show last 10 settled bets
          const settled = allBets
            .filter(b => b.status === "won" || b.status === "lost")
            .slice(0, 10)
          setBets(settled)

          // Monthly stats: current month
          const thisMonth = new Date().toISOString().slice(0, 7) // YYYY-MM
          const monthBets = allBets.filter(b =>
            (b.status === "won" || b.status === "lost") &&
            b.created_at?.startsWith(thisMonth)
          )
          if (monthBets.length > 0) {
            const won = monthBets.filter(b => b.status === "won")
            const staked = monthBets.reduce((s, b) => s + Number(b.stake || 0), 0)
            const returned = won.reduce((s, b) => s + Number(b.stake || 0) * Number(b.combined_odds || 1), 0)
            const sportCounts: Record<string, number> = {}
            for (const b of monthBets) {
              if (b.sport) sportCounts[b.sport] = (sportCounts[b.sport] ?? 0) + 1
            }
            const topSport = Object.entries(sportCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
            setMonthStats({
              won: won.length,
              lost: monthBets.length - won.length,
              profit: Math.round((returned - staked) * 100) / 100,
              winrate: Math.round((won.length / monthBets.length) * 1000) / 10,
              topSport,
            })
          }
        }
      })
      .catch(() => {})
      .finally(() => setBetsLoading(false))
  }, [status])

  const wins = picks.filter(p => p.result === "WIN").length
  const settled = picks.filter(p => p.result !== "PENDING").length

  return (
    <div className="safe-x pb-24">
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <span className="section-label">Histórico</span>
        <h1 className="text-xl font-black text-white mt-0.5">Picks de ayer</h1>
        <p className="text-xs text-zinc-500 mt-1">
          Value picks del día anterior con resultados reales de ESPN.
        </p>
      </div>

      {/* Summary stats */}
      {settled > 0 && (
        <div className="px-4 pb-4">
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { label: "Total picks", value: picks.length.toString(), color: "text-white" },
              { label: "WIN", value: wins.toString(), color: "text-emerald-400" },
              { label: "Winrate", value: `${Math.round((wins / settled) * 100)}%`, color: wins / settled >= 0.5 ? "text-emerald-400" : "text-rose-400" },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-3 text-center">
                <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Monthly performance */}
      {monthStats && (
        <section className="mx-4 mb-5 rounded-2xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
          <div className="px-5 pt-4 pb-3 border-b border-zinc-800/60 flex items-center justify-between">
            <p className="text-sm font-black text-white">Este mes</p>
            <p className="text-[10px] text-zinc-500">{new Date().toLocaleDateString("es-ES", { month: "long", year: "numeric" })}</p>
          </div>
          <div className="p-4 grid grid-cols-4 gap-2 text-center">
            <div className="rounded-xl bg-zinc-800/60 p-2.5 border border-zinc-700/40">
              <p className={`text-lg font-black ${monthStats.profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {monthStats.profit >= 0 ? "+" : ""}{monthStats.profit}€
              </p>
              <p className="text-[9px] text-zinc-500 mt-0.5 uppercase">Profit</p>
            </div>
            <div className="rounded-xl bg-zinc-800/60 p-2.5 border border-zinc-700/40">
              <p className={`text-lg font-black ${monthStats.winrate >= 50 ? "text-emerald-400" : "text-rose-400"}`}>
                {monthStats.winrate}%
              </p>
              <p className="text-[9px] text-zinc-500 mt-0.5 uppercase">Winrate</p>
            </div>
            <div className="rounded-xl bg-zinc-800/60 p-2.5 border border-zinc-700/40">
              <p className="text-lg font-black text-emerald-400">{monthStats.won}</p>
              <p className="text-[9px] text-zinc-500 mt-0.5 uppercase">Ganadas</p>
            </div>
            <div className="rounded-xl bg-zinc-800/60 p-2.5 border border-zinc-700/40">
              <p className="text-lg font-black text-rose-400">{monthStats.lost}</p>
              <p className="text-[9px] text-zinc-500 mt-0.5 uppercase">Perdidas</p>
            </div>
          </div>
          {monthStats.topSport && (
            <div className="px-4 pb-3">
              <p className="text-[10px] text-zinc-600 text-center">
                Deporte favorito: {SPORT_EMOJI[monthStats.topSport] ?? "🏅"} {monthStats.topSport}
              </p>
            </div>
          )}
        </section>
      )}

      {/* Yesterday picks */}
      <section className="mx-4 mb-6 rounded-2xl border border-amber-700/40 bg-gradient-to-br from-amber-500/5 via-zinc-900/80 to-zinc-950 overflow-hidden">
        <div className="px-5 pt-5 pb-4 border-b border-amber-800/30 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="grid place-items-center w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-700/40">
              <Icon name="star" className="w-4.5 h-4.5 text-amber-400" strokeWidth={2.5} />
            </span>
            <div>
              <p className="text-sm font-black text-white">Value picks — ayer</p>
              <p className="text-[10px] text-zinc-500">{yesterday()}</p>
            </div>
          </div>
          <Link href="/value" className="text-[11px] font-bold text-amber-400 hover:text-amber-300 transition-colors tap">
            Ver hoy →
          </Link>
        </div>

        {picksLoading ? (
          <div className="divide-y divide-zinc-800/40">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="px-5 py-3.5 flex items-center gap-3 animate-pulse">
                <div className="h-3 bg-zinc-800 rounded flex-1" />
                <div className="h-5 w-12 bg-zinc-800 rounded" />
              </div>
            ))}
          </div>
        ) : picks.length > 0 ? (
          <div>
            {picks.map((p, i) => <PickRow key={p.id ?? i} pick={p} />)}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center px-4">
            <p className="text-sm font-bold text-zinc-400">Sin picks guardados de ayer</p>
            <p className="text-xs text-zinc-600 mt-1">
              Los picks se guardan automáticamente cuando visitas la página de Value Picks.
            </p>
            <Link href="/value" className="mt-4 text-xs font-bold text-amber-400 hover:text-amber-300 tap">
              Ver picks de hoy →
            </Link>
          </div>
        )}
      </section>

      {/* Personal bet history */}
      {status === "authenticated" && (
        <section className="mx-4 mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
          <div className="px-5 pt-5 pb-4 border-b border-zinc-800/60 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="grid place-items-center w-9 h-9 rounded-xl bg-zinc-800 border border-zinc-700/50">
                <Icon name="ticket" className="w-4.5 h-4.5 text-zinc-400" strokeWidth={2} />
              </span>
              <div>
                <p className="text-sm font-black text-white">Mis apuestas recientes</p>
                <p className="text-[10px] text-zinc-500">Últimas resueltas</p>
              </div>
            </div>
            <Link href="/bets" className="text-[11px] font-bold text-zinc-400 hover:text-zinc-200 transition-colors tap">
              Ver todas →
            </Link>
          </div>

          {betsLoading ? (
            <div className="divide-y divide-zinc-800/40">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="px-4 py-3 flex items-center gap-3 animate-pulse">
                  <div className="h-3 bg-zinc-800 rounded flex-1" />
                  <div className="h-5 w-14 bg-zinc-800 rounded" />
                </div>
              ))}
            </div>
          ) : bets.length > 0 ? (
            <div>
              {bets.map(b => <BetRow key={b.id} bet={b} />)}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center px-4">
              <p className="text-sm font-bold text-zinc-500">Sin apuestas resueltas</p>
              <Link href="/bets" className="mt-2 text-xs font-bold text-emerald-400 hover:text-emerald-300 tap">
                Registrar una apuesta →
              </Link>
            </div>
          )}
        </section>
      )}

      {/* CTA */}
      <div className="px-4 pb-4">
        <Link href="/value"
          className="flex items-center gap-4 rounded-2xl border border-emerald-800/50 bg-zinc-900/70 hover:border-emerald-700/60 p-4 tap transition-colors">
          <span className="grid place-items-center w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-700/40 text-emerald-400 shrink-0">
            <Icon name="value" className="w-5 h-5" strokeWidth={2} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-white">Value picks de hoy</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              Ver los picks del día con cuotas reales y modelo Poisson.
            </p>
          </div>
          <Icon name="arrowRight" className="w-4.5 h-4.5 text-emerald-400 shrink-0" strokeWidth={2.4} />
        </Link>
      </div>
    </div>
  )
}
