"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { Icon } from "@/components/ui/icons"
import { NAV_MAIN, NAV_MORE, isActive } from "@/components/ui/nav-items"
import { usePlan } from "@/lib/plan"
import { PLANS } from "@/lib/plans"

export function Sidebar() {
  const path = usePathname()
  const { plan } = usePlan()
  const planDef = PLANS[plan]
  const [picksCount, setPicksCount] = useState<number | null>(null)

  useEffect(() => {
    fetch("/api/picks")
      .then(r => r.json())
      .then(d => setPicksCount(d.total ?? null))
      .catch(() => {})
  }, [])

  return (
    <aside className="hidden lg:flex flex-col w-60 shrink-0 border-r border-zinc-800/80 bg-zinc-950 sticky top-0 h-screen">
      {/* Brand */}
      <Link href="/" className="flex items-center gap-2.5 px-5 h-16 border-b border-zinc-800/80 group">
        <span className="grid place-items-center w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/10 border border-emerald-700/40 text-emerald-400 group-hover:border-emerald-600/60 transition-colors">
          <Icon name="value" className="w-5 h-5" strokeWidth={2} />
        </span>
        <div>
          <p className="text-sm font-black text-white tracking-tight leading-none">SportsPicks</p>
          <p className="text-[10px] text-emerald-500/90 font-medium mt-0.5">Analytics Engine</p>
        </div>
      </Link>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-600">Plataforma</p>
        {NAV_MAIN.map((item) => (
          <SideLink
            key={item.href}
            item={item}
            active={isActive(path, item.href)}
            badge={item.href === "/value" && picksCount && picksCount > 0 ? String(picksCount) : undefined}
          />
        ))}
        <p className="px-3 pt-5 pb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-600">Más</p>
        {NAV_MORE.map((item) => (
          <SideLink key={item.href} item={item} active={isActive(path, item.href)} />
        ))}
      </nav>

      {/* Plan card */}
      <div className="p-3 border-t border-zinc-800/80">
        <Link href={plan === "free" ? "/pricing" : "/account"}
          className={`block rounded-xl border bg-zinc-900 p-3 tap hover:border-zinc-700 transition-colors ${
            plan !== "free" ? "border-zinc-800" : "border-emerald-900/60 hover:border-emerald-800/60"
          }`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Tu plan</span>
            <span className={`text-[10px] font-black uppercase ${
              plan === "free" ? "text-zinc-400" : plan === "pro" ? "text-violet-400" : "text-emerald-400"
            }`}>{planDef.name}</span>
          </div>
          {plan === "free" ? (
            <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-emerald-400">
              <Icon name="crown" className="w-3.5 h-3.5" strokeWidth={2.2} />
              Mejorar a Premium · desde 9.99€
            </div>
          ) : (
            <p className="mt-1.5 text-xs text-zinc-500">Gestionar suscripción</p>
          )}
        </Link>
      </div>
    </aside>
  )
}

function SideLink({
  item, active, badge,
}: {
  item: { href: string; label: string; icon: string }
  active: boolean
  badge?: string
}) {
  return (
    <Link href={item.href}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
        active
          ? "bg-emerald-500/12 text-emerald-400"
          : "text-zinc-400 hover:text-white hover:bg-zinc-800/70"
      }`}>
      <Icon name={item.icon} className="w-[18px] h-[18px]" strokeWidth={active ? 2.1 : 1.8} />
      <span className="flex-1">{item.label}</span>
      {badge ? (
        <span className="stat-badge">{badge}</span>
      ) : active ? (
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
      ) : null}
    </Link>
  )
}
