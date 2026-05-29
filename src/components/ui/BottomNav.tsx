"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Icon } from "@/components/ui/icons"
import { NAV_MAIN, isActive } from "@/components/ui/nav-items"

/** Color config por ruta activa */
function tabConfig(href: string) {
  if (href === "/world-cup-2026") return {
    text:    "text-amber-400",
    glow:    "drop-shadow-[0_0_5px_rgba(251,191,36,0.65)]",
    pill:    "ios-tab-active-amber",
    stroke:  2.2,
  }
  if (href === "/retos") return {
    text:    "text-rose-400",
    glow:    "drop-shadow-[0_0_5px_rgba(251,113,133,0.65)]",
    pill:    "ios-tab-active-rose",
    stroke:  2.2,
  }
  return {
    text:    "text-emerald-400",
    glow:    "drop-shadow-[0_0_5px_rgba(52,211,153,0.65)]",
    pill:    "ios-tab-active",
    stroke:  2.2,
  }
}

export function BottomNav() {
  const path = usePathname()

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 ios-tab-bar border-t border-white/[0.07] safe-bottom">
      <div className="flex items-stretch justify-around h-16 max-w-md mx-auto px-1">
        {NAV_MAIN.map((item) => {
          const active  = isActive(path, item.href)
          const isCenter = item.href === "/bot"
          const c = tabConfig(item.href)

          /* ── Bot IA — botón central elevado ── */
          if (isCenter) {
            return (
              <Link key={item.href} href={item.href}
                className="flex flex-col items-center justify-end gap-1 flex-1 pb-2 tap">
                <span className={[
                  "grid place-items-center w-11 h-11 -mt-5 rounded-full shadow-lg transition-all duration-200",
                  active
                    ? "bg-emerald-400 text-zinc-950 shadow-[0_4px_16px_rgba(52,211,153,0.40)] scale-[1.06]"
                    : "bg-emerald-500 text-zinc-950 shadow-[0_4px_16px_rgba(52,211,153,0.22)] hover:scale-105",
                ].join(" ")}>
                  <Icon name="bot" className="w-5.5 h-5.5" strokeWidth={2.2} />
                </span>
                <span className={`text-[10px] font-bold leading-none ${active ? "text-emerald-400" : "text-zinc-500"}`}>
                  {item.short}
                </span>
              </Link>
            )
          }

          /* ── Items normales — pill iOS style ── */
          return (
            <Link key={item.href} href={item.href}
              className="relative flex flex-col items-center justify-center gap-0.5 flex-1 tap py-1">

              {/* Pill background tras icono+label */}
              {active && (
                <span className={`absolute inset-x-1 top-2 bottom-1.5 ${c.pill}`} aria-hidden="true" />
              )}

              <Icon
                name={item.icon}
                className={`relative w-[22px] h-[22px] transition-all duration-200 ${
                  active ? `${c.text} ${c.glow}` : "text-zinc-500"
                }`}
                strokeWidth={active ? c.stroke : 1.8}
              />
              <span className={`relative text-[10px] leading-none font-bold transition-colors duration-200 ${
                active ? c.text : "text-zinc-500"
              }`}>{item.short}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
