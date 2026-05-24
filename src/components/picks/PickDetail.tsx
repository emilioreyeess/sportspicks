"use client"

import { type Pick } from "@/types"

const TIER_COLOR: Record<string, string> = {
  SAFE:   "text-emerald-400",
  HIGH:   "text-amber-400",
  MEDIUM: "text-blue-400",
}

interface Props {
  pick: Pick
  onClose: () => void
}

export function PickDetail({ pick, onClose }: Props) {
  const tier = TIER_COLOR[pick.confidence_tier] ?? "text-white"

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}>
      <div
        className="w-full sm:w-[520px] bg-zinc-900 border border-zinc-700 rounded-t-3xl sm:rounded-2xl p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider">{pick.league_name}</p>
            <h2 className="text-lg font-bold text-white mt-0.5">
              {pick.home_team} vs {pick.away_team}
            </h2>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-2xl leading-none">×</button>
        </div>

        {/* Pick summary */}
        <div className="flex items-center justify-between bg-zinc-800 rounded-xl p-4">
          <div className="min-w-0">
            <p className="text-xs text-zinc-400 uppercase">{pick.market}</p>
            <p className="text-xl font-bold text-white mt-0.5">{pick.selection}</p>
            {pick.risk_tier && (
              <span className={`mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide border ${
                pick.risk_tier === "low"
                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-700/50"
                  : pick.risk_tier === "mid"
                    ? "bg-amber-500/15 text-amber-300 border-amber-700/50"
                    : "bg-rose-500/15 text-rose-300 border-rose-700/50"
              }`}>
                {pick.risk_tier === "low" ? "🟢 Conservador" : pick.risk_tier === "mid" ? "🟡 Riesgo medio" : "🔴 Alto riesgo"}
              </span>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className={`text-2xl font-black ${tier}`}>{pick.confidence_pct}%</p>
            <p className="text-xs text-zinc-500">{pick.confidence_tier}</p>
          </div>
        </div>

        {/* Value reason highlight */}
        {pick.value_reason && (
          <div className="bg-emerald-500/10 border border-emerald-800 rounded-xl p-3">
            <p className="text-[10px] text-emerald-500 uppercase tracking-wider font-bold mb-1">Por qué hay valor</p>
            <p className="text-sm text-zinc-200 leading-snug">{pick.value_reason}</p>
          </div>
        )}

        {/* Odds & Value */}
        {pick.best_odd && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <Stat label="Cuota real" value={pick.best_odd.toFixed(2)} sub={pick.bookmaker ?? ""} />
            <Stat label="Prob. modelo" value={`${pick.model_prob.toFixed(1)}%`} />
            {pick.value_edge != null && (
              <Stat label="Edge real" value={`+${pick.value_edge.toFixed(1)}%`} positive={pick.value_edge > 0} />
            )}
            {pick.quality_score != null && (
              <Stat label="Calidad" value={`${pick.quality_score}/100`} />
            )}
          </div>
        )}

        {/* Reasons */}
        <div>
          <h3 className="text-sm font-semibold text-zinc-300 mb-2">Análisis estadístico (datos reales)</h3>
          <ul className="space-y-1.5">
            {pick.reasons.map((r, i) => (
              <li key={i} className="flex gap-2 text-sm text-zinc-400">
                <span className="text-emerald-500 mt-0.5">·</span>
                {r}
              </li>
            ))}
          </ul>
        </div>

        {/* Model probability bar */}
        <div>
          <div className="flex justify-between text-xs text-zinc-500 mb-1">
            <span>Probabilidad del modelo</span>
            <span className={tier}>{pick.confidence_pct}%</span>
          </div>
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 via-amber-400 to-emerald-400 transition-all"
              style={{ width: `${pick.confidence_pct}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-zinc-700 mt-1">
            <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
          </div>
        </div>

        {/* CTA */}
        {pick.bookmaker && (
          <p className="text-xs text-zinc-600 text-center">
            Cuota disponible en {pick.bookmaker} · siempre apuesta con responsabilidad
          </p>
        )}
      </div>
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
