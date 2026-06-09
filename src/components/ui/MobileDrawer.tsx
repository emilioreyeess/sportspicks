"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect } from "react"
import { Icon } from "@/components/ui/icons"
import { NAV_MAIN, NAV_MORE, isActive, type NavItem } from "@/components/ui/nav-items"

/**
 * Panel lateral móvil (drawer). Lo abre el botón "Más" del BottomNav (PUNTO 4).
 * Reutiliza la navegación (NAV_MAIN + NAV_MORE). Solo móvil (lg:hidden).
 */
export function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const path = usePathname()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = "" }
  }, [open, onClose])

  return (
    <div className={`lg:hidden fixed inset-0 z-[60] ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/60 transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`}
      />
      {/* Panel */}
      <aside
        className={`absolute right-0 top-0 h-[100dvh] w-[82%] max-w-[320px] flex flex-col bg-zinc-950 border-l border-white/[0.08] shadow-2xl safe-top transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 h-[56px] border-b border-white/[0.07]">
          <span className="text-[14px] font-bold text-white">Menú</span>
          <button
            onClick={onClose}
            aria-label="Cerrar menú"
            className="grid place-items-center w-9 h-9 rounded-xl bg-zinc-900 text-zinc-400 hover:text-white tap"
          >
            <Icon name="close" className="w-4 h-4" strokeWidth={2.2} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 safe-bottom">
          <p className="px-5 pt-2 pb-1 text-[10px] font-black uppercase tracking-widest text-zinc-600">Plataforma</p>
          {NAV_MAIN.map((item) => (
            <DrawerLink key={item.href} item={item} active={isActive(path, item.href)} onClose={onClose} />
          ))}
          <p className="px-5 pt-4 pb-1 text-[10px] font-black uppercase tracking-widest text-zinc-600">Más</p>
          {NAV_MORE.map((item) => (
            <DrawerLink key={item.href} item={item} active={isActive(path, item.href)} onClose={onClose} />
          ))}
        </nav>
      </aside>
    </div>
  )
}

function DrawerLink({ item, active, onClose }: { item: NavItem; active: boolean; onClose: () => void }) {
  return (
    <Link
      href={item.href}
      onClick={onClose}
      className={`flex items-center gap-3 px-5 py-2.5 text-[14px] transition-colors hover:bg-white/[0.03] ${
        active ? "text-emerald-400 font-semibold" : "text-zinc-300"
      }`}
    >
      <Icon name={item.icon} className="w-[18px] h-[18px] shrink-0" strokeWidth={active ? 2.2 : 1.8} />
      {item.label}
    </Link>
  )
}
