"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Icon } from "@/components/ui/icons"
import { NAV_MAIN, isActive } from "@/components/ui/nav-items"

export function BottomNav() {
  const path = usePathname()

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 glass-dark border-t border-zinc-800/60 safe-bottom">
      <div className="flex items-stretch justify-around h-16 max-w-md mx-auto">
        {NAV_MAIN.map((item) => {
          const active = isActive(path, item.href)
          const center = item.href === "/bot"

          if (center) {
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

          return (
            <Link key={item.href} href={item.href}
              className={`relative flex flex-col items-center justify-center gap-1 flex-1 tap ${active ? "nav-indicator" : ""}`}>
              <Icon
                name={item.icon}
                className={`w-[22px] h-[22px] transition-all duration-200 ${
                  active
                    ? "text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.7)]"
                    : "text-zinc-500"
                }`}
                strokeWidth={active ? 2.3 : 1.8}
              />
              <span className={`text-[10px] font-bold transition-colors duration-200 ${
                active ? "text-emerald-400" : "text-zinc-500"
              }`}>{item.short}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
