"use client"

import { useEffect, useState, useCallback } from "react"
import { Icon } from "@/components/ui/icons"
import type { WCCombinada, WCCombinadasResponse, RiskTier, WCCombinadaLeg } from "@/lib/world-cup/wc-combinadas"

// ─── Data fetching ────────────────────────────────────────────────────────────

function useWCCombinadas() {
  const [data, setData]     = useState<WCCombinadasResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const fetch_ = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/world-cup/combinadas")
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch_() }, [fetch_])
  return { data, loading, error, refresh: fetch_ }
}

// ─── Tier config ──────────────────────────────────────────────────────────────

const TIER_STYLE = {
  segura: {
    border:  "border-emerald-700/50",
    header:  "from-emerald-600/15 via-emerald-600/5 to-transparent",
    icon:    "text-emerald-400",
    iconBg:  "bg-emerald-500/15",
    badge:   "border-emerald-700/50 bg-emerald-500/10 text-emerald-300",
    bar:     "bg-gradient-to-r from-emerald-500 to-emerald-400",
    prob:    "text-emerald-300",
  },
  balanceada: {
    border:  "border-blue-700/50",
    header:  "from-blue-600/15 via-blue-600/5 to-transparent",
    icon:    "text-blue-400",
    iconBg:  "bg-blue-500/15",
    badge:   "border-blue-700/50 bg-blue-500/10 text-blue-300",
    bar:     "bg-gradient-to-r from-blue-500 to-cyan-400",
    prob:    "text-blue-300",
  },
  soñadora: {
    border:  "border-violet-700/50",
    header:  "from-violet-600/15 via-violet-600/5 to-transparent",
    icon:    "text-violet-400",
    iconBg:  "bg-violet-500/15",
    badge:   "border-violet-700/50 bg-violet-500/10 text-violet-300",
    bar:     "bg-gradient-to-r from-violet-500 to-fuchsia-400",
    prob:    "text-violet-300",
  },
} as const satisfies Record<RiskTier, object>

// ─── Quality dot ──────────────────────────────────────────────────────────────

function QualityDot({ quality }: { quality: "high" | "medium" | "low" }) {
  const colors = { high: "bg-emerald-400", medium: "bg-amber-400", low: "bg-zinc-500" }
  const labels = { high: "Datos completos", medium: "Datos parciales", low: "Estimación" }
  return (
    <span className="flex items-center gap-1">
      <span className={`w-1.5 h-1.5 rounded-full ${colors[quality]}`} />
      <span className="text-[9px] text-zinc-500">{labels[quality]}</span>
    </span>
  )
}

// ─── Leg card ─────────────────────────────────────────────────────────────────

function LegCard({ leg, tier }: { leg: WCCombinadaLeg; tier: RiskTier }) {
  const s = TIER_STYLE[tier]
  const pct = Math.round(leg.modelProb * 100)
  const date = new Date(leg.kickoffISO).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })
  const time = new Date(leg.kickoffISO).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })

  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-3.5 space-y-2.5">
      {/* Match header */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-black text-white">
          {leg.homeCode} <span className="text-zinc-600">vs</span> {leg.awayCode}
        </span>
        <span className="text-[10px] text-zinc-500">{date} {time}</span>
      </div>

      {/* Market */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-[11px] font-black ${s.badge}`}>
          {leg.marketLabel}
        </span>
        <span className={`text-xs font-black ${s.prob}`}>{pct}%</span>
        <span className="text-[10px] text-zinc-500 font-bold">
          {leg.realOdds ? leg.realOdds.toFixed(2) : leg.impliedOdds.toFixed(2)}
        </span>
        {leg.realOdds && (
          <span className="text-[9px] text-zinc-600">{leg.bookmaker}</span>
        )}
        {leg.hasValue && leg.valuePct !== null && (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-700/40 text-[9px] font-black text-emerald-400">
            ✦ VALUE +{leg.valuePct.toFixed(1)}%
          </span>
        )}
      </div>

      {/* Confidence bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600">Confianza</span>
          <span className="text-[10px] font-black text-zinc-400">{leg.confidence}/100</span>
        </div>
        <div className="h-1 rounded-full bg-zinc-800/80 overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-700 ${s.bar}`}
               style={{ width: `${leg.confidence}%` }} />
        </div>
      </div>

      {/* Justification */}
      <p className="text-[10px] text-zinc-500 leading-relaxed">{leg.justification}</p>

      <QualityDot quality={leg.dataQuality} />
    </div>
  )
}

// ─── Combinada card ───────────────────────────────────────────────────────────

function CombinadaCard({ combinada }: { combinada: WCCombinada }) {
  const [expanded, setExpanded] = useState(false)
  const s = TIER_STYLE[combinada.tier]
  const pct = Math.round(combinada.combinedProb * 100)

  return (
    <div className={`rounded-2xl border ${s.border} overflow-hidden`}>
      {/* Header */}
      <div className={`bg-gradient-to-br ${s.header} px-5 pt-4 pb-3.5 border-b border-zinc-800/50`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className={`grid place-items-center w-8 h-8 rounded-xl ${s.iconBg} shrink-0`}>
              <Icon name="combinadas" className={`w-4 h-4 ${s.icon}`} strokeWidth={2} />
            </span>
            <div>
              <span className={`inline-block text-[10px] font-black uppercase tracking-widest mb-0.5 ${s.icon}`}>
                {combinada.tierLabel}
              </span>
              <p className="text-xs text-zinc-400">{combinada.legs.length} selecciones</p>
            </div>
          </div>
          {/* Combined prob + odds */}
          <div className="text-right shrink-0">
            <p className={`text-2xl font-black ${s.prob}`}>{pct}%</p>
            <p className="text-[10px] text-zinc-600">prob. conjunta</p>
          </div>
        </div>

        {/* Odds chip */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1 rounded-lg border ${s.badge} px-2 py-0.5 text-[10px] font-black`}>
            Cuota impl. {combinada.combinedImpliedOdds.toFixed(2)}
          </span>
          <span className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900/50 px-2 py-0.5 text-[10px] text-zinc-500">
            Confianza {combinada.totalConfidence}/100
          </span>
        </div>
      </div>

      {/* Rationale */}
      <div className="px-5 py-3.5">
        <p className="text-[11px] text-zinc-400 leading-relaxed">{combinada.rationale}</p>
      </div>

      {/* Toggle legs */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-2.5 border-t border-zinc-800/50 hover:bg-zinc-800/30 transition-colors tap"
      >
        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
          {expanded ? "Ocultar selecciones" : "Ver selecciones"}
        </span>
        <Icon
          name={expanded ? "chevronUp" : "chevronDown"}
          className="w-4 h-4 text-zinc-500"
          strokeWidth={2.2}
        />
      </button>

      {/* Legs */}
      {expanded && (
        <div className="px-4 pb-4 space-y-2.5 border-t border-zinc-800/50 pt-3">
          {combinada.legs.map((leg, i) => (
            <LegCard key={`${leg.matchId}-${leg.market}-${i}`} leg={leg} tier={combinada.tier} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CombSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-32 rounded-2xl bg-zinc-900/60 animate-pulse" />
      ))}
    </div>
  )
}

// ─── Main section ─────────────────────────────────────────────────────────────

export function WCCombinadasSection() {
  const { data, loading, error, refresh } = useWCCombinadas()

  return (
    <section>
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="section-label">Combinadas Mundial</span>
          <h2 className="text-lg font-black text-white mt-0.5">Motor IA · 3 perfiles de riesgo</h2>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="grid place-items-center w-8 h-8 rounded-xl border border-zinc-800 hover:border-zinc-700 bg-zinc-900/60 hover:bg-zinc-800/60 tap transition-all disabled:opacity-40"
          aria-label="Actualizar combinadas"
        >
          <Icon
            name="arrowRight"
            className={`w-4 h-4 text-zinc-400 transition-transform ${loading ? "rotate-90" : ""}`}
            strokeWidth={2}
          />
        </button>
      </div>

      {loading && <CombSkeleton />}

      {error && !loading && (
        <div className="rounded-2xl border border-rose-700/40 bg-rose-500/8 p-4">
          <p className="text-sm font-black text-rose-300">No se pudieron generar las combinadas</p>
          <p className="text-[11px] text-zinc-500 mt-1">{error}</p>
          <button
            onClick={refresh}
            className="mt-2 px-3 py-1.5 rounded-lg bg-rose-500/15 border border-rose-700/40 text-rose-300 text-xs font-black tap"
          >
            Reintentar
          </button>
        </div>
      )}

      {data && !loading && (
        <>
          {data.matchesAnalyzed === 0 ? (
            <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-6 text-center">
              <Icon name="bell" className="w-8 h-8 text-zinc-600 mx-auto mb-2" strokeWidth={1.5} />
              <p className="text-sm font-black text-zinc-300">Sin partidos próximos</p>
              <p className="text-[11px] text-zinc-500 mt-1">Las combinadas se generarán cuando haya fixtures programados.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.segura     && <CombinadaCard combinada={data.segura}     />}
              {data.balanceada && <CombinadaCard combinada={data.balanceada} />}
              {data.soñadora   && <CombinadaCard combinada={data.soñadora}   />}

              <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/30 p-3.5">
                <p className="text-[9px] text-zinc-600 leading-relaxed">{data.disclaimer}</p>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}
