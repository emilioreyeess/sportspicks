"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Icon } from "@/components/ui/icons"
import { usePlan } from "@/lib/plan"
import { PremiumBadge } from "@/components/premium"

/**
 * TopBar móvil (lg:hidden): marca + badge de plan + hamburguesa.
 * El menú es ÚNICO: la hamburguesa abre el MobileDrawer compartido (estado en
 * AppShell) — ya no hay drawer propio aquí (eliminado el "doble menú").
 */
export function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const el = document.documentElement
    const onScroll = () => setScrolled(el.scrollTop > 4)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const { plan } = usePlan()

  return (
    <header className={[
      "lg:hidden sticky top-0 z-40 apple-chrome border-b safe-top",
      "transition-all duration-300",
      scrolled
        ? "shadow-[0_1px_0_rgba(255,255,255,0.06),0_4px_20px_rgba(0,0,0,0.45)]"
        : "shadow-none",
    ].join(" ")}>
      <div className="flex items-center justify-between h-[56px] px-4">

        {/* Brand — left */}
        <Link href="/" className="flex items-center gap-2 group">
          <span className="grid place-items-center w-[30px] h-[30px] rounded-[9px] bg-emerald-400/10 border border-emerald-400/15 group-hover:border-emerald-400/25 transition-all duration-200 overflow-hidden shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" className="w-[16px] h-[16px]" alt="" />
          </span>
          <span className="text-[15px] font-bold tracking-tight text-white">SportsPicks</span>
        </Link>

        {/* Actions — right */}
        <div className="flex items-center gap-1">
          {plan === "free" ? (
            <Link href="/pricing"
              className="flex items-center gap-1 rounded-full bg-emerald-400/10 px-3 py-[5px] text-[11px] font-semibold text-emerald-400/90 tap hover:bg-emerald-400/15 transition-all">
              <Icon name="crown" className="w-3 h-3" strokeWidth={2.4} />
              Premium
            </Link>
          ) : (
            <Link href="/account" className="tap">
              <PremiumBadge plan={plan} />
            </Link>
          )}
          <button onClick={onMenuClick} aria-label="Abrir menú"
            className="grid place-items-center w-9 h-9 rounded-xl text-zinc-400 hover:bg-white/[0.06] hover:text-white transition-colors tap ml-0.5">
            <Icon name="menu" className="w-[18px] h-[18px]" strokeWidth={2.2} />
          </button>
        </div>
      </div>
    </header>
  )
}
