"use client"

import Link from "next/link"
import { type Pick, type ConfidenceTier } from "@/types"

const TIER_CONFIG: Record<ConfidenceTier, {
  barColor: string; accentBorder: string; label: string; text: string; badge: string; oddBadge: string
}> = {
  SAFE: {
    barColor:     "bg-emerald-500",
    accentBorder: "border-l-2 border-emerald-500/50",
    label:        "Premium",
    text:         "text-emerald-400",
    badge:        "bg-emerald-500/10 border-emerald-700/45 text-emerald-300",
    oddBadge:     "bg-emerald-500/10 border-emerald-600/40 text-emerald-300",
  },
  HIGH: {
    barColor:     "bg-amber-400",
    accentBorder: "border-l-2 border-amber-500/50",
    label:        "Alto",
    text:         "text-amber-400",
    badge:        "bg-amber-500/10 border-amber-700/45 text-amber-300",
    oddBadge:     "bg-amber-500/10 border-amber-600/40 text-amber-300",
  },
  MEDIUM: {
    barColor:     "bg-blue-400",
    accentBorder: "border-l-2 border-blue-500/50",
    label:        "Valor",
    text:         "text-blue-400",
    badge:        "bg-blue-500/10 border-blue-700/45 text-blue-300",
    oddBadge:     "bg-blue-500/10 border-blue-600/40 text-blue-300",
  },
}

const RESULT_STYLE: Record<string, string> = {
  WIN:     "bg-emerald-500/15 border border-emerald-700/45 text-emerald-300",
  LOSS:    "bg-rose-500/15    border border-rose-700/45    text-rose-300",
  VOID:    "bg-zinc-800/80    border border-white/[0.07]   text-zinc-400",
  PENDING: "bg-amber-500/10  border border-amber-700/40   text-amber-400",
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
  const edge    = pick.value_edge != null ? pick.value_edge.toFixed(1) : null
  const quality = pick.quality_score ?? pick.confidence_pct

  return (
    <div
      className={[
        "relative rounded-2xl border border-white/[0.07] bg-zinc-900/72 overflow-hidden",
        "shadow-[0_2px_12px_rgba(0,0,0,0.28),inset_0_0.5px_0_rgba(255,255,255,0.05)]",
        "transition-all duration-200",
        onClick ? "cursor-pointer hover:border-white/[0.12] hover:-translate-y-[1px] hover:shadow-[0_6px_28px_rgba(0,0,0,0.38)] active:scale-[0.99]" : "",
      ].join(" ")}
      onClick={() => onClick?.(pick)}
    >
      {/* Thin accent line at top — tier color */}
      <div className={`absolute top-0 left-0 right-0 h-[1.5px] ${cfg.barColor} opacity-55`} />

      {/* Quality + Risk badges — top right */}
      <div className="absolute top-3.5 right-3.5 flex flex-col items-end gap-1.5">
        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-[7px] border text-[10px] font-semibold ${cfg.badge}`}>
          {cfg.label}
          <span className="text-white/80">{quality}<span className="text-zinc-600 font-normal">/100</span></span>
        </div>
        {pick.risk_tier && (
          <span className={[
            "flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold border",
            pick.risk_tier === "low"  ? "bg-emerald-500/10 text-emerald-300 border-emerald-700/38" :
            pick.risk_tier === "mid"  ? "bg-amber-500/10   text-amber-300   border-amber-700/38"   :
                                        "bg-rose-500/10    text-rose-300    border-rose-700/38",
          ].join(" ")}>
            {pick.risk_tier === "low" ? "Conservador" : pick.risk_tier === "mid" ? "Medio" : "Alto riesgo"}
          </span>
        )}
      </div>

      <div className="p-4 pt-4.5">
        {/* League + time */}
        <div className="pr-28">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 mb-0.5">
            {pick.league_name} · {kickoff}
          </p>
          <p className="text-[14px] font-bold text-white leading-snug">
            {pick.home_team} <span className="text-zinc-600 font-normal">vs</span> {pick.away_team}
          </p>
        </div>

        {/* Pick row — locked or visible */}
        {locked ? (
          <div className="mt-3.5 rounded-[11px] border border-white/[0.06] bg-zinc-800/50 px-4 py-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">{pick.market}</p>
              <p className="text-[14px] font-bold text-zinc-600 mt-0.5 blur-[5px] select-none">████████ @{(pick.best_odd ?? 0).toFixed(2)}</p>
            </div>
            <Link
              href="/pricing"
              onClick={e => e.stopPropagation()}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-gradient-to-r from-emerald-500 to-cyan-500 text-zinc-950 font-semibold text-[11px] tap"
            >
              🔒 Premium
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-3.5 flex items-end justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">{pick.market}</p>
                <p className={`text-[15px] font-bold mt-0.5 truncate ${cfg.text}`}>{pick.selection}</p>
              </div>
              {pick.best_odd && (
                <div className={`shrink-0 px-3 py-1.5 rounded-[10px] border font-bold text-[22px] tracking-tight leading-none ${cfg.oddBadge}`}>
                  {pick.best_odd.toFixed(2)}
                </div>
              )}
            </div>

            {(edge || pick.bookmaker) && (
              <div className="flex items-center gap-2 mt-2.5 text-[11px]">
                {edge && <span className="font-bold text-emerald-400">edge +{edge}%</span>}
                {edge && pick.bookmaker && <span className="text-zinc-700">·</span>}
                {pick.bookmaker && <span className="text-zinc-600 font-medium">{pick.bookmaker}</span>}
                {pick.result !== "PENDING" && (
                  <span className={`ml-auto px-2 py-0.5 rounded-full text-[10px] font-semibold ${RESULT_STYLE[pick.result]}`}>
                    {RESULT_LABEL[pick.result]}
                  </span>
                )}
              </div>
            )}

            {pick.value_reason && (
              <p className="mt-3 text-[12px] text-zinc-500 leading-relaxed border-l-2 border-white/[0.07] pl-2.5">
                {pick.value_reason}
              </p>
            )}
          </>
        )}

        {/* Quality bar */}
        <div className="mt-3.5 h-[3px] rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className={`h-full rounded-full ${cfg.barColor} opacity-70 transition-all duration-500`}
            style={{ width: `${quality}%` }}
          />
        </div>
      </div>
    </div>
  )
}
