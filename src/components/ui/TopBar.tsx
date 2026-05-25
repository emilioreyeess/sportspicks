"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { Icon } from "@/components/ui/icons"
import { NAV_MAIN, NAV_MORE, isActive } from "@/components/ui/nav-items"
import { usePlan } from "@/lib/plan"
import { PLANS } from "@/lib/plans"
import { PremiumBadge } from "@/components/premium"

export function TopBar() {
  const path = usePathname()
  const { plan } = usePlan()
  const [open, setOpen] = useState(false)

  useEffect(() => { setOpen(false) }, [path])

  return (
    <>
      <header className="lg:hidden sticky top-0 z-40 glass-dark border-b border-zinc-800/50 safe-top">
        <div className="flex items-center justify-between h-14 px-4">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="grid place-items-center w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/25 to-cyan-500/15 border border-emerald-600/40 text-emerald-400 group-hover:border-emerald-500/60 transition-all">
              <Icon name="value" className="w-[18px] h-[18px]" strokeWidth={2} />
            </span>
            <span className="text-sm font-black tracking-tight text-white">SportsPicks</span>
          </Link>
          <div className="flex items-center gap-2">
            {plan === "free" ? (
              <Link href="/pricing"
                className="flex items-center gap-1 rounded-full border border-emerald-700/50 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-black text-emerald-400 tap hover:bg-emerald-500/15 hover:border-emerald-600/60 transition-all">
                <Icon name="crown" className="w-3.5 h-3.5" strokeWidth={2.2} /> Premium
              </Link>
            ) : (
              <Link href="/account" className="tap">
                <PremiumBadge plan={plan} />
              </Link>
            )}
            <button onClick={() => setOpen(true)} aria-label="Menú"
              className="grid place-items-center w-9 h-9 rounded-lg text-zinc-300 hover:bg-zinc-800/70 hover:text-white transition-colors tap">
              <Icon name="menu" className="w-5 h-5" strokeWidth={2} />
            </button>
          </div>
        </div>
      </header>

      {/* Drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm animate-fade-in" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 right-0 w-[82%] max-w-xs flex flex-col animate-scale-in safe-top safe-bottom"
            style={{ background: "rgba(9,9,11,0.97)", backdropFilter: "blur(24px)", borderLeft: "1px solid rgba(39,39,42,0.8)" }}>

            {/* Ambient glow inside drawer */}
            <div className="pointer-events-none absolute top-0 right-0 w-40 h-48 overflow-hidden">
              <div className="absolute -top-8 -right-8 w-40 h-40 bg-emerald-500/8 rounded-full blur-3xl" />
            </div>

            {/* Drawer header */}
            <div className="relative flex items-center justify-between h-14 px-4 border-b border-zinc-800/60">
              <div className="flex items-center gap-2">
                <span className="grid place-items-center w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500/20 to-cyan-500/10 border border-emerald-700/40 text-emerald-400">
                  <Icon name="value" className="w-4 h-4" strokeWidth={2} />
                </span>
                <span className="text-sm font-black text-white">SportsPicks</span>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Cerrar"
                className="grid place-items-center w-9 h-9 rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors tap">
                <Icon name="close" className="w-5 h-5" strokeWidth={2} />
              </button>
            </div>

            <nav className="relative flex-1 overflow-y-auto p-2.5 space-y-0.5 pt-3">
              <p className="px-3 pb-2 text-[10px] font-black uppercase tracking-widest text-zinc-600">Plataforma</p>
              {NAV_MAIN.map((item) => {
                const active = isActive(path, item.href)
                return (
                  <Link key={item.href} href={item.href}
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition-all duration-200 ${
                      active
                        ? "nav-active-pill text-emerald-300 font-black"
                        : "text-zinc-300 hover:bg-zinc-800/60 hover:text-white font-medium"
                    }`}>
                    <Icon
                      name={item.icon}
                      className={`w-5 h-5 transition-all ${
                        active ? "text-emerald-400 drop-shadow-[0_0_5px_rgba(52,211,153,0.6)]" : "text-zinc-500"
                      }`}
                      strokeWidth={active ? 2.2 : 1.8}
                    />
                    <span className="flex-1">{item.label}</span>
                    {active && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />}
                  </Link>
                )
              })}
              <p className="px-3 pt-4 pb-2 text-[10px] font-black uppercase tracking-widest text-zinc-600">Más</p>
              {NAV_MORE.map((item) => {
                const active = isActive(path, item.href)
                return (
                  <Link key={item.href} href={item.href}
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition-all duration-200 ${
                      active
                        ? "nav-active-pill text-emerald-300 font-black"
                        : "text-zinc-400 hover:bg-zinc-800/60 hover:text-white font-medium"
                    }`}>
                    <Icon name={item.icon} className={`w-5 h-5 ${active ? "text-emerald-400" : "text-zinc-500"}`} strokeWidth={active ? 2.2 : 1.8} />
                    {item.label}
                  </Link>
                )
              })}
            </nav>

            {/* Plan footer */}
            <div className="relative p-3 border-t border-zinc-800/60">
              <Link href={plan === "free" ? "/pricing" : "/account"}
                className={`relative overflow-hidden flex items-center justify-between rounded-xl border px-4 py-3 tap transition-all ${
                  plan === "free"
                    ? "border-emerald-800/60 bg-emerald-500/5 hover:border-emerald-700/60"
                    : plan === "pro"
                      ? "border-violet-800/60 bg-violet-500/5"
                      : "border-zinc-800 bg-zinc-900/60"
                }`}>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Tu plan</p>
                  <p className={`text-sm font-black mt-0.5 ${
                    plan === "free" ? "text-zinc-300" : plan === "pro" ? "text-violet-400" : "text-emerald-400"
                  }`}>{PLANS[plan].name}</p>
                </div>
                {plan === "free"
                  ? <span className="text-xs font-black text-emerald-400">Mejorar →</span>
                  : <Icon name="settings" className="w-4.5 h-4.5 text-zinc-500" />}
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
