"use client"

import { useEffect, useState } from "react"
import type { DarkHorse, DarkHorsesResponse } from "@/lib/world-cup/types"
import { WC_TEAMS_BY_CODE } from "@/lib/world-cup/static-data"
import { Icon } from "@/components/ui/icons"

const RISK_CONFIG = {
  low:  { label: "Bajo",  color: "from-emerald-500 to-emerald-400", text: "text-emerald-300", border: "border-emerald-700/50" },
  mid:  { label: "Medio", color: "from-amber-500 to-yellow-500",     text: "text-amber-300",   border: "border-amber-700/50"   },
  high: { label: "Alto",  color: "from-rose-500 to-orange-500",      text: "text-rose-300",    border: "border-rose-700/50"    },
} as const

export function DarkHorsesSection() {
  const [data, setData] = useState<DarkHorsesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch("/api/world-cup/dark-horses")
      .then(async (r) => {
        if (!r.ok) throw new Error(`Error ${r.status}`)
        return r.json() as Promise<DarkHorsesResponse>
      })
      .then((d) => { if (!cancelled) setData(d) })
      .catch((e: Error) => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return (
    <div>
      <div className="flex items-start gap-3 mb-4">
        <span className="grid place-items-center w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500/20 to-amber-500/15 border border-rose-700/40 text-rose-300 shadow-[0_0_14px_rgba(244,63,94,0.2)]">
          <Icon name="flame" className="w-5 h-5" strokeWidth={2} />
        </span>
        <div>
          <h2 className="text-lg font-black text-white tracking-tight">Dark Horses</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Selecciones donde el modelo detecta valor frente al baseline de su confederación.</p>
        </div>
      </div>

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-44 rounded-2xl bg-zinc-900/60 animate-pulse" />
          ))}
        </div>
      )}

      {error && !loading && (
        <div className="rounded-2xl border border-rose-700/50 bg-rose-500/10 px-4 py-4">
          <p className="text-sm font-black text-rose-300">No pudimos cargar los Dark Horses</p>
          <p className="text-[11px] text-zinc-500 mt-1">{error}. Reintenta en unos segundos.</p>
        </div>
      )}

      {data && !loading && data.darkHorses.length === 0 && (
        <div className="rounded-2xl border border-white/[0.07] bg-zinc-900/60 px-5 py-6 text-center">
          <p className="text-sm font-bold text-zinc-400">Sin valor detectable hoy</p>
          <p className="text-[11px] text-zinc-600 mt-1">El motor no encontró equipos con edge ≥4pp vs su baseline.</p>
        </div>
      )}

      {data && !loading && data.darkHorses.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 stagger">
            {data.darkHorses.map((dh, i) => (
              <DarkHorseCard key={dh.teamCode} dh={dh} rank={i + 1} />
            ))}
          </div>
          <p className="text-[10px] text-zinc-700 mt-4 leading-relaxed">{data.disclaimer}</p>
        </>
      )}
    </div>
  )
}

function DarkHorseCard({ dh, rank }: { dh: DarkHorse; rank: number }) {
  const team = WC_TEAMS_BY_CODE.get(dh.teamCode)
  const cfg = RISK_CONFIG[dh.riskTier]

  return (
    <div className={`relative rounded-2xl border ${cfg.border} bg-zinc-900/70 backdrop-blur-sm overflow-hidden shadow-xl transition-all`}>
      {/* Rank badge */}
      <span className="absolute top-3 right-3 grid place-items-center w-7 h-7 rounded-lg bg-zinc-950/70 border border-white/[0.07] text-xs font-black text-zinc-400">
        #{rank}
      </span>

      <div className={`bg-gradient-to-br ${cfg.color}/10 px-4 py-3 border-b border-white/[0.07]`}>
        <div className="flex items-center gap-3">
          <span className="text-3xl leading-none">{team?.flagEmoji ?? "🏳️"}</span>
          <div className="min-w-0">
            <p className="text-base font-black text-white tracking-tight truncate">{dh.teamName}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mt-0.5">
              {team?.confederation ?? "—"}
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 py-3">
        {/* Edge hero */}
        <div className="flex items-end gap-2 mb-3">
          <span className={`text-4xl font-black tracking-tighter leading-none ${cfg.text}`}>+{dh.edge.toFixed(1)}pp</span>
          <span className="text-[10px] text-zinc-600 mb-1.5 font-bold uppercase tracking-wider">edge</span>
        </div>

        {/* Prob comparison */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="rounded-lg bg-zinc-950/60 border border-white/[0.07] px-2.5 py-1.5">
            <p className="text-[9px] font-black uppercase tracking-wider text-zinc-600">Implícita</p>
            <p className="text-sm font-black text-zinc-300">{(dh.marketImpliedProb * 100).toFixed(1)}%</p>
          </div>
          <div className={`rounded-lg bg-zinc-950/60 border ${cfg.border} px-2.5 py-1.5`}>
            <p className="text-[9px] font-black uppercase tracking-wider text-zinc-600">Modelo</p>
            <p className={`text-sm font-black ${cfg.text}`}>{(dh.modelProb * 100).toFixed(1)}%</p>
          </div>
        </div>

        {/* Reasons */}
        <ul className="space-y-1">
          {dh.reasons.slice(0, 2).map((r, i) => (
            <li key={i} className="text-[11px] text-zinc-500 leading-snug flex gap-1.5">
              <span className={`shrink-0 ${cfg.text} font-black`}>·</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>

        {/* Risk pill */}
        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-white/[0.07]">
          <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider">{dh.marketType}</span>
          <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-zinc-950/70 border ${cfg.border} ${cfg.text}`}>
            Riesgo {cfg.label}
          </span>
        </div>
      </div>
    </div>
  )
}
