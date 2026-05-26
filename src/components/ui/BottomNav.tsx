"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Icon } from "@/components/ui/icons"
import { NAV_MAIN, isActive } from "@/components/ui/nav-items"

/** Color de acento por item activo (por defecto: emerald) */
function activeColor(href: string) {
  if (href === "/world-cup-2026") return {
    text:  "text-amber-400",
    glow:  "drop-shadow-[0_0_6px_rgba(251,191,36,0.7)]",
    dot:   "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]",
    strip: "background:linear-gradient(90deg,#fbbf24,#f59e0b)",
  }
  if (href === "/retos") return {
    text:  "text-rose-400",
    glow:  "drop-shadow-[0_0_6px_rgba(251,113,133,0.7)]",
    dot:   "bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.8)]",
    strip: "",
  }
  return {
    text:  "text-emerald-400",
    glow:  "drop-shadow-[0_0_6px_rgba(52,211,153,0.7)]",
    dot:   "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]",
    strip: "",
  }
}

export function BottomNav() {
  const path = usePathname()

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 glass-dark border-t border-zinc-800/60 safe-bottom">
      <div className="flex items-stretch justify-around h-16 max-w-md mx-auto">
        {NAV_MAIN.map((item) => {
          const active = isActive(path, item.href)
          const isCenter = item.href === "/bot"
          const c = activeColor(item.href)

          /* ── Bot IA — botón central elevado ── */
          if (isCenter) {
            return (
              <Link key={item.href} href={item.href}
                className="flex flex-col items-center justify-end gap-1 flex-1 pb-1.5 tap">
                <span className={`grid place-items-center w-12 h-12 -mt-5 rounded-2xl shadow-lg transition-all duration-200 ${
                  active
                    ? "bg-gradient-to-br from-emerald-400 to-cyan-400 text-zinc-950 shadow-emerald-500/40 scale-105"
                    : "bg-gradient-to-br from-emerald-500 to-cyan-500 text-zinc-950 shadow-emerald-500/25 hover:scale-105"
                }`}>
                  <Icon name="bot" className="w-6 h-6" strokeWidth={2} />
                </span>
                <span className={`text-[10px] font-black ${active ? "text-emerald-400" : "text-zinc-500"}`}>
                  {item.short}
                </span>
              </Link>
            )
          }

          /* ── Items normales ── */
          return (
            <Link key={item.href} href={item.href}
              className={`relative flex flex-col items-center justify-center gap-1 flex-1 tap`}>

              {/* Indicador superior (línea de color) */}
              {active && (
                <span className={`absolute top-0 left-1/2 -translate-x-1/2 w-6 h-[2px] rounded-b-sm ${
                  item.href === "/world-cup-2026" ? "bg-gradient-to-r from-amber-400 to-yellow-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]" :
                  item.href === "/retos"          ? "bg-gradient-to-r from-rose-400 to-orange-400 shadow-[0_0_6px_rgba(251,113,133,0.6)]" :
                  "bg-gradient-to-r from-emerald-400 to-cyan-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]"
                }`} />
              )}

              <Icon
                name={item.icon}
                className={`w-[22px] h-[22px] transition-all duration-200 ${
                  active ? `${c.text} ${c.glow}` : "text-zinc-500"
                }`}
                strokeWidth={active ? 2.3 : 1.8}
              />
              <span className={`text-[10px] font-bold transition-colors duration-200 ${
                active ? c.text : "text-zinc-500"
              }`}>{item.short}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
