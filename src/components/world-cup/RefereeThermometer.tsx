"use client"

import type { RefereeStats } from "@/lib/world-cup/types"
import { Icon } from "@/components/ui/icons"

interface Props {
  referee: RefereeStats | null
  /** Compacto para fila resumen */
  compact?: boolean
}

const SEVERITY_CONFIG = {
  "lenient":     { label: "Permisivo",   color: "from-emerald-500 to-emerald-400", barPct: 25,  text: "text-emerald-300", glow: "shadow-emerald-900/40" },
  "moderate":    { label: "Moderado",    color: "from-amber-500 to-amber-400",     barPct: 50,  text: "text-amber-300",   glow: "shadow-amber-900/40" },
  "strict":      { label: "Estricto",    color: "from-orange-500 to-rose-400",     barPct: 75,  text: "text-orange-300",  glow: "shadow-orange-900/40" },
  "very-strict": { label: "Muy estricto", color: "from-rose-500 to-red-500",       barPct: 100, text: "text-rose-300",    glow: "shadow-rose-900/40" },
} as const

export function RefereeThermometer({ referee, compact = false }: Props) {
  if (!referee) {
    return (
      <div className="rounded-2xl border border-white/[0.07] bg-zinc-900/60 p-4">
        <div className="flex items-center gap-3">
          <span className="grid place-items-center w-9 h-9 rounded-xl bg-zinc-800 text-zinc-500">
            <Icon name="whistle" className="w-4.5 h-4.5" />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Árbitro</p>
            <p className="text-sm text-zinc-400 mt-0.5">Sin designar todavía</p>
          </div>
        </div>
      </div>
    )
  }

  const cfg = SEVERITY_CONFIG[referee.severity]
  const yellow = referee.cards.yellowPerMatch
  const red    = referee.cards.redPerMatch
  const pens   = referee.cards.penaltiesPerMatch

  if (compact) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-zinc-900/60 px-3 py-2">
        <span className={`grid place-items-center w-8 h-8 rounded-lg bg-gradient-to-br ${cfg.color} text-zinc-950`}>
          <Icon name="whistle" className="w-4 h-4" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black text-white truncate">{referee.name}</p>
          <p className={`text-[10px] font-bold uppercase tracking-wider ${cfg.text}`}>{cfg.label} · {yellow.toFixed(1)} 🟨/p</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-zinc-900/60 backdrop-blur-sm overflow-hidden shadow-xl">
      {/* Header */}
      <div className="bg-gradient-to-br from-amber-600/12 to-transparent px-5 py-4 border-b border-white/[0.07]">
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Termómetro del árbitro</p>
        <div className="flex items-center gap-3">
          <span className={`grid place-items-center w-11 h-11 rounded-xl bg-gradient-to-br ${cfg.color} text-zinc-950 shadow-lg ${cfg.glow}`}>
            <Icon name="whistle" className="w-5 h-5" strokeWidth={2.2} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-black text-white truncate">{referee.name}</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">{referee.nationality} · {referee.internationalMatches} partidos internacionales</p>
          </div>
        </div>
      </div>

      {/* Thermometer bar */}
      <div className="px-5 pt-4">
        <div className="flex items-baseline justify-between mb-2">
          <span className={`text-2xl font-black tracking-tight ${cfg.text}`}>{cfg.label}</span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Severidad</span>
        </div>

        <div className="h-3 w-full bg-zinc-800 rounded-full overflow-hidden relative">
          <div
            className={`h-full bg-gradient-to-r ${cfg.color} rounded-full transition-all duration-500`}
            style={{ width: `${cfg.barPct}%` }}
          />
          {/* Ticks */}
          <div className="absolute inset-0 flex justify-between px-[2px] pointer-events-none">
            {[25, 50, 75, 100].map((tick) => (
              <span key={tick} className="w-px h-full bg-zinc-950/60" />
            ))}
          </div>
        </div>
        <div className="flex justify-between text-[9px] text-zinc-700 mt-1 font-bold uppercase tracking-wider">
          <span>Permisivo</span><span>Moderado</span><span>Estricto</span><span>Muy estricto</span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2 px-5 py-4">
        <StatCell label="Amarillas/p" value={yellow.toFixed(1)} color="text-amber-300" icon="cards" />
        <StatCell label="Rojas/p" value={red.toFixed(2)} color="text-rose-300" icon="cards" />
        <StatCell label="Penaltis/p" value={pens != null ? pens.toFixed(2) : "—"} color="text-orange-300" icon="alert" />
      </div>

      {/* Notes */}
      {referee.notes && (
        <div className="px-5 pb-4">
          <p className="text-xs text-zinc-400 leading-snug border-l-2 border-amber-700/60 pl-2.5 italic">
            {referee.notes}
          </p>
        </div>
      )}
    </div>
  )
}

function StatCell({ label, value, color, icon }: { label: string; value: string; color: string; icon: string }) {
  return (
    <div className="rounded-xl bg-zinc-950/60 border border-white/[0.07] px-3 py-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon name={icon} className={`w-3 h-3 ${color}`} strokeWidth={2} />
        <span className="text-[9px] font-black uppercase tracking-wider text-zinc-600">{label}</span>
      </div>
      <p className={`text-xl font-black tracking-tight ${color}`}>{value}</p>
    </div>
  )
}
