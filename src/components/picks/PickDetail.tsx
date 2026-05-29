"use client"

import { useState } from "react"
import { type Pick } from "@/types"
import { usePlan } from "@/lib/plan"
import {
  getRemainingSecondOpinions,
  incrementSecondOpinion,
  addRejectedSelection,
  getRejectedSelections,
} from "@/lib/second-opinion-quota"

const TIER_COLOR: Record<string, string> = {
  SAFE:   "text-emerald-400",
  HIGH:   "text-amber-400",
  MEDIUM: "text-blue-400",
}

interface Props {
  pick: Pick & { engine?: any; is_second_opinion?: boolean }
  onClose: () => void
}

interface SecondOpinionChange {
  market_from: string;       market_to: string
  selection_from: string;    selection_to: string
  odd_to: number;            edge_to: number
  quality_from: number;      quality_to: number
  why_changed: string
}

export function PickDetail({ pick, onClose }: Props) {
  const tier = TIER_COLOR[pick.confidence_tier] ?? "text-white"
  const { plan } = usePlan()

  // El pick que mostramos puede ser el original o una segunda opinión
  const [currentPick, setCurrentPick] = useState<typeof pick>(pick)
  const [lastChange, setLastChange] = useState<SecondOpinionChange | null>(null)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const remaining = getRemainingSecondOpinions(plan, pick.id)

  async function requestSecondOpinion() {
    if (remaining <= 0 || loading) return
    setLoading(true); setErrorMsg(null)
    try {
      const excluded = getRejectedSelections(pick.id)
      const res = await fetch("/api/picks/second-opinion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          match_id: pick.id.replace(/-alt$/, ""),
          original_market: currentPick.market,
          original_selection: currentPick.selection,
          original_quality: currentPick.quality_score ?? 0,
          exclude_selections: excluded,
        }),
      })
      const data = await res.json()
      if (!data.found) {
        setErrorMsg(data.reason ?? "No hay alternativa con calidad suficiente.")
      } else {
        // Marcar selección actual como rechazada y consumir cuota
        addRejectedSelection(pick.id, currentPick.selection)
        incrementSecondOpinion(pick.id)
        // Server returns `alternative` — merge it into the current pick shape
        const alt = data.alternative ?? data.pick
        if (alt) {
          setCurrentPick({
            ...currentPick,
            market: alt.market ?? currentPick.market,
            selection: alt.selection ?? currentPick.selection,
            best_odd: alt.odd ?? alt.best_odd ?? currentPick.best_odd,
            quality_score: alt.qualityScore ?? alt.quality_score ?? currentPick.quality_score,
            is_second_opinion: true,
          } as any)
        }
        // changeLog can be at data.changeLog or data.changes
        setLastChange(data.changeLog ?? data.changes ?? null)
      }
    } catch (e: any) {
      setErrorMsg("Error de red: " + (e?.message ?? "desconocido"))
    } finally {
      setLoading(false)
    }
  }

  const p = currentPick
  const engine = (p as any).engine

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}>
      <div
        className="w-full sm:w-[560px] max-h-[92vh] overflow-y-auto bg-zinc-900/95 border border-white/[0.07] rounded-t-3xl sm:rounded-2xl p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider">{p.league_name}</p>
            <h2 className="text-lg font-bold text-white mt-0.5">
              {p.home_team} vs {p.away_team}
            </h2>
            {(p as any).is_second_opinion && (
              <span className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide bg-blue-500/15 text-blue-300 border border-blue-700/50">
                🔄 Segunda opinión
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-2xl leading-none">×</button>
        </div>

        {/* Pick summary */}
        <div className="flex items-center justify-between bg-zinc-800/60 border border-white/[0.07] rounded-xl p-4">
          <div className="min-w-0">
            <p className="text-xs text-zinc-400 uppercase">{p.market}</p>
            <p className="text-xl font-bold text-white mt-0.5">{p.selection}</p>
            {p.risk_tier && (
              <span className={`mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide border ${
                p.risk_tier === "low"
                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-700/50"
                  : p.risk_tier === "mid"
                    ? "bg-amber-500/15 text-amber-300 border-amber-700/50"
                    : "bg-rose-500/15 text-rose-300 border-rose-700/50"
              }`}>
                {p.risk_tier === "low" ? "🟢 Conservador" : p.risk_tier === "mid" ? "🟡 Riesgo medio" : "🔴 Alto riesgo"}
              </span>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className={`text-2xl font-black ${tier}`}>{p.confidence_pct}%</p>
            <p className="text-xs text-zinc-500">{p.confidence_tier}</p>
          </div>
        </div>

        {/* Qué cambió (si es segunda opinión) */}
        {lastChange && (
          <div className="rounded-xl border border-blue-800/60 bg-blue-500/[0.08] p-3.5 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-300">Qué cambió</p>
            <p className="text-sm text-zinc-200 leading-snug">{lastChange.why_changed}</p>
            <div className="grid grid-cols-3 gap-2 pt-1 text-[11px]">
              <DiffCell label="Mercado" from={lastChange.market_from} to={lastChange.market_to} />
              <DiffCell label="Calidad" from={`${lastChange.quality_from}`} to={`${lastChange.quality_to}`} />
              <DiffCell label="Edge" from="—" to={`+${lastChange.edge_to}%`} />
            </div>
          </div>
        )}

        {/* Value reason */}
        {p.value_reason && (
          <div className="bg-emerald-500/[0.08] border border-emerald-700/40 rounded-xl p-3">
            <p className="text-[10px] text-emerald-500 uppercase tracking-wider font-bold mb-1">Por qué hay valor</p>
            <p className="text-sm text-zinc-200 leading-snug">{p.value_reason}</p>
          </div>
        )}

        {/* Odds & Value */}
        {p.best_odd && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <Stat label="Cuota real" value={p.best_odd.toFixed(2)} sub={p.bookmaker ?? ""} />
            <Stat label="Prob. consenso" value={`${p.model_prob.toFixed(1)}%`} />
            {p.value_edge != null && (
              <Stat label="Edge real" value={`+${p.value_edge.toFixed(1)}%`} positive={p.value_edge > 0} />
            )}
            {p.quality_score != null && (
              <Stat label="Calidad" value={`${p.quality_score}/100`} />
            )}
          </div>
        )}

        {/* Motor de decisión — transparencia */}
        {engine && (
          <div className="rounded-xl border border-white/[0.07] bg-zinc-950/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                🧠 Motor de decisión
              </p>
              <span className="text-[10px] text-emerald-400 font-bold">
                Validado por 5 modelos
              </span>
            </div>

            {/* Mini-scores */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <MiniScore label="Consenso" value={`${engine.consensus_agreement}%`} good={engine.consensus_agreement >= 70} />
              <MiniScore label="Incertidumbre" value={`${engine.uncertainty}`} good={engine.uncertainty < 25} invert />
              <MiniScore label="Contradicción" value={`${engine.contradiction}`} good={engine.contradiction < 20} invert />
            </div>

            {/* Sub-modelos */}
            {engine.models && (
              <div className="space-y-1.5 pt-1">
                {engine.models.map((m: any) => (
                  <div key={m.name} className="flex items-center gap-2 text-[11px]">
                    <span className="w-16 text-zinc-500 uppercase font-bold">{LABEL[m.name] ?? m.name}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-blue-500 to-emerald-400" style={{ width: `${m.prob}%` }} />
                    </div>
                    <span className="text-zinc-300 font-semibold w-10 text-right">{m.prob.toFixed(0)}%</span>
                    <span className="text-zinc-600 w-10 text-right">·{m.confidence}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Reasons */}
        <div>
          <h3 className="text-sm font-semibold text-zinc-300 mb-2">Análisis (datos reales)</h3>
          <ul className="space-y-1.5">
            {p.reasons.map((r, i) => (
              <li key={i} className="flex gap-2 text-sm text-zinc-400">
                <span className="text-emerald-500 mt-0.5">·</span>
                {r}
              </li>
            ))}
          </ul>
        </div>

        {/* Second Opinion CTA */}
        <div className="pt-2 border-t border-white/[0.07]">
          {errorMsg && (
            <p className="text-xs text-amber-400 mb-2 text-center">{errorMsg}</p>
          )}
          <button
            onClick={requestSecondOpinion}
            disabled={remaining <= 0 || loading}
            className={`w-full py-3 rounded-xl text-sm font-bold border tap transition-all flex items-center justify-center gap-2 ${
              remaining <= 0
                ? "bg-zinc-900/60 text-zinc-600 border-white/[0.05] cursor-not-allowed"
                : loading
                  ? "bg-zinc-800/60 text-zinc-400 border-white/[0.07]"
                  : "bg-zinc-800/60 hover:bg-zinc-700/60 text-white border-white/[0.10]"
            }`}
          >
            {loading ? (
              <>⏳ Reanalizando partido…</>
            ) : remaining <= 0 ? (
              <>🔒 Sin segundas opiniones disponibles hoy</>
            ) : (
              <>🔄 No me convence — buscar alternativa <span className="text-zinc-500">({remaining} restantes)</span></>
            )}
          </button>
          <p className="text-[10px] text-zinc-600 mt-1.5 text-center leading-snug">
            Plan {plan} · {plan === "free" ? "1" : plan === "premium" ? "3" : "5"} segundas opiniones/día por pick.
            Solo se devuelve una alternativa si iguala o mejora la calidad del actual.
          </p>
        </div>

        {/* CTA */}
        {p.bookmaker && (
          <p className="text-xs text-zinc-600 text-center">
            Cuota disponible en {p.bookmaker} · siempre apuesta con responsabilidad
          </p>
        )}
      </div>
    </div>
  )
}

const LABEL: Record<string, string> = {
  stat:    "Stat",
  context: "Contexto",
  form:    "Forma",
  market:  "Mercado",
  history: "Histórico",
}

function MiniScore({ label, value, good, invert }: { label: string; value: string; good: boolean; invert?: boolean }) {
  const color = good ? "text-emerald-400" : invert ? "text-amber-400" : "text-zinc-400"
  return (
    <div className="rounded-lg bg-zinc-900/60 border border-white/[0.07] px-2 py-2">
      <p className="text-[9px] text-zinc-600 uppercase font-bold">{label}</p>
      <p className={`text-base font-black ${color}`}>{value}</p>
    </div>
  )
}

function DiffCell({ label, from, to }: { label: string; from: string; to: string }) {
  return (
    <div className="rounded-lg bg-zinc-900/60 border border-white/[0.07] px-2 py-1.5">
      <p className="text-[9px] text-zinc-600 uppercase">{label}</p>
      <p className="text-zinc-500 line-through text-[10px] truncate">{from}</p>
      <p className="text-emerald-300 font-bold text-[11px] truncate">{to}</p>
    </div>
  )
}

function Stat({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean }) {
  return (
    <div className="bg-zinc-800 rounded-xl p-3">
      <p className="text-[10px] text-zinc-500 uppercase">{label}</p>
      <p className={`text-lg font-bold mt-0.5 ${positive === true ? "text-emerald-400" : positive === false ? "text-red-400" : "text-white"}`}>
        {value}
      </p>
      {sub && <p className="text-[10px] text-zinc-600">{sub}</p>}
    </div>
  )
}
