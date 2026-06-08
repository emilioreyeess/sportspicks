"use client"

import Link from "next/link"
import { type Pick, type ConfidenceTier } from "@/types"
import { usePlan } from "@/lib/plan"
import { calculateValueMetrics } from "@/lib/engine"

const TIER_CONFIG: Record<ConfidenceTier, {
  barColor: string; label: string; text: string; badge: string; oddBadge: string
}> = {
  SAFE: {
    barColor:     "bg-emerald-400",
    label:        "Premium",
    text:         "text-emerald-400/90",
    badge:        "bg-emerald-400/10 text-emerald-300/90",
    oddBadge:     "bg-emerald-400/10 text-emerald-300",
  },
  HIGH: {
    barColor:     "bg-amber-400",
    label:        "Alto",
    text:         "text-amber-400/90",
    badge:        "bg-amber-400/10 text-amber-300/90",
    oddBadge:     "bg-amber-400/10 text-amber-300",
  },
  MEDIUM: {
    barColor:     "bg-blue-400",
    label:        "Valor",
    text:         "text-blue-400/90",
    badge:        "bg-blue-400/10 text-blue-300/90",
    oddBadge:     "bg-blue-400/10 text-blue-300",
  },
}

const RESULT_STYLE: Record<string, string> = {
  WIN:     "bg-emerald-400/12 text-emerald-300/90",
  LOSS:    "bg-rose-400/12    text-rose-300/90",
  VOID:    "bg-white/[0.05]   text-zinc-400",
  PENDING: "bg-amber-400/10   text-amber-300/90",
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
  const { isPremium } = usePlan()
  const cfg = TIER_CONFIG[pick.confidence_tier]
  const kickoff = new Date(pick.kickoff_utc).toLocaleString("es-ES", {
    weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  })
  const edge    = pick.value_edge != null ? pick.value_edge.toFixed(1) : null
  const quality = pick.quality_score ?? pick.confidence_pct
  // True Odds (cuota justa) + Edge desde el modelo Poisson vs cuota de mercado.
  const metrics = pick.best_odd && pick.model_prob != null
    ? calculateValueMetrics(pick.model_prob, pick.best_odd)
    : null

  return (
    <div
      className={[
        "relative rounded-2xl border border-white/[0.05] bg-zinc-900/40 overflow-hidden",
        "shadow-[0_2px_16px_-8px_rgba(0,0,0,0.4)]",
        "transition-all duration-200",
        onClick ? "cursor-pointer hover:border-white/[0.10] hover:-translate-y-[1px] hover:shadow-[0_10px_32px_-14px_rgba(0,0,0,0.5)] active:scale-[0.99]" : "",
      ].join(" ")}
      onClick={() => onClick?.(pick)}
    >
      {/* Thin accent line at top — tier color */}
      <div className={`absolute top-0 left-0 right-0 h-[1.5px] ${cfg.barColor} opacity-40`} />

      {/* Quality + Risk badges — top right */}
      <div className="absolute top-4 right-4 flex flex-col items-end gap-1.5">
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium ${cfg.badge}`}>
          {cfg.label}
          <span className="text-white/80">{quality}<span className="text-zinc-600 font-normal">/100</span></span>
        </div>
        {pick.risk_tier && (
          <span className={[
            "flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium",
            pick.risk_tier === "low"  ? "bg-emerald-400/10 text-emerald-300/90" :
            pick.risk_tier === "mid"  ? "bg-amber-400/10   text-amber-300/90"   :
                                        "bg-rose-400/10    text-rose-300/90",
          ].join(" ")}>
            {pick.risk_tier === "low" ? "Conservador" : pick.risk_tier === "mid" ? "Medio" : "Alto riesgo"}
          </span>
        )}
      </div>

      <div className="p-5">
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
          <div className="mt-4 rounded-xl bg-white/[0.03] px-4 py-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">{pick.market}</p>
              <p className="text-[14px] font-semibold text-zinc-600 mt-0.5 blur-[5px] select-none">████████ @{(pick.best_odd ?? 0).toFixed(2)}</p>
            </div>
            <Link
              href="/pricing"
              onClick={e => e.stopPropagation()}
              className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-[11px] tap transition-colors"
            >
              🔒 Premium
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-4 flex items-end justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">{pick.market}</p>
                <p className={`text-[15px] font-semibold mt-1 truncate ${cfg.text}`}>{pick.selection}</p>
              </div>
              {pick.best_odd && (
                <div className={`shrink-0 px-3 py-1.5 rounded-lg font-semibold text-[22px] tracking-tight leading-none ${cfg.oddBadge}`}>
                  {pick.best_odd.toFixed(2)}
                </div>
              )}
            </div>

            {(edge || pick.bookmaker) && (
              <div className="flex items-center gap-2 mt-3 text-[11px]">
                {edge && <span className="font-semibold text-emerald-400/90">edge +{edge}%</span>}
                {edge && pick.bookmaker && <span className="text-zinc-700">·</span>}
                {pick.bookmaker && <span className="text-zinc-600 font-medium">{pick.bookmaker}</span>}
                {pick.result !== "PENDING" && (
                  <span className={`ml-auto px-2 py-0.5 rounded-full text-[10px] font-medium ${RESULT_STYLE[pick.result]}`}>
                    {RESULT_LABEL[pick.result]}
                  </span>
                )}
              </div>
            )}

            {/* True Odds (cuota justa) + Edge — soft-paywall premium */}
            {metrics && metrics.trueOdds > 0 && (
              isPremium ? (
                <div className="mt-3 flex items-center gap-2.5 rounded-lg border border-emerald-700/25 bg-emerald-500/[0.06] px-3 py-2 text-[11px]">
                  <span className="text-zinc-400">Cuota justa <b className="text-white tabular-nums">@{metrics.trueOdds.toFixed(2)}</b></span>
                  <span className="text-zinc-700">·</span>
                  <span className={metrics.isValue ? "font-bold text-emerald-400" : "text-zinc-500"}>
                    {metrics.edge > 0 ? `Edge +${metrics.edge}%` : "Sin valor"}
                  </span>
                </div>
              ) : (
                <Link href="/pricing" onClick={(e) => e.stopPropagation()}
                  className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2">
                  <span className="text-[11px] text-zinc-500">
                    Cuota justa + Edge{" "}
                    <span className="blur-[5px] select-none tabular-nums">@1.90 · +6.2%</span>
                  </span>
                  <span className="text-[10px] font-bold text-emerald-400 shrink-0">🔒 Premium</span>
                </Link>
              )
            )}

            {pick.value_reason && (
              <p className="mt-3.5 text-[12px] text-zinc-500 leading-relaxed border-l border-white/[0.08] pl-3">
                {pick.value_reason}
              </p>
            )}
          </>
        )}

        {/* Quality bar */}
        <div className="mt-4 h-[3px] rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className={`h-full rounded-full ${cfg.barColor} opacity-70 transition-all duration-500`}
            style={{ width: `${quality}%` }}
          />
        </div>
      </div>
    </div>
  )
}
