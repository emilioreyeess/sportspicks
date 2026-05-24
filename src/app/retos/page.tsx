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
  match: string; league: string; kickoff: string
  selection: string; market: string; odd: number
  model_prob: number; implied_prob: number; edge: number
  quality: number; confidence: string; reasons: string[]
}

interface RetoChallenge {
  id: string; emoji: string; title: string
  days: number; target_odd: number; difficulty: string
  color: string; description: string
  simulation: { stake: number; result: number; path: number[] }
  daily_pick: RetoPick | null
}

type ResultMark = "WIN" | "LOSS" | "PENDING"

interface HistoryEntry {
  date: string; match: string; selection: string; odd: number
  result: ResultMark
}

interface RetoProgress {
  enrolled: boolean; joinDate: string
  history: HistoryEntry[]
}

// ─── Color system ─────────────────────────────────────────────────────────────

const C = {
  emerald: {
    border: "border-emerald-700/60 hover:border-emerald-500/80",
    accent: "text-emerald-400",
    bar: "bg-emerald-500",
    badge: "bg-emerald-500/15 border-emerald-700 text-emerald-400",
    btn: "bg-gradient-to-r from-emerald-500 to-cyan-500 text-zinc-950",
    glow: "shadow-emerald-500/10",
    header: "from-emerald-600/15 to-cyan-600/5",
  },
  amber: {
    border: "border-amber-700/60 hover:border-amber-500/80",
    accent: "text-amber-400",
    bar: "bg-amber-400",
    badge: "bg-amber-500/15 border-amber-700 text-amber-400",
    btn: "bg-gradient-to-r from-amber-400 to-orange-400 text-zinc-950",
    glow: "shadow-amber-500/10",
    header: "from-amber-600/15 to-orange-600/5",
  },
  rose: {
    border: "border-rose-700/60 hover:border-rose-500/80",
    accent: "text-rose-400",
    bar: "bg-rose-500",
    badge: "bg-rose-500/15 border-rose-700 text-rose-400",
    btn: "bg-gradient-to-r from-rose-500 to-orange-400 text-zinc-950",
    glow: "shadow-rose-500/10",
    header: "from-rose-600/15 to-orange-600/5",
  },
  violet: {
    border: "border-violet-700/60 hover:border-violet-500/80",
    accent: "text-violet-400",
    bar: "bg-violet-500",
    badge: "bg-violet-500/15 border-violet-700 text-violet-400",
    btn: "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white",
    glow: "shadow-violet-500/10",
    header: "from-violet-600/15 to-fuchsia-600/5",
  },
} as const
type ColorKey = keyof typeof C

// ─── LocalStorage helpers ──────────────────────────────────────────────────────

function getProgress(id: string): RetoProgress {
  try {
    const raw = localStorage.getItem(`sp_reto_${id}`)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { enrolled: false, joinDate: "", history: [] }
}

function saveProgress(id: string, p: RetoProgress) {
  try { localStorage.setItem(`sp_reto_${id}`, JSON.stringify(p)) } catch {}
}

function todayStr() { return new Date().toISOString().split("T")[0] }

function yesterdayStr() {
  const d = new Date(); d.setDate(d.getDate() - 1)
  return d.toISOString().split("T")[0]
}

// ─── Simulation calculator ─────────────────────────────────────────────────────

interface SimResult { value: number; path: number[]; streakDays: number }

function calcUserSimulation(history: HistoryEntry[], stake: number): SimResult {
  // Find last LOSS
  let lastLossIdx = -1
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].result === "LOSS") { lastLossIdx = i; break }
  }
  const since = lastLossIdx >= 0 ? history.slice(lastLossIdx + 1) : history
  const wins = since.filter((h) => h.result === "WIN")
  const path: number[] = [stake]
  let val = stake
  for (const h of wins) {
    val = Math.round(val * h.odd * 100) / 100
    path.push(Math.round(val))
  }
  return { value: Math.round(val), path, streakDays: wins.length }
}

// ─── Pick card helpers ─────────────────────────────────────────────────────────

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
  } catch { return "" }
}

function confidenceColor(c: string) {
  if (c === "Alta") return "text-emerald-400"
  if (c === "Media") return "text-amber-400"
  return "text-zinc-400"
}

// ─── Component: PickReasoningBox ───────────────────────────────────────────────

function PickReasoningBox({ pick, color }: { pick: RetoPick; color: ColorKey }) {
  const [open, setOpen] = useState(false)
  const col = C[color]
  return (
    <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950/60 overflow-hidden">
      {/* Main pick info */}
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <p className="text-sm font-bold text-white leading-snug">{pick.match}</p>
            <p className={`text-[11px] mt-0.5 ${col.accent}`}>
              {pick.league} · {pick.market}
            </p>
          </div>
          {pick.kickoff && (
            <span className="text-[11px] text-zinc-600 shrink-0">⏰ {formatTime(pick.kickoff)}</span>
          )}
        </div>

        {/* Selection + Odds row */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-zinc-400">Selección</p>
            <p className={`text-sm font-black ${col.accent}`}>{pick.selection}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-zinc-400">Cuota</p>
            <p className="text-xl font-black text-white">{pick.odd.toFixed(2)}</p>
          </div>
        </div>

        {/* Metrics row */}
        <div className="mt-2.5 grid grid-cols-3 gap-1.5">
          <div className="rounded-lg bg-zinc-900 px-2 py-1.5 text-center">
            <p className="text-[10px] text-zinc-600">Prob. modelo</p>
            <p className={`text-xs font-black ${col.accent}`}>{pick.model_prob}%</p>
          </div>
          <div className="rounded-lg bg-zinc-900 px-2 py-1.5 text-center">
            <p className="text-[10px] text-zinc-600">Edge</p>
            <p className="text-xs font-black text-white">+{pick.edge.toFixed(1)}%</p>
          </div>
          <div className="rounded-lg bg-zinc-900 px-2 py-1.5 text-center">
            <p className="text-[10px] text-zinc-600">Confianza</p>
            <p className={`text-xs font-black ${confidenceColor(pick.confidence)}`}>{pick.confidence}</p>
          </div>
        </div>
      </div>

      {/* Reasoning toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 border-t border-zinc-800 bg-zinc-900/40 text-left tap"
      >
        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
          Por qué la IA eligió este pick
        </span>
        <Icon name={open ? "chevronUp" : "chevronDown"} className="w-3.5 h-3.5 text-zinc-600" strokeWidth={2} />
      </button>

      {open && (
        <div className="px-4 py-3 border-t border-zinc-800 space-y-1.5">
          {pick.reasons.map((r, i) => (
            <p key={i} className="text-[12px] text-zinc-400 leading-snug">{r}</p>
          ))}
        </div>
      )}
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
    <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-2">
        Desde tu último fallo ({sim.streakDays} días de racha)
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        {sim.path.map((v, i) => (
          <span key={i} className="flex items-center gap-1">
            <span className={`text-xs font-black ${i === sim.path.length - 1 ? col.accent : "text-zinc-500"}`}>
              {v}€
            </span>
            {i < sim.path.length - 1 && (
              <Icon name="arrowRight" className="w-3 h-3 text-zinc-700" strokeWidth={2} />
            )}
          </span>
        ))}
      </div>
      <p className="text-[11px] text-zinc-600 mt-1.5">
        {gain >= 0 ? `+${gain}% sobre la inversión inicial` : `${gain}% sobre la inversión inicial`}
      </p>
    </div>
  )
}

// ─── Component: YesterdaySection ──────────────────────────────────────────────

function YesterdaySection({
  retoId, pick, color, onMark,
}: {
  retoId: string; pick: RetoPick | null; color: ColorKey
  onMark: (result: ResultMark) => void
}) {
  const yest = yesterdayStr()
  const progress = getProgress(retoId)
  const yesterdayEntry = progress.history.find((h) => h.date === yest)

  if (!yesterdayEntry && !pick) return null
  if (!yesterdayEntry) {
    // Pick exists today but nothing yesterday yet: prompt to add yesterday's result if there's prior history
    if (progress.history.length === 0) return null
    return null
  }

  const col = C[color]
  const isPending = yesterdayEntry.result === "PENDING"

  return (
    <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-2">Pick de ayer</p>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-zinc-300 leading-snug">{yesterdayEntry.match}</p>
          <p className={`text-xs mt-0.5 ${col.accent}`}>
            {yesterdayEntry.selection} · cuota {yesterdayEntry.odd.toFixed(2)}
          </p>
        </div>
        {!isPending ? (
          <span className={`shrink-0 text-xs font-black px-2 py-1 rounded-full border ${
            yesterdayEntry.result === "WIN"
              ? "bg-emerald-500/15 border-emerald-700 text-emerald-400"
              : "bg-rose-500/15 border-rose-700 text-rose-400"
          }`}>
            {yesterdayEntry.result === "WIN" ? "🟢 Acertado" : "🔴 Fallado"}
          </span>
        ) : (
          <div className="flex gap-1.5 shrink-0">
            <button onClick={() => onMark("WIN")}
              className="px-2 py-1 rounded-lg bg-emerald-500/15 border border-emerald-700 text-emerald-400 text-xs font-bold tap">
              ✓ Sí
            </button>
            <button onClick={() => onMark("LOSS")}
              className="px-2 py-1 rounded-lg bg-rose-500/15 border border-rose-700 text-rose-400 text-xs font-bold tap">
              ✗ No
            </button>
          </div>
        )}
      </div>
      {isPending && (
        <p className="text-[11px] text-zinc-600 mt-2">¿Acertaste el pick de ayer?</p>
      )}
    </div>
  )
}

// ─── Component: RetoCard ──────────────────────────────────────────────────────

function RetoCard({
  challenge, enrolled, onEnroll, onMarkYesterday, canEnroll,
}: {
  challenge: RetoChallenge
  enrolled: boolean
  onEnroll: () => void
  onMarkYesterday: (result: ResultMark) => void
  canEnroll: boolean
}) {
  const color = (challenge.color as ColorKey) ?? "emerald"
  const col = C[color]
  const progress = getProgress(challenge.id)
  const sim = calcUserSimulation(progress.history, challenge.simulation.stake)
  const wins = progress.history.filter((h) => h.result === "WIN").length
  const total = progress.history.filter((h) => h.result !== "PENDING").length

  const difficultyColors: Record<string, string> = {
    "Baja": "text-emerald-400",
    "Media": "text-amber-400",
    "Alta": "text-rose-400",
    "Muy alta": "text-violet-400",
  }

  // Check if today's pick is already registered in history
  const todayRegistered = progress.history.some((h) => h.date === todayStr())

  return (
    <div className={`bg-zinc-900 border rounded-2xl overflow-hidden shadow-lg ${col.glow} transition-all ${col.border}`}>
      {/* Gradient header */}
      <div className={`bg-gradient-to-br ${col.header} px-5 pt-5 pb-4`}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-2xl">{challenge.emoji}</p>
            <h3 className={`text-xl font-black mt-1 ${col.accent}`}>{challenge.title}</h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              {challenge.days} días · cuota objetivo {challenge.target_odd.toFixed(2)}/día
            </p>
          </div>
          <div className="text-right">
            <span className={`text-xs font-bold px-2 py-1 rounded-full border ${col.badge}`}>
              {challenge.difficulty}
            </span>
            <p className="text-[10px] text-zinc-600 mt-1.5 text-right">
              dificultad: <span className={`font-bold ${difficultyColors[challenge.difficulty]}`}>{challenge.difficulty}</span>
            </p>
          </div>
        </div>
        <p className="text-xs text-zinc-400 leading-relaxed">{challenge.description}</p>
      </div>

      {/* Simulation box */}
      <div className="mx-5 mt-4 rounded-xl border border-zinc-700/50 bg-zinc-800/40 px-4 py-3">
        <p className="text-[10px] text-zinc-500 mb-1">💰 Simulación con {challenge.simulation.stake}€ (hipotético)</p>
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-500">{challenge.simulation.stake}€</span>
          <Icon name="arrowRight" className="w-3.5 h-3.5 text-zinc-700" strokeWidth={2} />
          <span className={`text-xl font-black ${col.accent}`}>~{challenge.simulation.result}€</span>
        </div>
        <p className="text-[10px] text-zinc-600 mt-1">
          Si aciertas los {challenge.days} picks a cuota {challenge.target_odd.toFixed(2)} cada día
        </p>
      </div>

      <div className="px-5 pb-5 mt-4 space-y-0">
        {/* Today's pick */}
        {challenge.daily_pick ? (
          enrolled ? (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-1">
                Pick de hoy · {new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "short" })}
              </p>
              <PickReasoningBox pick={challenge.daily_pick} color={color} />
              {/* Mark today as done */}
              {!todayRegistered && (
                <p className="text-[11px] text-zinc-600 mt-2 text-center">
                  Vuelve mañana para marcar el resultado de hoy
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3 flex items-center gap-3">
              <span className="text-base shrink-0">🔒</span>
              <div>
                <p className="text-xs font-semibold text-zinc-400">Pick de hoy disponible</p>
                <p className="text-[11px] text-zinc-600">Inscríbete para ver el pick diario y el análisis</p>
              </div>
            </div>
          )
        ) : (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3">
            <p className="text-xs text-zinc-500">Sin pick disponible para este reto hoy.</p>
            <p className="text-[11px] text-zinc-600 mt-0.5">El modelo no detectó cuotas válidas en el rango objetivo.</p>
          </div>
        )}

        {/* Yesterday's result */}
        {enrolled && (
          <YesterdaySection
            retoId={challenge.id}
            pick={challenge.daily_pick}
            color={color}
            onMark={onMarkYesterday}
          />
        )}

        {/* Simulation tracker (if enrolled and has history) */}
        {enrolled && progress.history.length > 0 && (
          <SimulationTracker sim={sim} color={color} />
        )}

        {/* Progress bar (if enrolled) */}
        {enrolled && total > 0 && (
          <div className="mt-3">
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-zinc-500">Tu historial</span>
              <span className={col.accent}>{wins}✓ / {total - wins}✗ en {total} picks</span>
            </div>
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={`h-full ${col.bar} rounded-full transition-all`}
                style={{ width: total > 0 ? `${Math.round((wins / total) * 100)}%` : "0%" }}
              />
            </div>
            <p className="text-[11px] text-zinc-600 mt-1">
              {total > 0 ? `${Math.round((wins / total) * 100)}% de acierto` : "Sin resultados aún"}
            </p>
          </div>
        )}

        {/* Enroll / enrolled state */}
        <div className="mt-4">
          {enrolled ? (
            <div className={`flex items-center gap-2 py-2.5 px-4 rounded-xl border ${col.badge}`}>
              <span className="text-sm">✓</span>
              <span className="text-xs font-bold">Siguiendo este reto</span>
              <span className="text-[10px] text-zinc-500 ml-auto">
                {progress.joinDate ? `desde ${new Date(progress.joinDate).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}` : ""}
              </span>
            </div>
          ) : canEnroll ? (
            <button
              onClick={onEnroll}
              className={`w-full py-3 rounded-xl font-bold text-sm tap shadow-lg ${col.btn}`}
            >
              Unirse al reto {challenge.emoji}
            </button>
          ) : (
            <Link href="/pricing"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-zinc-950 font-bold text-sm tap">
              <Icon name="crown" className="w-4 h-4" strokeWidth={2.2} />
              Requiere Premium ⭐
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function RetosPage() {
  const { isPremium, isPro, plan } = usePlan()
  const [challenges, setChallenges] = useState<RetoChallenge[]>([])
  const [loading, setLoading] = useState(true)
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set())
  const [, forceRender] = useState(0) // trigger re-renders after localStorage writes

  // Load challenges
  useEffect(() => {
    getChallenges()
      .then((d) => setChallenges(d.challenges ?? []))
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [])

  // Load enrollment state from localStorage
  useEffect(() => {
    const ids = new Set<string>()
    for (const id of ["conservador", "balanceado", "agresivo", "elite"]) {
      const p = getProgress(id)
      if (p.enrolled) ids.add(id)
    }
    setEnrolledIds(ids)
  }, [])

  const handleEnroll = useCallback((challenge: RetoChallenge) => {
    const p = getProgress(challenge.id)
    const pick = challenge.daily_pick
    const updated: RetoProgress = {
      enrolled: true,
      joinDate: new Date().toISOString(),
      history: pick ? [{
        date: todayStr(),
        match: pick.match,
        selection: pick.selection,
        odd: pick.odd,
        result: "PENDING",
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
      history: p.history.map((h) =>
        h.date === yest ? { ...h, result } : h
      ),
    }
    saveProgress(retoId, updated)
    forceRender((n) => n + 1)
  }, [])

  // Determine access per reto
  function canEnroll(id: string): boolean {
    if (id === "elite") return isPro
    return isPremium
  }

  // Social proof: user milestones
  const milestones: string[] = []
  for (const id of [...enrolledIds]) {
    const p = getProgress(id)
    const wins = p.history.filter((h) => h.result === "WIN").length
    const reto = challenges.find((c) => c.id === id)
    if (wins >= 3 && reto) milestones.push(`🔥 Llevas ${wins} días acertando en el reto ${reto.title}`)
    if (wins === reto?.days) milestones.push(`🏆 ¡Completaste el reto ${reto.title}!`)
  }

  return (
    <div className="px-4 py-6 max-w-3xl mx-auto safe-x">
      <PageHeader
        icon="trophy"
        title="Retos"
        subtitle="Pick diario real con análisis completo. Sigue tu racha y mide tu rendimiento."
      />

      <div className="mb-5">
        <DisclaimerBanner variant="retos" />
      </div>

      {/* User milestones */}
      {milestones.length > 0 && (
        <div className="mb-5 space-y-2">
          {milestones.map((m, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-2.5">
              <p className="text-sm text-zinc-300">{m}</p>
            </div>
          ))}
        </div>
      )}

      {/* Plan info for free users */}
      {!isPremium && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-emerald-800/50 bg-emerald-500/5 px-4 py-3">
          <Icon name="crown" className="w-5 h-5 text-emerald-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-zinc-200">Los retos requieren Premium ⭐ o Pro 👑</p>
            <p className="text-[11px] text-zinc-500">Inscríbete en cualquier reto con Premium. El reto Élite requiere Pro.</p>
          </div>
          <Link href="/pricing"
            className="shrink-0 text-xs font-bold text-emerald-400 flex items-center gap-1 tap">
            Ver planes <Icon name="arrowRight" className="w-3.5 h-3.5" strokeWidth={2.4} />
          </Link>
        </div>
      )}

      {/* Pro-only note for Elite */}
      {isPremium && !isPro && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-violet-800/50 bg-violet-500/5 px-4 py-3">
          <span className="text-base shrink-0">👑</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-zinc-200">Reto Élite exclusivo para Pro 👑</p>
            <p className="text-[11px] text-zinc-500">Los retos Conservador, Balanceado y Agresivo están disponibles con tu plan Premium.</p>
          </div>
          <Link href="/pricing"
            className="shrink-0 text-xs font-bold text-violet-400 flex items-center gap-1 tap">
            Ver Pro <Icon name="arrowRight" className="w-3.5 h-3.5" strokeWidth={2.4} />
          </Link>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-80 rounded-2xl bg-zinc-900 animate-pulse" />
          ))}
        </div>
      )}

      {/* Reto cards */}
      {!loading && challenges.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {challenges.map((c) => (
            <RetoCard
              key={c.id}
              challenge={c}
              enrolled={enrolledIds.has(c.id)}
              canEnroll={canEnroll(c.id)}
              onEnroll={() => handleEnroll(c)}
              onMarkYesterday={(result) => handleMarkYesterday(c.id, result)}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && challenges.length === 0 && (
        <div className="text-center py-20">
          <p className="text-4xl mb-3">🏆</p>
          <p className="text-zinc-400 font-medium">Los retos se generan a diario con partidos reales.</p>
          <p className="text-zinc-600 text-sm mt-1">Vuelve en unos minutos si la plataforma está arrancando.</p>
        </div>
      )}

      <p className="text-center text-[11px] text-zinc-700 mt-8 leading-relaxed">
        Los retos son simulaciones estadísticas. No implican dinero real.<br />
        Los payouts mostrados son hipotéticos. El rendimiento pasado no garantiza resultados futuros.
      </p>
    </div>
  )
}
