"use client"

import { useEffect, useState, useCallback } from "react"
import { getChallenges } from "@/lib/api"
import { DisclaimerBanner } from "@/components/legal/DisclaimerBanner"
import { PageHeader } from "@/components/ui/primitives"
import { Icon } from "@/components/ui/icons"
import { usePlan } from "@/lib/plan"
import Link from "next/link"

// ─── Types ────────────────────────────────────────────────────────────────────

interface RetoPick {
  match_name: string; league: string; kickoff: string
  selection: string; market: string
  odd: number; odds: number[]
  model_prob: number; implied_prob: number; edge: number
  quality: number; confidence: string; reasons: string[]
}

interface RetoCombo {
  picks: RetoPick[]
  combined_odd: number
  combined_prob: number
}

interface RetoChallenge {
  id: string; emoji: string; title: string
  days: number; target_odd: number; n_legs: number
  difficulty: string; color: string; description: string
  simulation: { stake: number; result: number; path: number[] }
  daily_combo: RetoCombo | null
}

type ResultMark = "WIN" | "LOSS" | "PENDING"

interface HistoryEntry {
  date: string; combo_odd: number; result: ResultMark
  summary: string
}

interface RetoProgress {
  enrolled: boolean; joinDate: string
  history: HistoryEntry[]
}

// ─── Color system ─────────────────────────────────────────────────────────────

const C = {
  emerald: {
    border:   "border-emerald-700/50 hover:border-emerald-500/70",
    accent:   "text-emerald-400",
    bar:      "bg-emerald-500",
    badge:    "bg-emerald-500/15 border-emerald-700/60 text-emerald-400",
    btn:      "bg-gradient-to-r from-emerald-500 to-cyan-500 text-zinc-950 shadow-emerald-900/40",
    header:   "from-emerald-600/20 via-emerald-600/8 to-transparent",
    heroBg:   "from-emerald-900/40 to-emerald-950/20",
    leg:      "border-emerald-800/40 bg-emerald-500/5",
    legNum:   "bg-emerald-500/20 text-emerald-400",
    oddBadge: "bg-emerald-500/20 border-emerald-600/50 text-emerald-300",
    glow:     "shadow-emerald-950",
  },
  amber: {
    border:   "border-amber-700/50 hover:border-amber-500/70",
    accent:   "text-amber-400",
    bar:      "bg-amber-400",
    badge:    "bg-amber-500/15 border-amber-700/60 text-amber-400",
    btn:      "bg-gradient-to-r from-amber-400 to-orange-400 text-zinc-950 shadow-amber-900/40",
    header:   "from-amber-600/20 via-amber-600/8 to-transparent",
    heroBg:   "from-amber-900/40 to-amber-950/20",
    leg:      "border-amber-800/40 bg-amber-500/5",
    legNum:   "bg-amber-500/20 text-amber-400",
    oddBadge: "bg-amber-500/20 border-amber-600/50 text-amber-300",
    glow:     "shadow-amber-950",
  },
  rose: {
    border:   "border-rose-700/50 hover:border-rose-500/70",
    accent:   "text-rose-400",
    bar:      "bg-rose-500",
    badge:    "bg-rose-500/15 border-rose-700/60 text-rose-400",
    btn:      "bg-gradient-to-r from-rose-500 to-orange-400 text-zinc-950 shadow-rose-900/40",
    header:   "from-rose-600/20 via-rose-600/8 to-transparent",
    heroBg:   "from-rose-900/40 to-rose-950/20",
    leg:      "border-rose-800/40 bg-rose-500/5",
    legNum:   "bg-rose-500/20 text-rose-400",
    oddBadge: "bg-rose-500/20 border-rose-600/50 text-rose-300",
    glow:     "shadow-rose-950",
  },
  violet: {
    border:   "border-violet-700/50 hover:border-violet-500/70",
    accent:   "text-violet-400",
    bar:      "bg-violet-500",
    badge:    "bg-violet-500/15 border-violet-700/60 text-violet-400",
    btn:      "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-violet-900/40",
    header:   "from-violet-600/20 via-violet-600/8 to-transparent",
    heroBg:   "from-violet-900/40 to-violet-950/20",
    leg:      "border-violet-800/40 bg-violet-500/5",
    legNum:   "bg-violet-500/20 text-violet-400",
    oddBadge: "bg-violet-500/20 border-violet-600/50 text-violet-300",
    glow:     "shadow-violet-950",
  },
} as const
type ColorKey = keyof typeof C

// ─── LocalStorage helpers ──────────────────────────────────────────────────────

function getProgress(id: string): RetoProgress {
  try {
    const raw = localStorage.getItem(`sp_reto2_${id}`)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { enrolled: false, joinDate: "", history: [] }
}

function saveProgress(id: string, p: RetoProgress) {
  try { localStorage.setItem(`sp_reto2_${id}`, JSON.stringify(p)) } catch {}
}

function todayStr() { return new Date().toISOString().split("T")[0] }
function yesterdayStr() {
  const d = new Date(); d.setDate(d.getDate() - 1)
  return d.toISOString().split("T")[0]
}

// ─── Simulation tracker ───────────────────────────────────────────────────────

interface SimResult { value: number; path: number[]; streakDays: number }

function calcUserSim(history: HistoryEntry[], stake: number): SimResult {
  let lastLossIdx = -1
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].result === "LOSS") { lastLossIdx = i; break }
  }
  const since = lastLossIdx >= 0 ? history.slice(lastLossIdx + 1) : history
  const wins = since.filter((h) => h.result === "WIN")
  const path: number[] = [stake]
  let val = stake
  for (const h of wins) {
    val = Math.round(val * h.combo_odd * 100) / 100
    path.push(Math.round(val))
  }
  return { value: Math.round(val), path, streakDays: wins.length }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) }
  catch { return "" }
}

// ─── Component: ComboDisplay ──────────────────────────────────────────────────

function ComboDisplay({ combo, color }: { combo: RetoCombo; color: ColorKey }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  const col = C[color]
  const isMulti = combo.picks.length > 1

  return (
    <div className="space-y-2.5 mt-3">
      {/* Combined header */}
      {isMulti && (
        <div className={`rounded-2xl border px-4 py-3 flex items-center justify-between ${col.leg}`}>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-0.5">
              Mini-combinada · {combo.picks.length} picks
            </p>
            <p className={`text-2xl font-bold tracking-tight ${col.accent}`}>
              {combo.combined_odd.toFixed(2)}
            </p>
            <p className="text-[10px] text-zinc-600 mt-0.5">cuota total</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-zinc-600 mb-0.5">Prob. combinada</p>
            <p className={`text-lg font-bold ${col.accent}`}>{combo.combined_prob.toFixed(1)}%</p>
          </div>
        </div>
      )}

      {/* Each pick */}
      {combo.picks.map((pick, i) => (
        <div key={i} className="rounded-2xl border border-white/[0.07] bg-zinc-900/60 overflow-hidden">
          <div className="px-4 py-3.5">
            <div className="flex items-start gap-3">
              {/* Leg number */}
              <span className={`shrink-0 grid place-items-center w-6 h-6 rounded-lg text-[11px] font-bold mt-0.5 ${col.legNum}`}>
                {isMulti ? i + 1 : "→"}
              </span>
              <div className="flex-1 min-w-0">
                {/* Match + time */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white leading-snug">{pick.match_name}</p>
                    <p className={`text-[11px] mt-0.5 font-medium ${col.accent}`}>
                      {pick.league} · {pick.market}
                    </p>
                  </div>
                  {pick.kickoff && (
                    <span className="text-[11px] text-zinc-600 shrink-0 mt-0.5">
                      ⏰ {formatTime(pick.kickoff)}
                    </span>
                  )}
                </div>
                {/* Selection + odd badge */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] text-zinc-500 mb-0.5">Selección</p>
                    <p className={`text-base font-bold ${col.accent}`}>{pick.selection}</p>
                  </div>
                  <div className={`px-3.5 py-2 rounded-xl border font-bold text-2xl tracking-tight ${col.oddBadge}`}>
                    {pick.odd.toFixed(2)}
                  </div>
                </div>
                {/* Mini metrics */}
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2.5 text-[11px]">
                  <span className="text-zinc-600">
                    Modelo <span className={`font-bold ${col.accent}`}>{pick.model_prob}%</span>
                  </span>
                  <span className="text-zinc-700">·</span>
                  <span className="text-zinc-600">
                    Edge <span className="font-bold text-white">+{pick.edge.toFixed(1)}%</span>
                  </span>
                  <span className="text-zinc-700">·</span>
                  <span className="text-zinc-600">
                    Calidad <span className="font-bold text-white">{pick.quality}/100</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Reasoning toggle */}
          <button
            onClick={() => setOpenIdx(openIdx === i ? null : i)}
            className="w-full flex items-center justify-between px-4 py-2.5 border-t border-white/[0.07] bg-zinc-950/40 tap text-left"
          >
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
              Por qué la IA eligió este pick
            </span>
            <Icon
              name={openIdx === i ? "chevronUp" : "chevronDown"}
              className="w-3.5 h-3.5 text-zinc-700"
              strokeWidth={2}
            />
          </button>

          {openIdx === i && (
            <div className="px-4 py-3 border-t border-white/[0.07] space-y-1.5">
              {pick.reasons.map((r, ri) => (
                <p key={ri} className="text-[11px] text-zinc-400 leading-snug">{r}</p>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Component: SimulationTracker ─────────────────────────────────────────────

function SimulationTracker({ sim, color }: { sim: SimResult; color: ColorKey }) {
  if (sim.path.length <= 1) return null
  const col = C[color]
  const start = sim.path[0]
  const end = sim.path[sim.path.length - 1]
  const gain = Math.round(((end - start) / start) * 100)

  return (
    <div className="mt-3 rounded-2xl border border-white/[0.07] bg-zinc-950/50 p-3.5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-2">
        Tu racha actual · {sim.streakDays} día{sim.streakDays !== 1 ? "s" : ""} consecutivo{sim.streakDays !== 1 ? "s" : ""}
      </p>
      <div className="flex items-center gap-1.5 flex-wrap">
        {sim.path.map((v, i) => (
          <span key={i} className="flex items-center gap-1">
            <span className={`text-xs font-bold ${i === sim.path.length - 1 ? col.accent : "text-zinc-500"}`}>
              {v}€
            </span>
            {i < sim.path.length - 1 && (
              <Icon name="arrowRight" className="w-2.5 h-2.5 text-zinc-700" strokeWidth={2} />
            )}
          </span>
        ))}
      </div>
      <p className="text-[11px] text-zinc-600 mt-1.5">
        {gain >= 0 ? `+${gain}%` : `${gain}%`} sobre la inversión inicial
      </p>
    </div>
  )
}

// ─── Component: YesterdaySection ──────────────────────────────────────────────

function YesterdaySection({
  retoId, color, onMark,
}: {
  retoId: string; color: ColorKey; onMark: (result: ResultMark) => void
}) {
  const progress = getProgress(retoId)
  const entry = progress.history.find((h) => h.date === yesterdayStr())
  if (!entry || progress.history.length === 0) return null

  const col = C[color]
  const isPending = entry.result === "PENDING"

  return (
    <div className="mt-3 rounded-2xl border border-white/[0.07] bg-zinc-950/50 p-3.5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-2">Pick de ayer</p>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-zinc-400 leading-snug">{entry.summary}</p>
          <p className={`text-sm font-bold mt-0.5 ${col.accent}`}>Cuota {entry.combo_odd.toFixed(2)}</p>
        </div>
        {!isPending ? (
          <span className={`shrink-0 text-xs font-bold px-3 py-1.5 rounded-full ${
            entry.result === "WIN"
              ? "bg-emerald-500 text-white"
              : "bg-rose-500 text-white"
          }`}>
            {entry.result === "WIN" ? "✓ Ganaste" : "✗ Fallaste"}
          </span>
        ) : (
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => onMark("WIN")}
              className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white text-xs font-bold transition-colors tap"
            >
              ✓ Gané
            </button>
            <button
              onClick={() => onMark("LOSS")}
              className="px-3.5 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 active:bg-rose-600 text-white text-xs font-bold transition-colors tap"
            >
              ✗ Fallé
            </button>
          </div>
        )}
      </div>
      {isPending && (
        <p className="text-[11px] text-zinc-600 mt-2">¿Acertaste la mini-combinada de ayer?</p>
      )}
    </div>
  )
}

// ─── Component: CustomRetoCreator ─────────────────────────────────────────────

const ODD_PRESETS = [
  { label: "1.30", value: 1.30, hint: "muy seguro" },
  { label: "1.50", value: 1.50, hint: "seguro" },
  { label: "2.00", value: 2.00, hint: "equilibrado" },
  { label: "3.00", value: 3.00, hint: "arriesgado" },
]

function CustomRetoCreator() {
  const [targetOdd, setTargetOdd] = useState(2.00)
  const [nLegs, setNLegs] = useState<1 | 2 | 3 | 4>(2)
  const [loading, setLoading] = useState(false)
  const [combo, setCombo] = useState<RetoCombo | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    setLoading(true)
    setError(null)
    setCombo(null)
    try {
      const res = await fetch("/api/retos/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetOdd, nLegs }),
      })
      const data = await res.json()
      if (data.combo) {
        setCombo(data.combo)
      } else {
        setError(data.error ?? "No se encontraron picks válidos para esa cuota hoy.")
      }
    } catch {
      setError("Error de conexión. Inténtalo de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mb-6 rounded-2xl border border-violet-700/50 bg-violet-500/5 backdrop-blur-sm overflow-hidden shadow-xl">
      {/* Header */}
      <div className="relative bg-gradient-to-br from-violet-600/20 via-violet-600/8 to-transparent px-5 py-4 border-b border-violet-700/30">
        <div className="pointer-events-none absolute top-0 right-0 w-32 h-32 overflow-hidden">
          <div className="absolute -top-8 -right-8 w-32 h-32 bg-violet-500/15 rounded-full blur-2xl" />
        </div>
        <div className="relative flex items-center gap-3">
          <span className="grid place-items-center w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-600/40 text-xl">⚙️</span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white">Reto Personalizado</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-violet-600/50 bg-violet-500/15 text-violet-300">👑 PRO</span>
            </div>
            <p className="text-[11px] text-zinc-500 mt-0.5">Define tu cuota objetivo y el sistema busca el pick ideal del pool de hoy</p>
          </div>
        </div>
      </div>

      <div className="px-5 pb-5 pt-4 space-y-5">
        {/* Target odd slider */}
        <div>
          <div className="flex items-end justify-between mb-3">
            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Cuota objetivo</label>
            <span className="text-4xl font-bold tracking-tight text-violet-400 leading-none">{targetOdd.toFixed(2)}</span>
          </div>
          <input
            type="range" min={1.10} max={5.00} step={0.05} value={targetOdd}
            onChange={e => { setTargetOdd(parseFloat(e.target.value)); setCombo(null) }}
            className="w-full h-1.5 rounded-full appearance-none bg-zinc-800 cursor-pointer"
            style={{ accentColor: "#a78bfa" }}
          />
          <div className="flex justify-between text-[10px] text-zinc-700 mt-1.5">
            <span>1.10 · muy seguro</span>
            <span>5.00 · muy arriesgado</span>
          </div>
          {/* Quick presets */}
          <div className="flex gap-2 mt-3">
            {ODD_PRESETS.map((p) => (
              <button key={p.value}
                onClick={() => { setTargetOdd(p.value); setCombo(null) }}
                className={`flex-1 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                  Math.abs(targetOdd - p.value) < 0.01
                    ? "border-violet-600/60 bg-violet-500/20 text-violet-300"
                    : "border-white/[0.07] text-zinc-600 hover:border-white/[0.12] hover:text-zinc-400"
                }`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* N legs */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2.5 block">Número de picks</label>
          <div className="grid grid-cols-2 gap-2">
            {([1, 2, 3, 4] as const).map((n) => (
              <button key={n}
                onClick={() => { setNLegs(n); setCombo(null) }}
                className={`py-3 rounded-xl border text-sm font-bold transition-all ${
                  nLegs === n
                    ? "border-violet-600/60 bg-violet-500/15 text-violet-300"
                    : "border-white/[0.07] text-zinc-500 hover:border-white/[0.12] hover:text-zinc-300"
                }`}>
                {n === 1 ? "Simple" : `Combinada ×${n}`}
                <p className="text-[10px] font-medium mt-0.5 opacity-60">
                  {n === 1 ? "1 partido, cuota exacta" : `${n} partidos, producto ~objetivo`}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Generate */}
        <button
          onClick={generate}
          disabled={loading}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-bold text-sm tap shadow-lg shadow-violet-900/30 disabled:opacity-60 transition-opacity flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="inline-block w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Buscando en el pool de hoy…
            </>
          ) : (
            "🎯 Generar pick del día"
          )}
        </button>

        {/* Error */}
        {error && !loading && (
          <div className="rounded-xl border border-rose-700/50 bg-rose-500/10 px-4 py-3 text-xs text-rose-300 leading-snug animate-fade-in">
            {error}
          </div>
        )}

        {/* Result */}
        {combo && !loading && (
          <div className="animate-fade-in">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Pick generado</span>
              <span className="px-2 py-0.5 rounded-lg border border-violet-700/50 bg-violet-500/15 text-violet-300 text-xs font-bold">
                cuota {combo.combined_odd.toFixed(2)}
              </span>
            </div>
            <ComboDisplay combo={combo} color="violet" />
            <button
              onClick={() => setCombo(null)}
              className="mt-3 w-full py-2 rounded-xl border border-white/[0.07] text-xs text-zinc-500 hover:text-zinc-300 hover:border-white/[0.12] transition-colors tap font-medium">
              Generar otro
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Component: RetoCard ──────────────────────────────────────────────────────

function RetoCard({
  challenge, enrolled, canEnroll, onEnroll, onMarkYesterday,
}: {
  challenge: RetoChallenge; enrolled: boolean; canEnroll: boolean
  onEnroll: () => void; onMarkYesterday: (r: ResultMark) => void
}) {
  const color = (challenge.color as ColorKey) ?? "emerald"
  const col = C[color]
  const progress = getProgress(challenge.id)
  const sim = calcUserSim(progress.history, challenge.simulation.stake)
  const wins = progress.history.filter((h) => h.result === "WIN").length
  const total = progress.history.filter((h) => h.result !== "PENDING").length
  const gainPct = Math.round(
    ((challenge.simulation.result - challenge.simulation.stake) / challenge.simulation.stake) * 100
  )

  return (
    <div className={`relative bg-zinc-900/70 backdrop-blur-sm border rounded-2xl overflow-hidden shadow-xl transition-all ${col.border}`}>

      {/* Gradient header */}
      <div className={`bg-gradient-to-br ${col.header} px-5 pt-5 pb-4`}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <span className="text-3xl leading-none">{challenge.emoji}</span>
            <h3 className={`text-2xl font-bold tracking-tight mt-2 ${col.accent}`}>
              {challenge.title}
            </h3>
            <p className="text-[11px] text-zinc-500 mt-0.5 font-medium">
              {challenge.days} días ·{" "}
              {challenge.n_legs > 1
                ? `combinada ${challenge.n_legs} picks/día`
                : "1 pick directo/día"
              }
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${col.badge}`}>
              {challenge.difficulty}
            </span>
            <span className={`text-xs font-bold px-2.5 py-1.5 rounded-xl border ${col.oddBadge}`}>
              ~{challenge.target_odd.toFixed(2)} /día
            </span>
          </div>
        </div>
        <p className="text-xs text-zinc-500 leading-relaxed">{challenge.description}</p>
      </div>

      {/* ── HERO: Benefit ─────────────────────────────────────────────────── */}
      <div className={`mx-5 mt-4 rounded-2xl overflow-hidden bg-gradient-to-br ${col.heroBg} border border-white/[0.07] px-5 py-4`}>
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
          💰 Simulación hipotética · {challenge.days} días
        </p>
        <div className="flex items-end gap-3 mt-2">
          <div>
            <span className="text-sm text-zinc-600 line-through">{challenge.simulation.stake}€</span>
            <div className={`text-5xl font-bold tracking-tighter leading-none mt-0.5 ${col.accent}`}>
              ~{challenge.simulation.result}€
            </div>
          </div>
          <span className={`text-sm font-bold pb-1 ${col.accent} opacity-70`}>
            +{gainPct}%
          </span>
        </div>
        <p className="text-[10px] text-zinc-700 mt-2">sin garantías · resultado estadístico</p>
      </div>

      <div className="px-5 pb-5 mt-4 space-y-3">
        {/* Daily combo */}
        {challenge.daily_combo ? (
          enrolled ? (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-1">
                Pick{challenge.n_legs > 1 ? "s" : ""} de hoy ·{" "}
                {new Date().toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })}
              </p>
              <ComboDisplay combo={challenge.daily_combo} color={color} />
            </div>
          ) : (
            <div className="rounded-2xl border border-white/[0.07] bg-zinc-950/50 px-4 py-3.5 flex items-center gap-3">
              <span className="text-xl shrink-0">🔒</span>
              <div>
                <p className="text-xs font-bold text-zinc-300">
                  {challenge.n_legs > 1 ? "Mini-combinada" : "Pick"} de hoy disponible
                </p>
                <p className="text-[11px] text-zinc-600 mt-0.5">
                  Inscríbete para ver los picks y el análisis diario
                </p>
              </div>
            </div>
          )
        ) : (
          <div className="rounded-2xl border border-white/[0.07] bg-zinc-950/50 px-4 py-3.5">
            <p className="text-xs font-semibold text-zinc-500">Sin picks válidos para hoy.</p>
            <p className="text-[11px] text-zinc-600 mt-0.5">
              El modelo no encontró combinaciones dentro del rango de este reto hoy.
            </p>
          </div>
        )}

        {/* Yesterday result */}
        {enrolled && (
          <YesterdaySection retoId={challenge.id} color={color} onMark={onMarkYesterday} />
        )}

        {/* Simulation tracker */}
        {enrolled && sim.path.length > 1 && (
          <SimulationTracker sim={sim} color={color} />
        )}

        {/* Progress bar */}
        {enrolled && total > 0 && (
          <div className="mt-1">
            <div className="flex justify-between text-[11px] mb-1.5">
              <span className="text-zinc-500">Tu historial</span>
              <span className={`font-bold ${col.accent}`}>
                {wins}✓ / {total - wins}✗ en {total} días
              </span>
            </div>
            <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className={`h-full ${col.bar} rounded-full transition-all`}
                style={{ width: `${total > 0 ? Math.round((wins / total) * 100) : 0}%` }}
              />
            </div>
            {total > 0 && (
              <p className="text-[11px] text-zinc-600 mt-1">
                {Math.round((wins / total) * 100)}% de acierto
              </p>
            )}
          </div>
        )}

        {/* Enroll / enrolled */}
        <div className="mt-2">
          {enrolled ? (
            <div className={`flex items-center gap-2 py-2.5 px-4 rounded-xl border ${col.badge}`}>
              <span className="text-sm">✓</span>
              <span className="text-xs font-bold">Siguiendo este reto</span>
              {progress.joinDate && (
                <span className="text-[10px] text-zinc-500 ml-auto">
                  desde {new Date(progress.joinDate).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                </span>
              )}
            </div>
          ) : canEnroll ? (
            <button
              onClick={onEnroll}
              className={`w-full py-3 rounded-xl font-bold text-sm tap shadow-lg ${col.btn}`}
            >
              Unirse al reto {challenge.emoji}
            </button>
          ) : (
            <Link
              href="/pricing"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-zinc-950 font-bold text-sm tap shadow-lg"
            >
              <Icon name="crown" className="w-4 h-4" strokeWidth={2.2} />
              {challenge.id === "pro" ? "Requiere Pro 👑" : "Requiere Premium ⭐"}
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function RetosPage() {
  const { isPremium, isPro } = usePlan()
  const [challenges, setChallenges] = useState<RetoChallenge[]>([])
  const [loading, setLoading] = useState(true)
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set())
  const [, forceRender] = useState(0)

  useEffect(() => {
    getChallenges()
      .then((d) => setChallenges(d.challenges ?? []))
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const ids = new Set<string>()
    for (const id of ["conservador", "intermedio", "avanzado", "pro"]) {
      if (getProgress(id).enrolled) ids.add(id)
    }
    setEnrolledIds(ids)
  }, [])

  const handleEnroll = useCallback((challenge: RetoChallenge) => {
    const combo = challenge.daily_combo
    const summary = combo
      ? combo.picks.map((p) => p.selection).join(" · ")
      : "—"
    const updated: RetoProgress = {
      enrolled: true,
      joinDate: new Date().toISOString(),
      history: combo ? [{
        date: todayStr(),
        combo_odd: combo.combined_odd,
        result: "PENDING",
        summary,
      }] : [],
    }
    saveProgress(challenge.id, updated)
    setEnrolledIds((prev) => new Set([...prev, challenge.id]))
    forceRender((n) => n + 1)
  }, [])

  const handleMarkYesterday = useCallback((retoId: string, result: ResultMark) => {
    const yest = yesterdayStr()
    const p = getProgress(retoId)
    const updated: RetoProgress = {
      ...p,
      history: p.history.map((h) => h.date === yest ? { ...h, result } : h),
    }
    saveProgress(retoId, updated)
    forceRender((n) => n + 1)
  }, [])

  function canEnroll(id: string) {
    return id === "pro" ? isPro : isPremium
  }

  // Milestones del usuario
  const milestones: string[] = []
  for (const id of [...enrolledIds]) {
    const p = getProgress(id)
    const wins = p.history.filter((h) => h.result === "WIN").length
    const reto = challenges.find((c) => c.id === id)
    if (reto && wins >= 3) milestones.push(`🔥 ${wins} días acertando en el reto ${reto.title}`)
    if (reto && wins === reto.days) milestones.push(`🏆 ¡Completaste el reto ${reto.title}!`)
  }

  return (
    <div className="px-4 py-6 max-w-3xl mx-auto safe-x">
      <PageHeader
        icon="trophy"
        title="Retos"
        subtitle="Mini-combinadas diarias generadas del pool real. Sigue tu racha y mide tu rendimiento."
      />

      <div className="mb-5">
        <DisclaimerBanner variant="retos" />
      </div>

      {milestones.length > 0 && (
        <div className="mb-5 space-y-2">
          {milestones.map((m, i) => (
            <div key={i} className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-zinc-900/60 px-4 py-2.5">
              <p className="text-sm text-zinc-300">{m}</p>
            </div>
          ))}
        </div>
      )}

      {!isPremium && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-emerald-700/40 bg-emerald-500/[0.05] px-4 py-3">
          <Icon name="crown" className="w-5 h-5 text-emerald-400 shrink-0" strokeWidth={2} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-zinc-200">Los retos requieren Premium ⭐ o Pro 👑</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">El reto PRO es exclusivo para usuarios Pro.</p>
          </div>
          <Link href="/pricing" className="shrink-0 text-xs font-bold text-emerald-400 flex items-center gap-1 tap">
            Ver planes <Icon name="arrowRight" className="w-3.5 h-3.5" strokeWidth={2.4} />
          </Link>
        </div>
      )}

      {isPremium && !isPro && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-violet-700/40 bg-violet-500/[0.05] px-4 py-3">
          <span className="text-xl shrink-0">👑</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-zinc-200">Reto PRO exclusivo para usuarios Pro 👑</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Conservador, Intermedio y Avanzado disponibles con Premium.
            </p>
          </div>
          <Link href="/pricing" className="shrink-0 text-xs font-bold text-violet-400 flex items-center gap-1 tap">
            Ver Pro <Icon name="arrowRight" className="w-3.5 h-3.5" strokeWidth={2.4} />
          </Link>
        </div>
      )}

      {/* Custom reto creator — PRO only */}
      {isPro && <CustomRetoCreator />}

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-96 rounded-2xl bg-zinc-900/60 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && challenges.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {challenges.map((c) => (
            <RetoCard
              key={c.id}
              challenge={c}
              enrolled={enrolledIds.has(c.id)}
              canEnroll={canEnroll(c.id)}
              onEnroll={() => handleEnroll(c)}
              onMarkYesterday={(r) => handleMarkYesterday(c.id, r)}
            />
          ))}
        </div>
      )}

      {!loading && challenges.length === 0 && (
        <div className="text-center py-20">
          <p className="text-4xl mb-3">🏆</p>
          <p className="text-zinc-400 font-medium">Los retos se generan a diario con partidos reales.</p>
          <p className="text-zinc-600 text-sm mt-1">Vuelve en unos minutos si la plataforma está arrancando.</p>
        </div>
      )}

      <p className="text-center text-[11px] text-zinc-700 mt-8 leading-relaxed">
        Retos y mini-combinadas son simulaciones estadísticas · Sin dinero real · +18
      </p>
    </div>
  )
}
