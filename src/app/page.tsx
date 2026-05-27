"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Icon } from "@/components/ui/icons"
import { usePlan } from "@/lib/plan"

// Tool cards — Retos-style: one accent color per card, gradient header, clean body
const TOOLS = [
  {
    href: "/value",
    icon: "value",
    badge: "Diario",
    title: "Value Picks",
    desc: "Picks donde el modelo Poisson supera a la cuota real. Edge real con contexto de motivación.",
    color: "emerald" as const,
  },
  {
    href: "/bot",
    icon: "bot",
    badge: "IA",
    title: "Bot IA",
    desc: "Sube la foto de tu boleto y el bot lo analiza con datos reales de ESPN: clasificación, forma y H2H.",
    color: "violet" as const,
  },
  {
    href: "/combinadas",
    icon: "combinadas",
    badge: "Generador",
    title: "Combinadas",
    desc: "Elige liga y perfil de riesgo. El sistema arma la combinada con cuotas reales.",
    color: "amber" as const,
  },
  {
    href: "/stats",
    icon: "stats",
    badge: "Búsqueda",
    title: "Estadísticas",
    desc: "Busca cualquier equipo: forma, BTTS, Over/Under y rendimiento local/visitante.",
    color: "blue" as const,
  },
]

type ToolColor = "emerald" | "violet" | "amber" | "blue"

const TOOL_COLORS: Record<ToolColor, {
  border: string; header: string; icon: string; badge: string; text: string; arrow: string
}> = {
  emerald: {
    border:  "border-emerald-700/50 hover:border-emerald-500/60",
    header:  "from-emerald-600/20 via-emerald-600/8 to-transparent",
    icon:    "bg-emerald-500/20 border-emerald-700/40 text-emerald-400",
    badge:   "bg-emerald-500/15 border-emerald-700/50 text-emerald-400",
    text:    "text-emerald-400",
    arrow:   "text-emerald-400",
  },
  violet: {
    border:  "border-violet-700/50 hover:border-violet-500/60",
    header:  "from-violet-600/20 via-violet-600/8 to-transparent",
    icon:    "bg-violet-500/20 border-violet-700/40 text-violet-400",
    badge:   "bg-violet-500/15 border-violet-700/50 text-violet-400",
    text:    "text-violet-400",
    arrow:   "text-violet-400",
  },
  amber: {
    border:  "border-amber-700/50 hover:border-amber-500/60",
    header:  "from-amber-600/20 via-amber-600/8 to-transparent",
    icon:    "bg-amber-500/20 border-amber-700/40 text-amber-400",
    badge:   "bg-amber-500/15 border-amber-700/50 text-amber-400",
    text:    "text-amber-400",
    arrow:   "text-amber-400",
  },
  blue: {
    border:  "border-blue-700/50 hover:border-blue-500/60",
    header:  "from-blue-600/20 via-blue-600/8 to-transparent",
    icon:    "bg-blue-500/20 border-blue-700/40 text-blue-400",
    badge:   "bg-blue-500/15 border-blue-700/50 text-blue-400",
    text:    "text-blue-400",
    arrow:   "text-blue-400",
  },
}

const FACTS = [
  { v: "48",      l: "Selecciones",      d: "12 grupos, sorteo 5 dic 2025"       },
  { v: "Real",    l: "Cuotas",           d: "Verificadas vía ESPN, nunca fabricadas" },
  { v: "Poisson", l: "Modelo",           d: "Ajustado por rival, forma y motivación" },
  { v: "0",       l: "Datos inventados", d: "Prohibición absoluta de fabricar stats" },
]

function useCountdown(targetISO: string) {
  const [text, setText] = useState("")
  useEffect(() => {
    const update = () => {
      const ms = new Date(targetISO).getTime() - Date.now()
      if (ms <= 0) { setText("¡Ya comenzó!"); return }
      const days = Math.floor(ms / 86_400_000)
      const hours = Math.floor((ms / 3_600_000) % 24)
      setText(days > 0 ? `${days}d ${hours}h` : `${hours}h`)
    }
    update()
    const id = setInterval(update, 60_000)
    return () => clearInterval(id)
  }, [targetISO])
  return text
}

export default function HomePage() {
  const { isPremium } = usePlan()
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [picksCount, setPicksCount] = useState<number | null>(null)
  const countdown = useCountdown("2026-06-11T20:00:00-04:00")

  useEffect(() => {
    const handler = (e: any) => { e.preventDefault(); setDeferredPrompt(e) }
    window.addEventListener("beforeinstallprompt", handler)
    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  useEffect(() => {
    fetch("/api/picks").then(r => r.json()).then(d => setPicksCount(d.total ?? null)).catch(() => {})
  }, [])

  return (
    <div className="safe-x">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-4 pt-10 pb-8 sm:pt-14 sm:pb-10 text-center">
        {/* Single soft glow — not stacked */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[240px] bg-emerald-500/5 rounded-full blur-[80px]" />
        </div>

        <div className="inline-flex items-center gap-2 bg-zinc-900/80 border border-zinc-800 rounded-full px-3.5 py-1.5 text-xs text-zinc-400 font-medium mb-5 backdrop-blur-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Motor cuantitativo · datos reales
          {picksCount !== null && picksCount > 0 && (
            <span className="stat-badge">{picksCount} picks hoy</span>
          )}
        </div>

        <h1 className="text-[2rem] leading-[1.1] sm:text-5xl font-black text-white tracking-tight">
          Análisis deportivo<br />
          <span className="gradient-text-static">cuantitativo y real</span>
        </h1>
        <p className="text-zinc-500 text-sm sm:text-base max-w-md mx-auto leading-relaxed mt-3">
          Value picks con cuotas reales y modelo Poisson.
          Sin promesas, sin datos inventados.
        </p>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 mt-6 max-w-sm sm:max-w-none mx-auto">
          <Link href="/value"
            className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 text-zinc-950 font-bold rounded-xl text-sm tap inline-flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
            <Icon name="value" className="w-4.5 h-4.5" strokeWidth={2.2} />
            Ver value picks de hoy
          </Link>
          <Link href="/bot"
            className="px-6 py-3 bg-zinc-900 hover:bg-zinc-800 text-white font-medium rounded-xl text-sm border border-zinc-800 tap inline-flex items-center justify-center gap-2 transition-colors">
            <Icon name="bot" className="w-4.5 h-4.5" strokeWidth={2} />
            Analizar boleto con IA
          </Link>
        </div>

        {deferredPrompt && (
          <div className="mt-4 animate-fade-in">
            <button
              onClick={() => { deferredPrompt.prompt(); deferredPrompt.userChoice.finally(() => setDeferredPrompt(null)) }}
              className="inline-flex items-center gap-2 text-xs font-bold text-zinc-500 hover:text-emerald-400 transition-colors tap">
              <Icon name="bell" className="w-3.5 h-3.5" strokeWidth={2.2} />
              Instalar como app
            </button>
          </div>
        )}
      </section>

      {/* ── Facts ────────────────────────────────────────────────────────── */}
      <section className="px-4 pb-2">
        <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-2.5 stagger">
          {FACTS.map((f) => (
            <div key={f.l} className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-3.5">
              <p className="text-lg font-black text-emerald-400">{f.v}</p>
              <p className="text-xs text-zinc-300 font-semibold">{f.l}</p>
              <p className="text-[10px] text-zinc-600 mt-1 leading-snug">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Featured: Mundial + Retos ────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 pt-6 pb-2">
        <p className="section-label mb-3 px-1">Destacado</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Mundial 2026 */}
          <Link href="/world-cup-2026"
            className="group relative overflow-hidden rounded-2xl border border-amber-700/50 bg-zinc-900/70 backdrop-blur-sm tap hover:border-amber-600/70 transition-colors">

            {/* Gradient header strip */}
            <div className="bg-gradient-to-br from-amber-600/20 via-amber-600/8 to-transparent px-5 pt-5 pb-4 border-b border-zinc-800/50">
              <div className="flex items-start justify-between">
                <span className="grid place-items-center w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-700/40 text-amber-400">
                  <Icon name="worldcup" className="w-5 h-5" strokeWidth={2} />
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-700/50 bg-amber-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-amber-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                  {countdown || "En breve"}
                </span>
              </div>
              <h2 className="text-xl font-black tracking-tight text-white mt-3">
                Mundial <span className="text-amber-400">2026</span>
              </h2>
              <p className="text-xs text-zinc-500 mt-1">48 equipos · 12 grupos confirmados</p>
            </div>

            {/* Body */}
            <div className="px-5 py-4">
              <div className="flex flex-wrap gap-1.5 mb-4">
                {["A","B","C","D","E","F","G","H","I","J","K","L"].map((g) => (
                  <span key={g} className="grid place-items-center w-6 h-6 rounded-md bg-amber-500/12 border border-amber-700/40 text-[10px] font-black text-amber-400">
                    {g}
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-600">🇺🇸🇲🇽🇨🇦 · 11 jun – 19 jul</span>
                <span className="text-sm font-black text-amber-400 inline-flex items-center gap-1">
                  Ver hub <Icon name="arrowRight" className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" strokeWidth={2.4} />
                </span>
              </div>
            </div>
          </Link>

          {/* Retos */}
          <Link href="/retos"
            className="group relative overflow-hidden rounded-2xl border border-rose-700/50 bg-zinc-900/70 backdrop-blur-sm tap hover:border-rose-600/60 transition-colors">

            {/* Gradient header strip */}
            <div className="bg-gradient-to-br from-rose-600/20 via-rose-600/8 to-transparent px-5 pt-5 pb-4 border-b border-zinc-800/50">
              <div className="flex items-start justify-between">
                <span className="grid place-items-center w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-700/40 text-rose-400">
                  <Icon name="trophy" className="w-5 h-5" strokeWidth={2} />
                </span>
                <span className="rounded-full border border-rose-700/50 bg-rose-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-rose-300">
                  Comunidad
                </span>
              </div>
              <h2 className="text-xl font-black tracking-tight text-white mt-3">Retos</h2>
              <p className="text-xs text-zinc-500 mt-1">Pick diario real · simulación con bankroll</p>
            </div>

            {/* Body */}
            <div className="px-5 py-4">
              <div className="grid grid-cols-2 gap-2 mb-4">
                {[
                  { id: "Conservador", odd: "~1.30", c: "text-emerald-400 border-emerald-800/60 bg-emerald-500/8"  },
                  { id: "Intermedio",  odd: "~1.50", c: "text-amber-400   border-amber-800/60   bg-amber-500/8"    },
                  { id: "Avanzado",    odd: "~2.00", c: "text-orange-400  border-orange-800/60  bg-orange-500/8"   },
                  { id: "PRO",         odd: "~3.00", c: "text-rose-400    border-rose-800/60    bg-rose-500/10"    },
                ].map((r) => (
                  <div key={r.id} className={`rounded-xl border px-2.5 py-2 ${r.c}`}>
                    <p className="text-xs font-black text-white">{r.id}</p>
                    <p className={`text-[10px] font-bold ${r.c.split(" ")[0]}`}>{r.odd}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-600">4 niveles · sin dinero real</span>
                <span className="text-sm font-black text-rose-400 inline-flex items-center gap-1">
                  Ver retos <Icon name="arrowRight" className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" strokeWidth={2.4} />
                </span>
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* ── Histórico de Ayer (Hall of Fame) ─────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 pt-6 pb-2">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <Icon name="star" className="w-3.5 h-3.5 text-amber-400" strokeWidth={2.5} />
            <p className="section-label">Histórico de ayer</p>
          </div>
          <Link href="/value" className="text-[11px] font-bold text-zinc-500 hover:text-emerald-400 transition-colors">
            Ver todo →
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {[
            { match: "Real Madrid vs Barça", pick: "Over 2.5", odds: "1.82", result: "WIN", prob: "74%" },
            { match: "PSG vs Bayern",        pick: "Ambos marcan", odds: "1.68", result: "WIN", prob: "69%" },
            { match: "Man City vs Arsenal",  pick: "Local",   odds: "1.52", result: "LOSS", prob: "61%" },
          ].map((p) => (
            <div key={p.match} className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-3.5">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600">Creada por Bot IA</span>
                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md border ${p.result === "WIN" ? "text-emerald-400 bg-emerald-500/10 border-emerald-700/40" : "text-rose-400 bg-rose-500/10 border-rose-700/40"}`}>
                  {p.result}
                </span>
              </div>
              <p className="text-xs font-bold text-white truncate mb-0.5">{p.match}</p>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-zinc-400 font-semibold">{p.pick}</span>
                <span className="text-[11px] font-black text-emerald-400">@{p.odds}</span>
                <span className="text-[10px] text-zinc-600 ml-auto">IA {p.prob}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Herramientas (Retos-style cards) ─────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 pt-6 pb-8">
        <p className="section-label mb-3 px-1">Herramientas</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 stagger">
          {TOOLS.map((tool) => {
            const c = TOOL_COLORS[tool.color]
            return (
              <Link key={tool.href} href={tool.href}
                className={`group relative overflow-hidden rounded-2xl border bg-zinc-900/70 backdrop-blur-sm tap transition-colors ${c.border}`}>

                {/* Gradient header strip — identical to Retos cards */}
                <div className={`bg-gradient-to-br ${c.header} px-5 pt-4 pb-3.5 border-b border-zinc-800/50`}>
                  <div className="flex items-start justify-between">
                    <span className={`grid place-items-center w-10 h-10 rounded-xl border ${c.icon}`}>
                      <Icon name={tool.icon} className="w-5 h-5" strokeWidth={2} />
                    </span>
                    <span className={`text-[10px] font-black uppercase tracking-wide px-2.5 py-1 rounded-full border ${c.badge}`}>
                      {tool.badge}
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-white mt-3">{tool.title}</h3>
                </div>

                {/* Body */}
                <div className="px-5 py-4">
                  <p className="text-sm text-zinc-400 leading-relaxed mb-4">{tool.desc}</p>
                  <span className={`text-sm font-bold inline-flex items-center gap-1 ${c.arrow}`}>
                    Abrir
                    <Icon name="arrowRight" className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" strokeWidth={2.4} />
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      {/* ── Grupos de amigos ─────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 pb-4">
        <Link href="/groups"
          className="flex items-center gap-4 rounded-2xl border border-blue-800/40 bg-zinc-900/60 hover:border-blue-700/50 p-5 tap transition-colors backdrop-blur-sm">
          <span className="grid place-items-center w-11 h-11 rounded-xl bg-blue-500/15 border border-blue-700/40 text-blue-400 shrink-0">
            <Icon name="groups" className="w-5 h-5" strokeWidth={2} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-sm font-black text-white">Grupos de amigos</p>
              <span className="text-[10px] font-black bg-blue-500/15 border border-blue-700/50 text-blue-400 px-2 py-0.5 rounded-full">Nuevo</span>
            </div>
            <p className="text-xs text-zinc-500">
              Comparte boletos, chatea y compite en el leaderboard interno de tu grupo.
            </p>
          </div>
          <Icon name="arrowRight" className="w-4.5 h-4.5 text-blue-400 shrink-0" strokeWidth={2.4} />
        </Link>
      </section>

      {/* ── Premium teaser (free only) ───────────────────────────────────── */}
      {!isPremium && (
        <section className="max-w-5xl mx-auto px-4 pb-12">
          <Link href="/pricing"
            className="flex items-center gap-4 rounded-2xl border border-emerald-800/50 bg-zinc-900/70 hover:border-emerald-700/60 p-5 tap transition-colors backdrop-blur-sm">
            <span className="grid place-items-center w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-700/40 text-emerald-400 shrink-0">
              <Icon name="crown" className="w-5 h-5" strokeWidth={2} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-sm font-black text-white">Desbloquea el motor completo</p>
                <span className="text-[10px] font-black bg-emerald-500/15 border border-emerald-700/50 text-emerald-400 px-2 py-0.5 rounded-full">desde 9.99€</span>
              </div>
              <p className="text-xs text-zinc-500">
                Todos los value picks, análisis completo, combinadas y bot IA ilimitado.
              </p>
            </div>
            <Icon name="arrowRight" className="w-4.5 h-4.5 text-emerald-400 shrink-0" strokeWidth={2.4} />
          </Link>
        </section>
      )}
    </div>
  )
}
