"use client"

import Link from "next/link"
import { type Pick, type ConfidenceTier } from "@/types"

const TIER_CONFIG: Record<ConfidenceTier, {
  barColor: string; label: string; text: string; badge: string; oddBadge: string
}> = {
  SAFE:   {
    barColor: "bg-emerald-500",
    label: "PREMIUM",
    text: "text-emerald-400",
    badge: "bg-emerald-500/15 border-emerald-700/60 text-emerald-300",
    oddBadge: "bg-emerald-500/15 border-emerald-600/50 text-emerald-300",
  },
  HIGH:   {
    barColor: "bg-amber-400",
    label: "ALTO",
    text: "text-amber-400",
    badge: "bg-amber-500/15 border-amber-700/60 text-amber-300",
    oddBadge: "bg-amber-500/15 border-amber-600/50 text-amber-300",
  },
  MEDIUM: {
    barColor: "bg-blue-400",
    label: "VALOR",
    text: "text-blue-400",
    badge: "bg-blue-500/15 border-blue-700/60 text-blue-300",
    oddBadge: "bg-blue-500/15 border-blue-600/50 text-blue-300",
  },
}

const RESULT_STYLE: Record<string, string> = {
  WIN:     "bg-emerald-500 text-white",
  LOSS:    "bg-rose-600 text-white",
  VOID:    "bg-zinc-700 text-zinc-300",
  PENDING: "bg-amber-500/20 border border-amber-700/50 text-amber-400",
}
const RESULT_LABEL: Record<string, string> = {
  WIN: "✓ Ganó", LOSS: "✗ Falló", VOID: "— Void", PENDING: "⏳ Hoy",
}

interface Props {
  pick: Pick
  onClick?: (pick: Pick) => void
  locked?: boolean
}

export function PickCard({ pick, onClick, locked = false }: Props) {
  const cfg = TIER_CONFIG[pick.confidence_tier]
  const kickoff = new Date(pick.kickoff_utc).toLocaleString("es-ES", {
    weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  })
  const edge = pick.value_edge != null ? pick.value_edge.toFixed(1) : null
  const quality = pick.quality_score ?? pick.confidence_pct

  return (
    <div
      className={`relative rounded-2xl border border-zinc-800/80 card-premium overflow-hidden transition-all duration-200
        cursor-pointer hover:border-zinc-700/80 hover:shadow-2xl hover:shadow-black/40 ${onClick ? "active:scale-[0.98]" : ""}`}
      onClick={() => onClick?.(pick)}
    >
      {/* Subtle top accent line */}
      <div className={`absolute top-0 left-0 right-0 h-[2px] ${cfg.barColor} opacity-60`} />

      {/* Quality + Risk badges — top right */}
      <div className="absolute top-3.5 right-3.5 flex flex-col items-end gap-1.5">
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-black ${cfg.badge}`}>
          {cfg.label}
          <span className="text-white ml-0.5">{quality}<span className="text-zinc-500 font-bold">/100</span></span>
        </div>
        {pick.risk_tier && (
          <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide border ${
            pick.risk_tier === "low"
              ? "bg-emerald-500/12 text-emerald-300 border-emerald-700/40"
              : pick.risk_tier === "mid"
                ? "bg-amber-500/12 text-amber-300 border-amber-700/40"
                : "bg-rose-500/12 text-rose-300 border-rose-700/40"
          }`}>
            {pick.risk_tier === "low" ? "🟢 Conservador" : pick.risk_tier === "mid" ? "🟡 Medio" : "🔴 Alto riesgo"}
          </span>
        )}
      </div>

      <div className="p-4 pt-5">
        {/* League + time */}
        <div className="pr-28">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-0.5">
            {pick.league_name} · {kickoff}
          </p>
          <p className="text-sm font-black text-white leading-snug">
            {pick.home_team} <span className="text-zinc-600 font-medium">vs</span> {pick.away_team}
          </p>
        </div>

        {/* Pick row — locked or visible */}
        {locked ? (
          <div className="mt-3.5 rounded-xl border border-zinc-700/50 bg-zinc-900/60 px-4 py-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">{pick.market}</p>
              <p className="text-sm font-black text-zinc-600 mt-0.5 blur-[5px] select-none">████████ @{(pick.best_odd ?? 0).toFixed(2)}</p>
            </div>
            <Link
              href="/pricing"
              onClick={e => e.stopPropagation()}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-zinc-950 font-black text-[11px] tap"
            >
              🔒 Premium
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-3.5 flex items-end justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">{pick.market}</p>
                <p className={`text-base font-black mt-0.5 truncate ${cfg.text}`}>{pick.selection}</p>
              </div>
              {pick.best_odd && (
                <div className={`shrink-0 px-3 py-1.5 rounded-xl border font-black text-2xl tracking-tight leading-none ${cfg.oddBadge}`}>
                  {pick.best_odd.toFixed(2)}
                </div>
              )}
            </div>

            {(edge || pick.bookmaker) && (
              <div className="flex items-center gap-2.5 mt-2.5 text-[11px]">
                {edge && <span className="font-black text-emerald-400">edge +{edge}%</span>}
                {edge && pick.bookmaker && <span className="text-zinc-700">·</span>}
                {pick.bookmaker && <span className="text-zinc-600 font-medium">{pick.bookmaker}</span>}
                {pick.result !== "PENDING" && (
                  <span className={`ml-auto px-2 py-0.5 rounded-full text-[10px] font-black ${RESULT_STYLE[pick.result]}`}>
                    {RESULT_LABEL[pick.result]}
                  </span>
                )}
              </div>
            )}

            {pick.value_reason && (
              <p className="mt-3 text-xs text-zinc-500 leading-snug border-l-2 border-zinc-700/80 pl-2.5 italic">
                {pick.value_reason}
              </p>
            )}
          </>
        )}

        {/* Quality bar */}
        <div className="mt-3.5 h-1 rounded-full bg-zinc-800/80 overflow-hidden">
          <div
            className={`h-full rounded-full ${cfg.barColor} transition-all duration-500`}
            style={{ width: `${quality}%` }}
          />
        </div>
      </div>
    </div>
  )
}
