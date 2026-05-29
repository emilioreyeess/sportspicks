"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { Icon } from "@/components/ui/icons"
import { NAV_MAIN, NAV_MORE, isActive } from "@/components/ui/nav-items"
import { usePlan } from "@/lib/plan"
import { PLANS } from "@/lib/plans"
import { PremiumBadge } from "@/components/premium"

export function TopBar() {
  const path = usePathname()
  const { plan } = usePlan()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => { setOpen(false) }, [path])

  useEffect(() => {
    const el = document.documentElement
    const onScroll = () => setScrolled(el.scrollTop > 4)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <>
      {/* ─── iOS Navigation Bar ──────────────────────────────────────────── */}
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
            <span className="grid place-items-center w-[30px] h-[30px] rounded-[9px] bg-gradient-to-br from-emerald-500/20 to-cyan-500/12 border border-emerald-600/35 group-hover:border-emerald-500/55 group-hover:shadow-[0_0_12px_rgba(52,211,153,0.18)] transition-all duration-200 overflow-hidden shrink-0">
              <img src="/icon.svg" className="w-[16px] h-[16px]" alt="" />
            </span>
            <span className="text-[15px] font-black tracking-tight text-white">SportsPicks</span>
          </Link>

          {/* Actions — right */}
          <div className="flex items-center gap-1">
            {plan === "free" ? (
              <Link href="/pricing"
                className="flex items-center gap-1 rounded-full border border-emerald-700/45 bg-emerald-500/10 px-2.5 py-[5px] text-[11px] font-black text-emerald-400 tap hover:bg-emerald-500/16 hover:border-emerald-600/55 transition-all">
                <Icon name="crown" className="w-3 h-3" strokeWidth={2.4} />
                Premium
              </Link>
            ) : (
              <Link href="/account" className="tap">
                <PremiumBadge plan={plan} />
              </Link>
            )}
            <button onClick={() => setOpen(true)} aria-label="Abrir menú"
              className="grid place-items-center w-9 h-9 rounded-xl text-zinc-400 hover:bg-white/[0.06] hover:text-white transition-colors tap ml-0.5">
              <Icon name="menu" className="w-[18px] h-[18px]" strokeWidth={2.2} />
            </button>
          </div>
        </div>
      </header>

      {/* ─── Mobile Drawer ───────────────────────────────────────────────── */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Navegación">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/65 backdrop-blur-[2px] animate-fade-in"
            onClick={() => setOpen(false)}
          />

          {/* Drawer panel — iOS sheet style */}
          <div
            className="absolute inset-y-0 right-0 w-[80%] max-w-[300px] flex flex-col animate-enter-right safe-top safe-bottom"
            style={{
              background: "rgba(10,10,13,0.96)",
              backdropFilter: "saturate(200%) blur(28px)",
              WebkitBackdropFilter: "saturate(200%) blur(28px)",
              borderLeft: "0.5px solid rgba(255,255,255,0.10)",
              boxShadow: "-12px 0 50px rgba(0,0,0,0.65)",
            }}
          >
            {/* Ambient decoration */}
            <div className="pointer-events-none absolute top-0 right-0 w-44 h-52 overflow-hidden" aria-hidden="true">
              <div className="absolute -top-8 -right-8 w-44 h-44 bg-emerald-500/[0.06] rounded-full blur-3xl" />
            </div>

            {/* Drawer header — matches TopBar height */}
            <div className="relative flex items-center justify-between h-[56px] px-4 border-b border-white/[0.07]">
              <div className="flex items-center gap-2">
                <span className="grid place-items-center w-[28px] h-[28px] rounded-[8px] bg-gradient-to-br from-emerald-500/18 to-cyan-500/10 border border-emerald-700/35 overflow-hidden shrink-0">
                  <img src="/icon.svg" className="w-3.5 h-3.5" alt="" />
                </span>
                <span className="text-[15px] font-black text-white tracking-tight">SportsPicks</span>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Cerrar menú"
                className="grid place-items-center w-9 h-9 rounded-xl text-zinc-400 hover:bg-white/[0.06] hover:text-white transition-colors tap">
                <Icon name="close" className="w-[18px] h-[18px]" strokeWidth={2.2} />
              </button>
            </div>

            {/* Nav links */}
            <nav className="relative flex-1 overflow-y-auto px-2.5 pt-3 pb-2">
              <p className="apple-eyebrow px-3 pb-2 text-zinc-600">Plataforma</p>
              <div className="space-y-[2px]">
                {NAV_MAIN.map((item) => {
                  const active = isActive(path, item.href)
                  return (
                    <Link key={item.href} href={item.href}
                      className={[
                        "flex items-center gap-3 px-3 py-[10px] rounded-xl text-[15px] transition-all duration-150",
                        active
                          ? "nav-active-pill text-emerald-300 font-semibold"
                          : "text-zinc-300 hover:bg-white/[0.05] hover:text-white font-medium",
                      ].join(" ")}>
                      <Icon
                        name={item.icon}
                        className={["w-[18px] h-[18px] transition-all shrink-0", active ? "text-emerald-400 drop-shadow-[0_0_5px_rgba(52,211,153,0.55)]" : "text-zinc-500"].join(" ")}
                        strokeWidth={active ? 2.2 : 1.8}
                      />
                      <span className="flex-1 tracking-tight leading-none">{item.label}</span>
                      {active && (
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)] shrink-0" />
                      )}
                    </Link>
                  )
                })}
              </div>

              <p className="apple-eyebrow px-3 pt-5 pb-2 text-zinc-600">Más</p>
              <div className="space-y-[2px]">
                {NAV_MORE.map((item) => {
                  const active = isActive(path, item.href)
                  return (
                    <Link key={item.href} href={item.href}
                      className={[
                        "flex items-center gap-3 px-3 py-[10px] rounded-xl text-[15px] transition-all duration-150",
                        active
                          ? "nav-active-pill text-emerald-300 font-semibold"
                          : "text-zinc-400 hover:bg-white/[0.05] hover:text-white font-medium",
                      ].join(" ")}>
                      <Icon
                        name={item.icon}
                        className={["w-[18px] h-[18px] shrink-0", active ? "text-emerald-400" : "text-zinc-500"].join(" ")}
                        strokeWidth={active ? 2.2 : 1.8}
                      />
                      <span className="flex-1 tracking-tight leading-none">{item.label}</span>
                    </Link>
                  )
                })}
              </div>
            </nav>

            {/* Plan footer card */}
            <div className="relative p-3 border-t border-white/[0.07]">
              <Link
                href={plan === "free" ? "/pricing" : "/account"}
                className={[
                  "relative overflow-hidden flex items-center justify-between rounded-[13px] border px-4 py-3 tap transition-all",
                  plan === "free"
                    ? "border-emerald-800/55 bg-emerald-500/[0.06] hover:border-emerald-700/55 hover:bg-emerald-500/10"
                    : plan === "pro"
                      ? "border-violet-800/55 bg-violet-500/[0.06] hover:border-violet-700/55"
                      : "border-white/[0.08] bg-white/[0.03] hover:border-white/[0.12]",
                ].join(" ")}>
                {plan !== "free" && (
                  <div className={[
                    "absolute top-0 right-0 w-14 h-14 rounded-full blur-2xl opacity-35",
                    plan === "pro" ? "bg-violet-500/40" : "bg-emerald-500/30",
                  ].join(" ")} />
                )}
                <div className="relative">
                  <p className="apple-eyebrow text-zinc-600 mb-[3px]">Tu plan</p>
                  <p className={[
                    "text-[15px] font-bold leading-none",
                    plan === "free" ? "text-zinc-200" : plan === "pro" ? "text-violet-400" : "text-emerald-400",
                  ].join(" ")}>{PLANS[plan].name}</p>
                </div>
                <span className={[
                  "relative text-[13px] font-semibold",
                  plan === "free" ? "text-emerald-400" : "text-zinc-500",
                ].join(" ")}>
                  {plan === "free" ? "Mejorar →" : "Gestionar →"}
                </span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
