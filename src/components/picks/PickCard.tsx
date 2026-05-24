"use client"

import { type Pick, type ConfidenceTier } from "@/types"

const TIER_CONFIG: Record<ConfidenceTier, { color: string; label: string; text: string; bg: string }> = {
  SAFE:   { color: "bg-emerald-500", label: "PREMIUM", text: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-700" },
  HIGH:   { color: "bg-amber-400",   label: "ALTO",    text: "text-amber-400",   bg: "bg-amber-500/10 border-amber-700" },
  MEDIUM: { color: "bg-blue-400",    label: "VALOR",   text: "text-blue-400",    bg: "bg-blue-500/10 border-blue-700" },
}

const RESULT_COLOR: Record<string, string> = {
  WIN: "text-emerald-400", LOSS: "text-red-400", VOID: "text-zinc-400", PENDING: "text-zinc-300",
}

interface Props {
  pick: Pick
  onClick?: (pick: Pick) => void
}

export function PickCard({ pick, onClick }: Props) {
  const cfg = TIER_CONFIG[pick.confidence_tier]
  const kickoff = new Date(pick.kickoff_utc).toLocaleString("es-ES", {
    weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  })
  const edge = pick.value_edge != null ? pick.value_edge.toFixed(1) : null
  const quality = pick.quality_score ?? pick.confidence_pct

  return (
    <div
      className={`relative rounded-2xl bg-zinc-900 border border-zinc-800 p-4
        cursor-pointer hover:border-zinc-600 transition-all ${onClick ? "active:scale-[0.98]" : ""}`}
      onClick={() => onClick?.(pick)}
    >
      {/* Quality + Risk badges */}
      <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${cfg.bg}`}>
          <span className={`text-[10px] font-black ${cfg.text}`}>{cfg.label}</span>
          <span className="text-[10px] font-bold text-white">{quality}<span className="text-zinc-500">/100</span></span>
        </div>
        {pick.risk_tier && (
          <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide border ${
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

      {/* Match info */}
      <div className="pr-28">
        <p className="text-[11px] text-zinc-500 uppercase tracking-wider mb-0.5">
          {pick.league_name} · {kickoff}
        </p>
        <p className="text-sm font-semibold text-white leading-snug">
          {pick.home_team} <span className="text-zinc-500">vs</span> {pick.away_team}
        </p>
      </div>

      {/* Pick */}
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] text-zinc-500 uppercase tracking-wide">{pick.market}</p>
          <p className="text-base font-bold text-white truncate">{pick.selection}</p>
        </div>
        <div className="text-right shrink-0">
          {pick.best_odd && (
            <p className="text-xl font-black text-white leading-none">{pick.best_odd.toFixed(2)}</p>
          )}
          {edge && (
            <p className="text-[11px] text-emerald-400 font-bold mt-0.5">edge +{edge}%</p>
          )}
          {pick.bookmaker && (
            <p className="text-[10px] text-zinc-600">{pick.bookmaker}</p>
          )}
        </div>
      </div>

      {/* Value reason — the sharp differentiator */}
      {pick.value_reason && (
        <p className="mt-3 text-xs text-zinc-400 leading-snug border-l-2 border-zinc-700 pl-2.5">
          {pick.value_reason}
        </p>
      )}

      {/* Result indicator */}
      {pick.result !== "PENDING" && (
        <div className={`mt-2 text-xs font-bold ${RESULT_COLOR[pick.result]}`}>{pick.result}</div>
      )}

      {/* Quality bar */}
      <div className="mt-3 h-1 rounded-full bg-zinc-800 overflow-hidden">
        <div className={`h-full rounded-full ${cfg.color} transition-all`} style={{ width: `${quality}%` }} />
      </div>
    </div>
  )
}
