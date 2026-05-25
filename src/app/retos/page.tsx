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
            <p className={`text-2xl font-black tracking-tight ${col.accent}`}>
              {combo.combined_odd.toFixed(2)}
            </p>
            <p className="text-[10px] text-zinc-600 mt-0.5">cuota total</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-zinc-600 mb-0.5">Prob. combinada</p>
            <p className={`text-lg font-black ${col.accent}`}>{combo.combined_prob.toFixed(1)}%</p>
          </div>
        </div>
      )}

      {/* Each pick */}
      {combo.picks.map((pick, i) => (
        <div key={i} className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 overflow-hidden">
          <div className="px-4 py-3.5">
            <div className="flex items-start gap-3">
              {/* Leg number */}
              <span className={`shrink-0 grid place-items-center w-6 h-6 rounded-lg text-[11px] font-black mt-0.5 ${col.legNum}`}>
                {isMulti ? i + 1 : "→"}
              </span>
              <div className="flex-1 min-w-0">
                {/* Match + time */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-white leading-snug">{pick.match_name}</p>
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
                    <p className={`text-base font-black ${col.accent}`}>{pick.selection}</p>
                  </div>
                  <div className={`px-3.5 py-2 rounded-xl border font-black text-2xl tracking-tight ${col.oddBadge}`}>
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
            className="w-full flex items-center justify-between px-4 py-2.5 border-t border-zinc-800/60 bg-zinc-950/40 tap text-left"
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
            <div className="px-4 py-3 border-t border-zinc-800/60 space-y-1.5">
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
    <div className="mt-3 rounded-2xl border border-zinc-800/60 bg-zinc-950/50 p-3.5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-2">
        Tu racha actual · {sim.streakDays} día{sim.streakDays !== 1 ? "s" : ""} consecutivo{sim.streakDays !== 1 ? "s" : ""}
      </p>
      <div className="flex items-center gap-1.5 flex-wrap">
        {sim.path.map((v, i) => (
          <span key={i} className="flex items-center gap-1">
            <span className={`text-xs font-black ${i === sim.path.length - 1 ? col.accent : "text-zinc-500"}`}>
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
    <div className="mt-3 rounded-2xl border border-zinc-800/60 bg-zinc-950/50 p-3.5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-2">Pick de ayer</p>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-zinc-400 leading-snug">{entry.summary}</p>
          <p className={`text-sm font-black mt-0.5 ${col.accent}`}>Cuota {entry.combo_odd.toFixed(2)}</p>
        </div>
        {!isPending ? (
          <span className={`shrink-0 text-xs font-black px-3 py-1.5 rounded-full ${
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
              className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white text-xs font-black transition-colors tap"
            >
              ✓ Gané
            </button>
            <button
              onClick={() => onMark("LOSS")}
              className="px-3.5 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 active:bg-rose-600 text-white text-xs font-black transition-colors tap"
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
            <h3 className={`text-2xl font-black tracking-tight mt-2 ${col.accent}`}>
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
            <span className={`text-xs font-black px-2.5 py-1.5 rounded-xl border ${col.oddBadge}`}>
              ~{challenge.target_odd.toFixed(2)} /día
            </span>
          </div>
        </div>
        <p className="text-xs text-zinc-500 leading-relaxed">{challenge.description}</p>
      </div>

      {/* ── HERO: Benefit ─────────────────────────────────────────────────── */}
      <div className={`mx-5 mt-4 rounded-2xl overflow-hidden bg-gradient-to-br ${col.heroBg} border border-white/5 px-5 py-4`}>
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
          💰 Simulación hipotética · {challenge.days} días
        </p>
        <div className="flex items-end gap-3 mt-2">
          <div>
            <span className="text-sm text-zinc-600 line-through">{challenge.simulation.stake}€</span>
            <div className={`text-5xl font-black tracking-tighter leading-none mt-0.5 ${col.accent}`}>
              ~{challenge.simulation.result}€
            </div>
          </div>
          <span className={`text-sm font-black pb-1 ${col.accent} opacity-70`}>
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
            <div className="rounded-2xl border border-zinc-800/60 bg-zinc-950/50 px-4 py-3.5 flex items-center gap-3">
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
          <div className="rounded-2xl border border-zinc-800/60 bg-zinc-950/50 px-4 py-3.5">
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
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
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
              <span className="text-xs font-black">Siguiendo este reto</span>
              {progress.joinDate && (
                <span className="text-[10px] text-zinc-500 ml-auto">
                  desde {new Date(progress.joinDate).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                </span>
              )}
            </div>
          ) : canEnroll ? (
            <button
              onClick={onEnroll}
              className={`w-full py-3 rounded-xl font-black text-sm tap shadow-lg ${col.btn}`}
            >
              Unirse al reto {challenge.emoji}
            </button>
          ) : (
            <Link
              href="/pricing"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-zinc-950 font-black text-sm tap shadow-lg"
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
            <div key={i} className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-2.5">
              <p className="text-sm text-zinc-300">{m}</p>
            </div>
          ))}
        </div>
      )}

      {!isPremium && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-emerald-800/50 bg-emerald-500/5 px-4 py-3">
          <Icon name="crown" className="w-5 h-5 text-emerald-400 shrink-0" strokeWidth={2} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-zinc-200">Los retos requieren Premium ⭐ o Pro 👑</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">El reto PRO es exclusivo para usuarios Pro.</p>
          </div>
          <Link href="/pricing" className="shrink-0 text-xs font-black text-emerald-400 flex items-center gap-1 tap">
            Ver planes <Icon name="arrowRight" className="w-3.5 h-3.5" strokeWidth={2.4} />
          </Link>
        </div>
      )}

      {isPremium && !isPro && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-violet-800/50 bg-violet-500/5 px-4 py-3">
          <span className="text-xl shrink-0">👑</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-zinc-200">Reto PRO exclusivo para usuarios Pro 👑</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Conservador, Intermedio y Avanzado disponibles con Premium.
            </p>
          </div>
          <Link href="/pricing" className="shrink-0 text-xs font-black text-violet-400 flex items-center gap-1 tap">
            Ver Pro <Icon name="arrowRight" className="w-3.5 h-3.5" strokeWidth={2.4} />
          </Link>
        </div>
      )}

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
