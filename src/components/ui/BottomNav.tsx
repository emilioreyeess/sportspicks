"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Icon } from "@/components/ui/icons"
import { isActive, WORLD_CUP_ACTIVE } from "@/components/ui/nav-items"

/**
 * Barra inferior móvil — EXACTAMENTE 5 slots (PUNTO 4):
 *   Inicio · Value Picks · Bot IA (central) · [Mundial | Combinadas] · Más
 * "Más" NO navega: dispara onMore() → abre el MobileDrawer (Panel lateral).
 *
 * El 4º slot lo ocupaba el Mundial 2026; archivado el torneo pasa a Combinadas.
 * Se reactiva solo con WORLD_CUP_ACTIVE = true en nav-items.ts.
 */
const WC_TAB  = { href: "/world-cup-2026", icon: "wc2026",     short: "Mundial",    center: false }
const ALT_TAB = { href: "/combinadas",     icon: "combinadas", short: "Combinadas", center: false }

const TABS = [
  { href: "/",      icon: "home",  short: "Inicio", center: false },
  { href: "/value", icon: "value", short: "Value",  center: false },
  { href: "/bot",   icon: "bot",   short: "Bot IA", center: true  },
  WORLD_CUP_ACTIVE ? WC_TAB : ALT_TAB,
]

function tabColor(href: string) {
  if (href === "/world-cup-2026") return { text: "text-amber-400/90", pill: "ios-tab-active-amber" }
  return { text: "text-emerald-400/90", pill: "ios-tab-active" }
}

export function BottomNav({ onMore }: { onMore: () => void }) {
  const path = usePathname()

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 ios-tab-bar border-t border-white/[0.07] safe-bottom">
      <div className="flex items-stretch justify-around h-16 max-w-md mx-auto px-1">
        {TABS.map((item) => {
          const active = isActive(path, item.href)
          const c = tabColor(item.href)

          /* ── Bot IA — botón central elevado ── */
          if (item.center) {
            return (
              <Link key={item.href} href={item.href}
                className="flex flex-col items-center justify-end gap-1 flex-1 pb-2 tap">
                <span className={[
                  "grid place-items-center w-11 h-11 -mt-5 rounded-full shadow-lg transition-all duration-200",
                  active
                    ? "bg-emerald-400 text-zinc-950 shadow-[0_4px_16px_-4px_rgba(82,181,145,0.35)] scale-[1.06]"
                    : "bg-emerald-500 text-zinc-950 shadow-[0_4px_16px_-4px_rgba(82,181,145,0.20)] hover:scale-105",
                ].join(" ")}>
                  <Icon name="bot" className="w-5.5 h-5.5" strokeWidth={2.2} />
                </span>
                <span className={`text-[10px] font-medium leading-none ${active ? "text-emerald-400" : "text-zinc-500"}`}>
                  {item.short}
                </span>
              </Link>
            )
          }

          /* ── Items normales — pill iOS style ── */
          return (
            <Link key={item.href} href={item.href}
              className="relative flex flex-col items-center justify-center gap-0.5 flex-1 tap py-1">
              {active && <span className={`absolute inset-x-1 top-2 bottom-1.5 ${c.pill}`} aria-hidden="true" />}
              <Icon name={item.icon}
                className={`relative w-[22px] h-[22px] transition-all duration-200 ${active ? c.text : "text-zinc-500"}`}
                strokeWidth={active ? 2.2 : 1.8} />
              <span className={`relative text-[10px] leading-none font-medium transition-colors duration-200 ${active ? c.text : "text-zinc-500"}`}>
                {item.short}
              </span>
            </Link>
          )
        })}

        {/* ── Más — NO navega: abre el Panel lateral (MobileDrawer) ── */}
        <button onClick={onMore} aria-label="Abrir menú"
          className="relative flex flex-col items-center justify-center gap-0.5 flex-1 tap py-1">
          <Icon name="menu" className="relative w-[22px] h-[22px] text-zinc-500" strokeWidth={1.8} />
          <span className="relative text-[10px] leading-none font-medium text-zinc-500">Más</span>
        </button>
      </div>
    </nav>
  )
}
