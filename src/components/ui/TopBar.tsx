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
      <header className="lg:hidden sticky top-0 z-40 glass border-b border-zinc-800/80 safe-top">
        <div className="flex items-center justify-between h-14 px-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid place-items-center w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-cyan-500/10 border border-emerald-700/40 text-emerald-400">
              <Icon name="value" className="w-[18px] h-[18px]" strokeWidth={2} />
            </span>
            <span className="text-sm font-black tracking-tight text-white">SportsPicks</span>
          </Link>
          <div className="flex items-center gap-2">
            {plan === "free" ? (
              <Link href="/pricing"
                className="flex items-center gap-1 rounded-full border border-emerald-700/50 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-400 tap hover:bg-emerald-500/15 transition-colors">
                <Icon name="crown" className="w-3.5 h-3.5" strokeWidth={2.2} /> Premium
              </Link>
            ) : (
              <Link href="/account" className="tap">
                <PremiumBadge plan={plan} />
              </Link>
            )}
            <button onClick={() => setOpen(true)} aria-label="Menú"
              className="grid place-items-center w-9 h-9 rounded-lg text-zinc-300 hover:bg-zinc-800 tap">
              <Icon name="menu" className="w-5 h-5" strokeWidth={2} />
            </button>
          </div>
        </div>
      </header>

      {/* Drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/70 animate-fade-in" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 right-0 w-[82%] max-w-xs bg-zinc-950 border-l border-zinc-800 flex flex-col animate-slide-up safe-top safe-bottom">
            <div className="flex items-center justify-between h-14 px-4 border-b border-zinc-800">
              <span className="text-sm font-black text-white">Menú</span>
              <button onClick={() => setOpen(false)} aria-label="Cerrar"
                className="grid place-items-center w-9 h-9 rounded-lg text-zinc-400 hover:bg-zinc-800 tap">
                <Icon name="close" className="w-5 h-5" strokeWidth={2} />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
              {[...NAV_MAIN, ...NAV_MORE].map((item) => {
                const active = isActive(path, item.href)
                return (
                  <Link key={item.href} href={item.href}
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors ${
                      active ? "bg-emerald-500/12 text-emerald-400" : "text-zinc-300 hover:bg-zinc-800/70"
                    }`}>
                    <Icon name={item.icon} className="w-5 h-5" strokeWidth={active ? 2.1 : 1.8} />
                    {item.label}
                  </Link>
                )
              })}
            </nav>

            <div className="p-3 border-t border-zinc-800">
              <Link href={plan === "free" ? "/pricing" : "/account"}
                className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 tap">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Tu plan</p>
                  <p className={`text-sm font-black ${
                    plan === "free" ? "text-zinc-300" : plan === "pro" ? "text-violet-400" : "text-emerald-400"
                  }`}>{PLANS[plan].name}</p>
                </div>
                {plan === "free"
                  ? <span className="text-xs font-bold text-emerald-400">Mejorar →</span>
                  : <Icon name="settings" className="w-4.5 h-4.5 text-zinc-500" />}
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
