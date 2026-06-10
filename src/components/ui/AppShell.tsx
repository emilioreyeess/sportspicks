"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import { Sidebar } from "@/components/ui/Sidebar"
import { TopBar } from "@/components/ui/TopBar"
import { BottomNav } from "@/components/ui/BottomNav"
import { MobileDrawer } from "@/components/ui/MobileDrawer"
import { GlobalFooter } from "@/components/legal/GlobalFooter"
import { ErrorBoundary } from "@/components/ui/ErrorBoundary"

/**
 * Shell de la app — Apple HIG layout:
 *  - Móvil:   TopBar sticky + contenido + BottomNav fija (iOS native feel)
 *  - Desktop: Sidebar lateral + contenido + footer (macOS feel)
 *  - Rutas inmersivas (/bot): pantalla completa sin chrome
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const immersive = path?.startsWith("/bot") ?? false
  const [menuOpen, setMenuOpen] = useState(false)

  if (immersive) {
    return <div className="h-[100dvh] overflow-hidden bg-[var(--bg)]">{children}</div>
  }

  return (
    <div className="relative flex min-h-[100dvh] flex-col pb-nav">
      {/* Global mesh overlay — reinforces body gradient on scroll */}
      <div className="pointer-events-none fixed inset-0 -z-10 mesh-bg" aria-hidden="true" />
      <TopBar onMenuClick={() => setMenuOpen(true)} />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 min-w-0 flex flex-col">
          <div className="flex-1 animate-fade-in-soft">
            <ErrorBoundary>{children}</ErrorBoundary>
          </div>
          <GlobalFooter />
        </main>
      </div>
      <BottomNav onMore={() => setMenuOpen(true)} />
      <MobileDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  )
}
