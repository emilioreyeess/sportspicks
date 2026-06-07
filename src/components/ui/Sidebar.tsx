"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { Icon } from "@/components/ui/icons"
import { NAV_MAIN, NAV_MORE, isActive } from "@/components/ui/nav-items"
import { usePlan } from "@/lib/plan"
import { PLANS } from "@/lib/plans"

export function Sidebar() {
  const path = usePathname()
  const { plan } = usePlan()
  const planDef = PLANS[plan]
  const { data: session } = useSession()
  const [picksCount, setPicksCount] = useState<number | null>(null)

  useEffect(() => {
    fetch("/api/picks")
      .then(r => r.json())
      .then(d => setPicksCount(d.total ?? null))
      .catch(() => {})
  }, [])

  const user       = session?.user
  const userName   = user?.name  ?? null
  const userEmail  = user?.email ?? null
  const userImage  = user?.image ?? null
  const initial    = (userName ?? userEmail ?? "U").charAt(0).toUpperCase()

  const planRingColor =
    plan === "pro"     ? "border-violet-600/60" :
    plan === "premium" ? "border-emerald-600/60" :
                         "border-white/[0.07]"

  const planInitialColor =
    plan === "pro"     ? "text-violet-400" :
    plan === "premium" ? "text-emerald-400" :
                         "text-zinc-400"

  return (
    <aside className="hidden lg:flex flex-col w-[220px] shrink-0 border-r border-white/[0.07] apple-chrome sticky top-0 h-screen">
      {/* Ambient glow decoration */}
      <div className="pointer-events-none absolute top-0 left-0 w-full h-56 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-10 -left-10 w-44 h-44 bg-emerald-500/[0.055] rounded-full blur-[50px]" />
      </div>

      {/* Brand */}
      <Link href="/" className="relative flex items-center gap-2.5 px-4 h-[56px] border-b border-white/[0.07] group">
        <span className="grid place-items-center w-8 h-8 rounded-[10px] bg-emerald-400/10 border border-emerald-400/15 text-emerald-400/90 group-hover:border-emerald-400/25 transition-all duration-200 shrink-0">
          <Icon name="value" className="w-4 h-4" strokeWidth={2.2} />
        </span>
        <div className="min-w-0">
          <p className="text-[14px] font-bold text-white tracking-tight leading-none">SportsPicks</p>
          <p className="text-[10px] text-emerald-400/75 font-semibold mt-[3px] tracking-wide leading-none">Analytics Engine</p>
        </div>
      </Link>

      {/* Nav */}
      <nav className="relative flex-1 overflow-y-auto px-2 py-3.5 space-y-0.5">
        <p className="apple-eyebrow px-2.5 pb-2 text-zinc-600">Plataforma</p>
        {NAV_MAIN.map((item) => (
          <SideLink
            key={item.href}
            item={item}
            active={isActive(path, item.href)}
            badge={item.href === "/value" && picksCount && picksCount > 0 ? String(picksCount) : undefined}
          />
        ))}

        <p className="apple-eyebrow px-2.5 pt-4 pb-2 text-zinc-600">Más</p>
        {NAV_MORE.map((item) => (
          <SideLink key={item.href} item={item} active={isActive(path, item.href)} />
        ))}

      </nav>

      {/* User profile */}
      {user && (
        <div className="px-2.5 py-2.5 border-t border-white/[0.07]">
          <Link href="/account"
            className="flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 hover:bg-white/[0.05] transition-colors tap group">
            {/* Avatar */}
            <div className={`relative shrink-0 w-7 h-7 rounded-full border-2 overflow-hidden ${planRingColor}`}>
              {userImage ? (
                <Image src={userImage} alt={userName ?? "Perfil"} fill sizes="28px" className="object-cover" />
              ) : (
                <div className={`w-full h-full flex items-center justify-center text-[11px] font-bold bg-zinc-800 ${planInitialColor}`}>
                  {initial}
                </div>
              )}
            </div>
            {/* Name + email */}
            <div className="min-w-0 flex-1">
              {userName && (
                <p className="text-[12px] font-semibold text-zinc-200 truncate leading-tight">{userName}</p>
              )}
              {userEmail && (
                <p className="text-[10px] text-zinc-500 truncate leading-tight">{userEmail}</p>
              )}
            </div>
            <Icon name="settings" className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400 transition-colors shrink-0" strokeWidth={1.8} />
          </Link>
        </div>
      )}

      {/* Plan card */}
      <div className="p-2.5 border-t border-white/[0.07]">
        <Link
          href={plan === "free" ? "/pricing" : "/account"}
          className={[
            "relative block overflow-hidden rounded-2xl px-3.5 py-3 tap transition-all duration-200",
            plan === "free"
              ? "bg-emerald-400/[0.07] hover:bg-emerald-400/[0.11]"
              : plan === "pro"
                ? "bg-violet-400/[0.07] hover:bg-violet-400/[0.11]"
                : "bg-white/[0.03] hover:bg-white/[0.05]",
          ].join(" ")}>
          {/* Ambient dot */}
          {plan !== "free" && (
            <div className={[
              "absolute top-0 right-0 w-14 h-14 rounded-full blur-2xl opacity-35",
              plan === "pro" ? "bg-violet-500/50" : "bg-emerald-500/35",
            ].join(" ")} />
          )}
          <div className="relative flex items-center justify-between">
            <span className="apple-eyebrow text-zinc-600">Tu plan</span>
            <span className={[
              "text-[10px] font-bold uppercase tracking-wide",
              plan === "free" ? "text-zinc-500" : plan === "pro" ? "text-violet-400" : "text-emerald-400",
            ].join(" ")}>{planDef.name}</span>
          </div>
          {plan === "free" ? (
            <div className="relative mt-1.5 flex items-center gap-1.5 text-[12px] font-bold text-emerald-400">
              <Icon name="crown" className="w-3 h-3" strokeWidth={2.4} />
              Mejorar · desde 9.99€
            </div>
          ) : (
            <p className="relative mt-1 text-[11px] text-zinc-500 font-medium">Gestionar suscripción</p>
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
      className={[
        "relative flex items-center gap-2.5 px-2.5 py-[9px] rounded-[9px] text-[13px] transition-all duration-150",
        active
          ? "nav-active-pill text-emerald-300 font-semibold"
          : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05] font-medium",
      ].join(" ")}>
      <Icon
        name={item.icon}
        className={[
          "w-[16px] h-[16px] transition-all duration-200 shrink-0",
          active ? "text-emerald-400 drop-shadow-[0_0_4px_rgba(82,181,145,0.55)]" : "text-zinc-500",
        ].join(" ")}
        strokeWidth={active ? 2.2 : 1.8}
      />
      <span className="flex-1 tracking-tight leading-none">{item.label}</span>
      {badge ? (
        <span className="stat-badge">{badge}</span>
      ) : active ? (
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_5px_rgba(82,181,145,0.75)]" />
      ) : null}
    </Link>
  )
}
