"use client"

import { usePathname } from "next/navigation"
import { Sidebar } from "@/components/ui/Sidebar"
import { TopBar } from "@/components/ui/TopBar"
import { BottomNav } from "@/components/ui/BottomNav"
import { GlobalFooter } from "@/components/legal/GlobalFooter"

/**
 * Shell de la app. Layout responsive:
 *  - Móvil: TopBar sticky + contenido + BottomNav fija (estilo app nativa)
 *  - Desktop: Sidebar lateral + contenido + footer
 *  - Rutas inmersivas (/bot): pantalla completa sin chrome
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const immersive = path?.startsWith("/bot") ?? false

  if (immersive) {
    return <div className="h-[100dvh] overflow-hidden bg-zinc-950">{children}</div>
  }

  return (
    <div className="flex min-h-[100dvh] flex-col pb-nav">
      <TopBar />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 min-w-0 flex flex-col">
          <div className="flex-1 animate-fade-in">{children}</div>
          <GlobalFooter />
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
