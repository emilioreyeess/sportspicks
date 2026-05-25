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
    <aside className="hidden lg:flex flex-col w-60 shrink-0 border-r border-zinc-800/50 glass-dark sticky top-0 h-screen">
      {/* Ambient glow decoration */}
      <div className="pointer-events-none absolute top-0 left-0 w-full h-48 overflow-hidden rounded-none">
        <div className="absolute -top-8 -left-8 w-40 h-40 bg-emerald-500/8 rounded-full blur-3xl" />
      </div>

      {/* Brand */}
      <Link href="/" className="relative flex items-center gap-2.5 px-5 h-16 border-b border-zinc-800/50 group">
        <span className="grid place-items-center w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/25 to-cyan-500/15 border border-emerald-600/40 text-emerald-400 group-hover:border-emerald-500/60 group-hover:shadow-[0_0_12px_rgba(52,211,153,0.2)] transition-all duration-200">
          <Icon name="value" className="w-5 h-5" strokeWidth={2} />
        </span>
        <div>
          <p className="text-sm font-black text-white tracking-tight leading-none">SportsPicks</p>
          <p className="text-[10px] text-emerald-400/80 font-bold mt-0.5 tracking-wide">Analytics Engine</p>
        </div>
      </Link>

      {/* Nav */}
      <nav className="relative flex-1 overflow-y-auto px-2.5 py-4 space-y-0.5">
        <p className="px-3 pb-2 text-[10px] font-black uppercase tracking-widest text-zinc-600">Plataforma</p>
        {NAV_MAIN.map((item) => (
          <SideLink
            key={item.href}
            item={item}
            active={isActive(path, item.href)}
            badge={item.href === "/value" && picksCount && picksCount > 0 ? String(picksCount) : undefined}
          />
        ))}
        <p className="px-3 pt-5 pb-2 text-[10px] font-black uppercase tracking-widest text-zinc-600">Más</p>
        {NAV_MORE.map((item) => (
          <SideLink key={item.href} item={item} active={isActive(path, item.href)} />
        ))}
      </nav>

      {/* Plan card */}
      <div className="p-2.5 border-t border-zinc-800/50">
        <Link
          href={plan === "free" ? "/pricing" : "/account"}
          className={`relative block overflow-hidden rounded-xl border px-3.5 py-3 tap transition-all duration-200 ${
            plan === "free"
              ? "border-emerald-800/60 bg-emerald-500/5 hover:border-emerald-700/80 hover:bg-emerald-500/8"
              : plan === "pro"
                ? "border-violet-800/60 bg-violet-500/5 hover:border-violet-700/80"
                : "border-zinc-800/80 bg-zinc-900/60 hover:border-zinc-700"
          }`}>
          {/* Ambient dot */}
          {plan !== "free" && (
            <div className={`absolute top-0 right-0 w-16 h-16 rounded-full blur-2xl opacity-40 ${
              plan === "pro" ? "bg-violet-500/30" : "bg-emerald-500/20"
            }`} />
          )}
          <div className="relative flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Tu plan</span>
            <span className={`text-[10px] font-black uppercase tracking-wide ${
              plan === "free" ? "text-zinc-400" : plan === "pro" ? "text-violet-400" : "text-emerald-400"
            }`}>{planDef.name}</span>
          </div>
          {plan === "free" ? (
            <div className="relative mt-2 flex items-center gap-1.5 text-xs font-black text-emerald-400">
              <Icon name="crown" className="w-3.5 h-3.5" strokeWidth={2.2} />
              Mejorar · desde 9.99€
            </div>
          ) : (
            <p className="relative mt-1 text-xs text-zinc-500 font-medium">Gestionar suscripción</p>
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
    <Link
      href={item.href}
      className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
        active
          ? "nav-active-pill text-emerald-300 font-bold"
          : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 font-medium"
      }`}>
      <Icon
        name={item.icon}
        className={`w-[18px] h-[18px] transition-all duration-200 ${
          active
            ? "text-emerald-400 drop-shadow-[0_0_5px_rgba(52,211,153,0.6)]"
            : "text-zinc-500"
        }`}
        strokeWidth={active ? 2.2 : 1.8}
      />
      <span className="flex-1 tracking-tight">{item.label}</span>
      {badge ? (
        <span className="stat-badge">{badge}</span>
      ) : active ? (
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
      ) : null}
    </Link>
  )
}
