"use client"

import { useEffect, useState, useCallback } from "react"
import { getChallenges } from "@/lib/api"
import { DisclaimerBanner } from "@/components/legal/DisclaimerBanner"
import { PageHeader, Card, Button, Badge, Alert, EmptyState, Spinner } from "@/components/ui/primitives"
import { Icon } from "@/components/ui/icons"
import { usePlan } from "@/lib/plan"
import Link from "next/link"

/* ────────────────────────────────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────────────────────────────────── */

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
interface HistoryEntry { date: string; combo_odd: number; result: ResultMark; summary: string }
interface RetoProgress { enrolled: boolean; joinDate: string; history: HistoryEntry[] }

/* ────────────────────────────────────────────────────────────────────────────
   Color palette — desaturated, Apple-like accent only
   ──────────────────────────────────────────────────────────────────────────── */

type ColorKey = "emerald" | "amber" | "rose" | "violet"

const TONE: Record<ColorKey, {
  text: string; bar: string; soft: string; ring: string
}> = {
  emerald: { text: "text-emerald-400", bar: "bg-emerald-500/80", soft: "bg-emerald-500/[0.07]", ring: "ring-emerald-500/20" },
  amber:   { text: "text-amber-400",   bar: "bg-amber-400/80",   soft: "bg-amber-500/[0.07]",   ring: "ring-amber-500/20"   },
  rose:    { text: "text-rose-400",    bar: "bg-rose-500/80",    soft: "bg-rose-500/[0.07]",    ring: "ring-rose-500/20"    },
  violet:  { text: "text-violet-400",  bar: "bg-violet-500/80",  soft: "bg-violet-500/[0.07]",  ring: "ring-violet-500/20"  },
}

const BADGE_TONE: Record<ColorKey, "emerald" | "amber" | "rose" | "violet"> = {
  emerald: "emerald", amber: "amber", rose: "rose", violet: "violet",
}

/* ────────────────────────────────────────────────────────────────────────────
   LocalStorage helpers
   ──────────────────────────────────────────────────────────────────────────── */

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

function formatTime(iso: string) {
  // FASE 3.3: fecha + hora legibles ("25 jun · 18:00") en hora local del navegador.
  try {
    const d = new Date(iso)
    const date = d.toLocaleDateString("es-ES", { day: "numeric", month: "short" })
    const time = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
    return `${date} · ${time}`
  } catch { return "" }
}

/* ════════════════════════════════════════════════════════════════════════════
   ComboDisplay
   ════════════════════════════════════════════════════════════════════════════ */

function ComboDisplay({ combo, color }: { combo: RetoCombo; color: ColorKey }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  const tone = TONE[color]
  const isMulti = combo.picks.length > 1

  return (
    <div className="space-y-3 mt-4">
      {/* Combined header */}
      {isMulti && (
        <div className={`rounded-2xl ${tone.soft} px-5 py-4 flex items-center justify-between`}>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">
              Mini-combinada · {combo.picks.length} picks
            </p>
            <p className={`text-[26px] font-bold tracking-tight leading-none ${tone.text}`}>
              {combo.combined_odd.toFixed(2)}
            </p>
            <p className="text-[11px] text-zinc-600 mt-1">cuota total</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-zinc-600 mb-0.5">Prob. combinada</p>
            <p className={`text-[18px] font-bold ${tone.text}`}>{combo.combined_prob.toFixed(1)}%</p>
          </div>
        </div>
      )}

      {/* Each pick */}
      {combo.picks.map((pick, i) => (
        <div key={i} className="rounded-2xl bg-zinc-900/40 overflow-hidden">
          <div className="px-5 py-4">
            <div className="flex items-start gap-3">
              <span className={`shrink-0 grid place-items-center w-7 h-7 rounded-lg text-[12px] font-bold mt-0.5 ${tone.soft} ${tone.text}`}>
                {isMulti ? i + 1 : "→"}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-white leading-snug">{pick.match_name}</p>
                    <p className={`text-[11px] mt-0.5 font-medium ${tone.text}`}>
                      {pick.league} · {pick.market}
                    </p>
                  </div>
                  {pick.kickoff && (
                    <span className="text-[11px] text-zinc-600 shrink-0 mt-0.5 inline-flex items-center gap-1">
                      <Icon name="clock" className="w-3 h-3" strokeWidth={2} />
                      {formatTime(pick.kickoff)}
                    </span>
                  )}
                </div>

                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Selección</p>
                    <p className={`text-[16px] font-semibold ${tone.text}`}>{pick.selection}</p>
                  </div>
                  <div className={`px-4 py-2 rounded-xl ${tone.soft} font-bold text-[22px] tracking-tight leading-none ${tone.text}`}>
                    {pick.odd.toFixed(2)}
                  </div>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[11px]">
                  <span className="text-zinc-500">
                    Modelo <span className={`font-bold ${tone.text}`}>{pick.model_prob}%</span>
                  </span>
                  <span className="text-zinc-500">
                    Edge <span className="font-semibold text-white">+{pick.edge.toFixed(1)}%</span>
                  </span>
                  <span className="text-zinc-500">
                    Calidad <span className="font-semibold text-white">{pick.quality}/100</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Reasoning toggle */}
          <button
            onClick={() => setOpenIdx(openIdx === i ? null : i)}
            className="w-full flex items-center justify-between px-5 py-3 border-t border-white/[0.04] bg-zinc-950/30 hover:bg-zinc-950/50 transition-colors tap text-left"
          >
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              Por qué la IA eligió este pick
            </span>
            <Icon
              name={openIdx === i ? "chevronUp" : "chevronDown"}
              className="w-3.5 h-3.5 text-zinc-500"
              strokeWidth={2}
            />
          </button>

          {openIdx === i && (
            <div className="px-5 py-4 border-t border-white/[0.04] space-y-2 animate-fade-in">
              {pick.reasons.map((r, ri) => (
                <p key={ri} className="text-[12px] text-zinc-400 leading-relaxed">{r}</p>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   SimulationTracker
   ════════════════════════════════════════════════════════════════════════════ */

function SimulationTracker({ sim, color }: { sim: SimResult; color: ColorKey }) {
  if (sim.path.length <= 1) return null
  const tone = TONE[color]
  const start = sim.path[0]
  const end = sim.path[sim.path.length - 1]
  const gain = Math.round(((end - start) / start) * 100)

  return (
    <div className="rounded-2xl bg-zinc-900/40 px-5 py-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3">
        Tu racha · {sim.streakDays} día{sim.streakDays !== 1 ? "s" : ""} consecutivo{sim.streakDays !== 1 ? "s" : ""}
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        {sim.path.map((v, i) => (
          <span key={i} className="flex items-center gap-2">
            <span className={`text-[13px] font-semibold ${i === sim.path.length - 1 ? tone.text : "text-zinc-500"}`}>
              {v}€
            </span>
            {i < sim.path.length - 1 && (
              <Icon name="arrowRight" className="w-3 h-3 text-zinc-700" strokeWidth={2} />
            )}
          </span>
        ))}
      </div>
      <p className="text-[11px] text-zinc-500 mt-2">
        {gain >= 0 ? `+${gain}%` : `${gain}%`} sobre la inversión inicial
      </p>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   YesterdaySection
   ════════════════════════════════════════════════════════════════════════════ */

function YesterdaySection({
  retoId, color, onMark,
}: {
  retoId: string; color: ColorKey; onMark: (result: ResultMark) => void
}) {
  const progress = getProgress(retoId)
  const entry = progress.history.find((h) => h.date === yesterdayStr())
  if (!entry || progress.history.length === 0) return null

  const tone = TONE[color]
  const isPending = entry.result === "PENDING"

  return (
    <div className="rounded-2xl bg-zinc-900/40 px-5 py-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3">Pick de ayer</p>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] text-zinc-300 leading-relaxed">{entry.summary}</p>
          <p className={`text-[14px] font-semibold mt-1 ${tone.text}`}>Cuota {entry.combo_odd.toFixed(2)}</p>
        </div>
        {!isPending ? (
          <Badge tone={entry.result === "WIN" ? "emerald" : "rose"} className="shrink-0">
            {entry.result === "WIN" ? "✓ Ganaste" : "✗ Fallaste"}
          </Badge>
        ) : (
          <div className="flex gap-2 shrink-0">
            <Button variant="primary" size="sm" onClick={() => onMark("WIN")}>✓ Gané</Button>
            <Button variant="danger"  size="sm" onClick={() => onMark("LOSS")}>✗ Fallé</Button>
          </div>
        )}
      </div>
      {isPending && (
        <p className="text-[11px] text-zinc-500 mt-3">¿Acertaste la mini-combinada de ayer?</p>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   CustomRetoCreator (Pro)
   ════════════════════════════════════════════════════════════════════════════ */

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
    setLoading(true); setError(null); setCombo(null)
    try {
      const res = await fetch("/api/retos/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetOdd, nLegs }),
      })
      const data = await res.json()
      if (data.combo) setCombo(data.combo)
      else setError(data.error ?? "No se encontraron picks válidos para esa cuota hoy.")
    } catch {
      setError("Error de conexión. Inténtalo de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card variant="default" className="overflow-hidden">
      <div className="px-6 sm:px-7 pt-6 pb-5">
        <div className="flex items-start gap-3">
          <span className="grid place-items-center w-10 h-10 rounded-xl bg-violet-500/12 border border-violet-700/40 text-violet-400 shrink-0">
            <Icon name="settings" className="w-5 h-5" strokeWidth={2} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-[16px] font-semibold text-white tracking-tight">Reto Personalizado</h3>
              <Badge tone="violet" dot>👑 PRO</Badge>
            </div>
            <p className="text-[12px] text-zinc-500 mt-1 leading-relaxed">
              Define tu cuota objetivo y el sistema busca el pick ideal del pool de hoy.
            </p>
          </div>
        </div>
      </div>

      <div className="px-6 sm:px-7 pb-7 space-y-6">
        {/* Slider */}
        <div>
          <div className="flex items-end justify-between mb-3">
            <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Cuota objetivo</label>
            <span className="text-[34px] font-bold tracking-tight text-violet-400 leading-none">
              {targetOdd.toFixed(2)}
            </span>
          </div>
          <input
            type="range" min={1.10} max={5.00} step={0.05} value={targetOdd}
            onChange={(e) => { setTargetOdd(parseFloat(e.target.value)); setCombo(null) }}
            className="w-full h-1.5 rounded-full appearance-none bg-zinc-800 cursor-pointer"
            style={{ accentColor: "#a78bfa" }}
          />
          <div className="flex justify-between text-[10px] text-zinc-600 mt-2">
            <span>1.10 · muy seguro</span>
            <span>5.00 · muy arriesgado</span>
          </div>
          <div className="grid grid-cols-4 gap-2 mt-4">
            {ODD_PRESETS.map((p) => {
              const active = Math.abs(targetOdd - p.value) < 0.01
              return (
                <button key={p.value}
                  onClick={() => { setTargetOdd(p.value); setCombo(null) }}
                  className={`py-2 rounded-xl text-[12px] font-semibold transition-all ${
                    active
                      ? "bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/30"
                      : "bg-zinc-900/40 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/70"
                  }`}>
                  {p.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* N legs */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 mb-3 block">Número de picks</label>
          <div className="grid grid-cols-2 gap-2">
            {([1, 2, 3, 4] as const).map((n) => {
              const active = nLegs === n
              return (
                <button key={n}
                  onClick={() => { setNLegs(n); setCombo(null) }}
                  className={`py-3.5 px-3 rounded-2xl text-left transition-all ${
                    active
                      ? "bg-violet-500/12 text-violet-300 ring-1 ring-violet-500/30"
                      : "bg-zinc-900/40 text-zinc-400 hover:text-white hover:bg-zinc-900/70"
                  }`}>
                  <p className="text-[13px] font-semibold leading-tight">
                    {n === 1 ? "Simple" : `Combinada ×${n}`}
                  </p>
                  <p className="text-[10px] font-medium mt-1 opacity-70">
                    {n === 1 ? "1 partido, cuota exacta" : `${n} partidos, producto ~objetivo`}
                  </p>
                </button>
              )
            })}
          </div>
        </div>

        {/* CTA */}
        <Button variant="violet" size="lg" full onClick={generate} loading={loading} iconLeft={loading ? undefined : "spark"}>
          {loading ? "Buscando en el pool de hoy" : "Generar pick del día"}
        </Button>

        {error && !loading && <Alert tone="error">{error}</Alert>}

        {combo && !loading && (
          <div className="animate-fade-in">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Pick generado</span>
              <Badge tone="violet">cuota {combo.combined_odd.toFixed(2)}</Badge>
            </div>
            <ComboDisplay combo={combo} color="violet" />
            <Button variant="ghost" size="sm" full onClick={() => setCombo(null)} className="mt-3">
              Generar otro
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   RetoCard
   ════════════════════════════════════════════════════════════════════════════ */

function RetoCard({
  challenge, enrolled, canEnroll, onEnroll, onMarkYesterday,
}: {
  challenge: RetoChallenge; enrolled: boolean; canEnroll: boolean
  onEnroll: () => void; onMarkYesterday: (r: ResultMark) => void
}) {
  const color = (challenge.color as ColorKey) ?? "emerald"
  const tone = TONE[color]
  const progress = getProgress(challenge.id)
  const sim = calcUserSim(progress.history, challenge.simulation.stake)
  const wins = progress.history.filter((h) => h.result === "WIN").length
  const total = progress.history.filter((h) => h.result !== "PENDING").length
  const gainPct = Math.round(
    ((challenge.simulation.result - challenge.simulation.stake) / challenge.simulation.stake) * 100
  )

  return (
    <Card variant="default" className="overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-6 sm:px-7 pt-6 pb-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="text-[28px] leading-none">{challenge.emoji}</span>
            <h3 className={`text-[24px] font-bold tracking-tight mt-3 ${tone.text}`}>
              {challenge.title}
            </h3>
            <p className="text-[12px] text-zinc-500 mt-1 font-medium">
              {challenge.days} días ·{" "}
              {challenge.n_legs > 1 ? `combinada ${challenge.n_legs} picks/día` : "1 pick directo/día"}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <Badge tone={BADGE_TONE[color]}>{challenge.difficulty}</Badge>
            <span className={`text-[12px] font-semibold px-3 py-1.5 rounded-xl ${tone.soft} ${tone.text}`}>
              ~{challenge.target_odd.toFixed(2)} /día
            </span>
          </div>
        </div>
        <p className="text-[13px] text-zinc-400 mt-4 leading-relaxed">{challenge.description}</p>
      </div>

      {/* Simulation hero */}
      <div className="mx-6 sm:mx-7">
        <div className={`rounded-2xl ${tone.soft} px-5 py-5`}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            Simulación hipotética · {challenge.days} días
          </p>
          <div className="flex items-end gap-3 mt-3">
            <div>
              <span className="text-[13px] text-zinc-600 line-through">{challenge.simulation.stake}€</span>
              <div className={`text-[48px] font-bold tracking-tighter leading-none mt-1 ${tone.text}`}>
                ~{challenge.simulation.result}€
              </div>
            </div>
            <span className={`text-[14px] font-semibold pb-1.5 ${tone.text} opacity-80`}>
              +{gainPct}%
            </span>
          </div>
          <p className="text-[10px] text-zinc-600 mt-3">sin garantías · resultado estadístico</p>
        </div>
      </div>

      <div className="px-6 sm:px-7 pt-5 pb-6 space-y-4 flex-1 flex flex-col">
        {/* Daily combo */}
        {challenge.daily_combo ? (
          enrolled ? (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">
                Pick{challenge.n_legs > 1 ? "s" : ""} de hoy ·{" "}
                {new Date().toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })}
              </p>
              <ComboDisplay combo={challenge.daily_combo} color={color} />
            </div>
          ) : (
            <div className="rounded-2xl bg-zinc-900/40 px-5 py-4 flex items-center gap-3">
              <Icon name="lock" className="w-4 h-4 text-zinc-500 shrink-0" strokeWidth={2} />
              <div>
                <p className="text-[13px] font-semibold text-zinc-200">
                  {challenge.n_legs > 1 ? "Mini-combinada" : "Pick"} de hoy disponible
                </p>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Inscríbete para ver los picks y el análisis diario
                </p>
              </div>
            </div>
          )
        ) : (
          <div className="rounded-2xl bg-zinc-900/40 px-5 py-4">
            <p className="text-[13px] font-semibold text-zinc-300">Sin picks válidos para hoy.</p>
            <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
              El modelo no encontró combinaciones dentro del rango de este reto hoy.
            </p>
          </div>
        )}

        {enrolled && <YesterdaySection retoId={challenge.id} color={color} onMark={onMarkYesterday} />}
        {enrolled && sim.path.length > 1 && <SimulationTracker sim={sim} color={color} />}

        {/* Progress */}
        {enrolled && total > 0 && (
          <div className="rounded-2xl bg-zinc-900/40 px-5 py-4">
            <div className="flex justify-between text-[11px] mb-2.5">
              <span className="text-zinc-500 font-medium">Tu historial</span>
              <span className={`font-semibold ${tone.text}`}>
                {wins}✓ / {total - wins}✗ en {total} días
              </span>
            </div>
            <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
              <div className={`h-full ${tone.bar} rounded-full transition-all`}
                style={{ width: `${total > 0 ? Math.round((wins / total) * 100) : 0}%` }} />
            </div>
            <p className="text-[11px] text-zinc-500 mt-2">
              {Math.round((wins / total) * 100)}% de acierto
            </p>
          </div>
        )}

        {/* CTA — pushed to bottom */}
        <div className="mt-auto pt-1">
          {enrolled ? (
            <div className={`flex items-center gap-2 py-3 px-4 rounded-xl ${tone.soft} ${tone.text}`}>
              <Icon name="check" className="w-4 h-4" strokeWidth={2.4} />
              <span className="text-[13px] font-semibold">Siguiendo este reto</span>
              {progress.joinDate && (
                <span className="text-[11px] text-zinc-500 ml-auto">
                  desde {new Date(progress.joinDate).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                </span>
              )}
            </div>
          ) : canEnroll ? (
            <Button
              variant={color === "violet" ? "violet" : "premium"}
              size="lg" full onClick={onEnroll}>
              Unirse al reto {challenge.emoji}
            </Button>
          ) : (
            <Button variant="premium" size="lg" full iconLeft="crown" href="/pricing">
              {challenge.id === "pro" ? "Requiere Pro" : "Requiere Premium"}
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   Main page
   ════════════════════════════════════════════════════════════════════════════ */

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
    const summary = combo ? combo.picks.map((p) => p.selection).join(" · ") : "—"
    const updated: RetoProgress = {
      enrolled: true,
      joinDate: new Date().toISOString(),
      history: combo ? [{
        date: todayStr(), combo_odd: combo.combined_odd, result: "PENDING", summary,
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

  const milestones: string[] = []
  for (const id of [...enrolledIds]) {
    const p = getProgress(id)
    const wins = p.history.filter((h) => h.result === "WIN").length
    const reto = challenges.find((c) => c.id === id)
    if (reto && wins >= 3) milestones.push(`🔥 ${wins} días acertando en el reto ${reto.title}`)
    if (reto && wins === reto.days) milestones.push(`🏆 ¡Completaste el reto ${reto.title}!`)
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 safe-x">
      <PageHeader
        icon="trophy"
        title="Retos"
        subtitle="Mini-combinadas diarias generadas del pool real. Sigue tu racha y mide tu rendimiento sin dinero real."
      />

      <div className="space-y-5">
        <DisclaimerBanner variant="retos" />

        {milestones.length > 0 && (
          <div className="space-y-2">
            {milestones.map((m, i) => (
              <Card key={i} variant="flat" className="px-5 py-3">
                <p className="text-[13.5px] text-zinc-300">{m}</p>
              </Card>
            ))}
          </div>
        )}

        {!isPremium && (
          <Alert tone="info" title="Los retos requieren Premium ⭐ o Pro 👑">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span>El reto PRO es exclusivo para usuarios Pro.</span>
              <Link href="/pricing" className="text-[12px] font-semibold text-emerald-400 inline-flex items-center gap-1 tap whitespace-nowrap">
                Ver planes <Icon name="arrowRight" className="w-3.5 h-3.5" strokeWidth={2.4} />
              </Link>
            </div>
          </Alert>
        )}

        {isPremium && !isPro && (
          <Alert tone="info" title="Reto PRO exclusivo para usuarios Pro 👑">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span>Conservador, Intermedio y Avanzado disponibles con Premium.</span>
              <Link href="/pricing" className="text-[12px] font-semibold text-violet-400 inline-flex items-center gap-1 tap whitespace-nowrap">
                Ver Pro <Icon name="arrowRight" className="w-3.5 h-3.5" strokeWidth={2.4} />
              </Link>
            </div>
          </Alert>
        )}

        {isPro && <CustomRetoCreator />}

        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-[28rem] rounded-3xl bg-zinc-900/40 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && challenges.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
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
          <Card variant="flat" className="px-6 py-12">
            <EmptyState
              icon="trophy"
              title="Aún no hay retos disponibles"
              hint="Los retos se generan a diario con partidos reales. Vuelve en unos minutos si la plataforma está arrancando."
            />
          </Card>
        )}

        <p className="text-center text-[11px] text-zinc-600 pt-4 leading-relaxed">
          Retos y mini-combinadas son simulaciones estadísticas · Sin dinero real · +18
        </p>
      </div>
    </div>
  )
}
