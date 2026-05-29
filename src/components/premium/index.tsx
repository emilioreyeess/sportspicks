"use client"

import Link from "next/link"
import { useState, type ReactNode } from "react"
import { usePlan } from "@/lib/plan"
import { PLANS, minPlanFor, type Feature, type PlanId } from "@/lib/plans"
import { Icon } from "@/components/ui/icons"
import { cx } from "@/components/ui/primitives"

/* ─── Premium badge ───────────────────────────────────────────────────────── */
export function PremiumBadge({ plan, className }: { plan: PlanId; className?: string }) {
  if (plan === "free") return null
  const isPro = plan === "pro"
  return (
    <span className={cx(
      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide",
      isPro
        ? "bg-violet-500/15 text-violet-300 border border-violet-700/50"
        : "bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-emerald-300 border border-emerald-700/50",
      className,
    )}>
      <Icon name="crown" className="w-3 h-3" strokeWidth={2.2} />
      {isPro ? "Pro" : "Premium"}
    </span>
  )
}

/* ─── Upgrade modal ───────────────────────────────────────────────────────── */
export function UpgradeModal({ open, onClose, feature }: {
  open: boolean; onClose: () => void; feature?: Feature
}) {
  if (!open) return null
  const target: PlanId = feature ? minPlanFor(feature) : "premium"
  const plan = PLANS[target]
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm safe-bottom"
      onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full sm:w-[420px] bg-zinc-900/95 border border-white/[0.07] rounded-t-3xl sm:rounded-2xl p-6 animate-slide-up sm:animate-scale-in backdrop-blur-xl">
        <div className="flex justify-center mb-4">
          <span className="grid place-items-center w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-700/50 text-emerald-400">
            <Icon name="crown" className="w-7 h-7" strokeWidth={2} />
          </span>
        </div>
        <h3 className="text-lg font-black text-white text-center">Función {plan.name}</h3>
        <p className="text-sm text-zinc-400 text-center mt-1.5 leading-snug">
          Desbloquea esta función y todo el motor cuantitativo con el plan {plan.name}.
        </p>
        <ul className="mt-4 space-y-2">
          {plan.perks.slice(0, 4).map((p) => (
            <li key={p} className="flex items-start gap-2 text-sm text-zinc-300">
              <Icon name="check" className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" strokeWidth={2.4} />
              {p}
            </li>
          ))}
        </ul>
        <div className="mt-5 space-y-2">
          <Link href="/pricing" onClick={onClose}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-zinc-950 font-bold text-sm tap">
            Ver planes — desde {plan.priceMonthly}€{plan.period}
            <Icon name="arrowRight" className="w-4 h-4" strokeWidth={2.4} />
          </Link>
          <button onClick={onClose}
            className="w-full py-2.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
            Ahora no
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Locked section (blur + paywall) ─────────────────────────────────────── */
export function LockedSection({ feature, title, hint, children }: {
  feature: Feature; title?: string; hint?: string; children: ReactNode
}) {
  const { can, ready } = usePlan()
  if (!ready || can(feature)) return <>{children}</>

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <div className="pointer-events-none select-none blur-[6px] opacity-50 max-h-[420px] overflow-hidden">
        {children}
      </div>
      <div className="absolute inset-0 grid place-items-center bg-gradient-to-b from-zinc-950/40 to-zinc-950/90 p-6">
        <div className="text-center max-w-xs">
          <span className="grid place-items-center w-12 h-12 mx-auto rounded-2xl bg-zinc-800/60 border border-white/[0.07] text-emerald-400 mb-3">
            <Icon name="lock" className="w-5.5 h-5.5" />
          </span>
          <p className="text-white font-bold">{title ?? "Contenido Premium"}</p>
          <p className="text-xs text-zinc-400 mt-1 leading-snug">
            {hint ?? "Desbloquea el análisis completo con un plan superior."}
          </p>
          <Link href="/pricing"
            className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-zinc-950 font-bold text-xs tap">
            <Icon name="crown" className="w-3.5 h-3.5" strokeWidth={2.2} />
            Desbloquear
          </Link>
        </div>
      </div>
    </div>
  )
}

/* ─── Inline upgrade banner ───────────────────────────────────────────────── */
export function UpgradeBanner({ text, cta = "Mejorar plan" }: { text: string; cta?: string }) {
  const { isPremium } = usePlan()
  if (isPremium) return null
  return (
    <Link href="/pricing"
      className="flex items-center gap-3 rounded-xl border border-emerald-800/50 bg-gradient-to-r from-emerald-500/10 to-cyan-500/5 px-4 py-3 tap">
      <span className="grid place-items-center w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 shrink-0">
        <Icon name="crown" className="w-4.5 h-4.5" />
      </span>
      <p className="text-sm text-zinc-300 flex-1 leading-snug">{text}</p>
      <span className="text-xs font-bold text-emerald-400 shrink-0 flex items-center gap-1">
        {cta} <Icon name="arrowRight" className="w-3.5 h-3.5" strokeWidth={2.4} />
      </span>
    </Link>
  )
}

/* ─── Hook: upgrade modal controller ──────────────────────────────────────── */
export function useUpgradeModal() {
  const [open, setOpen] = useState(false)
  const [feature, setFeature] = useState<Feature | undefined>()
  return {
    open,
    feature,
    show: (f?: Feature) => { setFeature(f); setOpen(true) },
    close: () => setOpen(false),
    Modal: () => <UpgradeModal open={open} onClose={() => setOpen(false)} feature={feature} />,
  }
}
