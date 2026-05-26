"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Icon } from "@/components/ui/icons"
import { usePlan } from "@/lib/plan"

// Sections that appear in the regular tools grid (Retos removed — featured above)
const SECTIONS = [
  {
    href: "/value", icon: "value", accent: "emerald",
    badge: "Diario", badgeColor: "text-emerald-400 bg-emerald-500/10 border-emerald-800/60",
    title: "Value Picks",
    desc: "Picks donde el modelo Poisson supera a la cuota real de DraftKings. Edge real, con contexto de motivación.",
    highlights: ["Cuotas reales verificadas", "Modelo ajustado por rival", "Score de calidad"],
    iconBg: "bg-emerald-500/15 text-emerald-400",
    grad: "from-emerald-600/12 to-emerald-900/5 border-emerald-800/40",
    dotColor: "bg-emerald-400",
    textColor: "text-emerald-400",
  },
  {
    href: "/bot", icon: "bot", accent: "violet",
    badge: "IA", badgeColor: "text-violet-400 bg-violet-500/10 border-violet-800/60",
    title: "Bot IA",
    desc: "Sube la foto de tu boleto y el bot lo analiza con datos reales de ESPN: clasificación, forma y H2H.",
    highlights: ["Visión IA con Claude", "Datos reales de ESPN", "Veredicto pick a pick"],
    iconBg: "bg-violet-500/15 text-violet-400",
    grad: "from-violet-600/12 to-violet-900/5 border-violet-800/40",
    dotColor: "bg-violet-400",
    textColor: "text-violet-400",
  },
  {
    href: "/combinadas", icon: "combinadas", accent: "amber",
    badge: "Generador", badgeColor: "text-amber-400 bg-amber-500/10 border-amber-800/60",
    title: "Combinadas",
    desc: "Elige liga y perfil de riesgo. El sistema arma la combinada con cuotas reales y el mismo motor cuantitativo.",
    highlights: ["Segura · Balanceada · Soñadora", "Cuota real por pata", "Probabilidad del modelo"],
    iconBg: "bg-amber-500/15 text-amber-400",
    grad: "from-amber-600/12 to-amber-900/5 border-amber-800/40",
    dotColor: "bg-amber-400",
    textColor: "text-amber-400",
  },
  {
    href: "/stats", icon: "stats", accent: "blue",
    badge: "Búsqueda", badgeColor: "text-blue-400 bg-blue-500/10 border-blue-800/60",
    title: "Estadísticas",
    desc: "Busca cualquier equipo de las grandes ligas: forma, BTTS, Over/Under y rendimiento local/visitante.",
    highlights: ["Datos reales de ESPN", "Temporada en curso", "Local vs visitante"],
    iconBg: "bg-blue-500/15 text-blue-400",
    grad: "from-blue-600/12 to-blue-900/5 border-blue-800/40",
    dotColor: "bg-blue-400",
    textColor: "text-blue-400",
  },
]

const FACTS = [
  { v: "48",     l: "Selecciones",      d: "12 grupos, sorteo confirmado 5 dic 2025" },
  { v: "Real",   l: "Cuotas",           d: "Verificadas vía ESPN, nunca fabricadas" },
  { v: "Poisson",l: "Modelo",           d: "Ajustado por rival, forma y motivación" },
  { v: "0",      l: "Datos inventados", d: "Prohibición absoluta de fabricar estadísticas" },
]

// ─── Countdown helper ─────────────────────────────────────────────────────────
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

// ─── Page ─────────────────────────────────────────────────────────────────────

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
    fetch("/api/picks")
      .then(r => r.json())
      .then(d => setPicksCount(d.total ?? null))
      .catch(() => {})
  }, [])

  function installPWA() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    deferredPrompt.userChoice.finally(() => setDeferredPrompt(null))
  }

  const today = new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })

  return (
    <div className="safe-x">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden px-4 pt-10 pb-8 sm:pt-16 sm:pb-12 text-center mesh-bg">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-emerald-500/6 rounded-full blur-[80px]" />
          <div className="absolute top-10 left-1/4 w-[200px] h-[200px] bg-cyan-500/5 rounded-full blur-[60px]" />
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
          <span className="gradient-text">cuantitativo y real</span>
        </h1>
        <p className="text-zinc-400 text-sm sm:text-base max-w-lg mx-auto leading-relaxed mt-4">
          Value picks con cuotas reales, modelo estadístico Poisson y motor de motivación.
          Sin promesas, sin datos inventados — solo análisis con fuentes verificables.
        </p>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 mt-6 max-w-sm sm:max-w-none mx-auto">
          <Link href="/value"
            className="px-6 py-3.5 bg-gradient-to-r from-emerald-500 to-cyan-500 text-zinc-950 font-bold rounded-xl text-sm tap inline-flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
            <Icon name="value" className="w-4.5 h-4.5" strokeWidth={2.2} />
            Ver value picks de hoy
          </Link>
          <Link href="/bot"
            className="px-6 py-3.5 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold rounded-xl text-sm border border-zinc-800 tap inline-flex items-center justify-center gap-2 transition-colors">
            <Icon name="bot" className="w-4.5 h-4.5" strokeWidth={2.2} />
            Analizar boleto con IA
          </Link>
        </div>

        {deferredPrompt && (
          <div className="mt-5 animate-fade-in">
            <button onClick={installPWA}
              className="inline-flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-emerald-400 transition-colors tap">
              <Icon name="bell" className="w-3.5 h-3.5" strokeWidth={2.2} />
              Instalar como app
            </button>
          </div>
        )}
        <p className="mt-4 text-xs text-zinc-600 capitalize">{today}</p>
      </section>

      {/* ── Facts strip ── */}
      <section className="px-4 py-5">
        <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-2.5 stagger">
          {FACTS.map((f) => (
            <div key={f.l} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5 card-glow">
              <p className="text-lg font-black text-emerald-400">{f.v}</p>
              <p className="text-xs text-zinc-300 font-semibold">{f.l}</p>
              <p className="text-[10px] text-zinc-600 mt-1 leading-snug">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          FEATURED: World Cup 2026 + Retos — tarjetas hero prominentes
          ════════════════════════════════════════════════════════════════════ */}
      <section className="max-w-5xl mx-auto px-4 pb-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-3 px-1">Destacado</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* ── Mundial 2026 ── */}
          <Link href="/world-cup-2026"
            className="group relative overflow-hidden rounded-3xl border border-amber-700/50 bg-gradient-to-br from-amber-600/15 via-zinc-900/80 to-zinc-950 backdrop-blur-sm p-5 tap hover:border-amber-600/70 transition-colors">
            {/* Glow blobs */}
            <div className="pointer-events-none absolute inset-0 rounded-3xl overflow-hidden">
              <div className="absolute -top-10 -right-6 w-40 h-40 bg-amber-500/20 rounded-full blur-[50px]" />
              <div className="absolute -bottom-12 -left-6 w-44 h-44 bg-yellow-500/10 rounded-full blur-[60px]" />
            </div>

            <div className="relative">
              {/* Header row */}
              <div className="flex items-start justify-between mb-4">
                <span className="grid place-items-center w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/25 to-yellow-600/15 border border-amber-700/40 text-amber-300 shadow-[0_0_18px_rgba(245,158,11,0.25)]">
                  <Icon name="worldcup" className="w-6 h-6" strokeWidth={2} />
                </span>
                <div className="text-right">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-700/50 bg-amber-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-amber-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                    {countdown || "16d"}
                  </span>
                </div>
              </div>

              <h2 className="text-2xl font-black tracking-tight text-white leading-[1.1] mb-1">
                Mundial <span className="bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-200 bg-clip-text text-transparent">2026</span>
              </h2>
              <p className="text-sm text-zinc-400 leading-relaxed mb-4">
                48 selecciones · 12 grupos confirmados. Grupos, árbitros élite, dark horses y motor ajustado al contexto internacional.
              </p>

              {/* Group badges preview */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {["A","B","C","D","E","F","G","H","I","J","K","L"].map((g) => (
                  <span key={g} className="grid place-items-center w-6 h-6 rounded-md bg-amber-500/15 border border-amber-700/40 text-[10px] font-black text-amber-400">
                    {g}
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-zinc-800/60">
                <span className="text-xs text-zinc-500">🇺🇸🇲🇽🇨🇦 · 11 jun – 19 jul</span>
                <span className="text-sm font-black text-amber-300 inline-flex items-center gap-1">
                  Ver hub
                  <Icon name="arrowRight" className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" strokeWidth={2.4} />
                </span>
              </div>
            </div>
          </Link>

          {/* ── Retos ── */}
          <Link href="/retos"
            className="group relative overflow-hidden rounded-3xl border border-rose-700/50 bg-gradient-to-br from-rose-600/12 via-zinc-900/80 to-zinc-950 backdrop-blur-sm p-5 tap hover:border-rose-600/60 transition-colors">
            {/* Glow blobs */}
            <div className="pointer-events-none absolute inset-0 rounded-3xl overflow-hidden">
              <div className="absolute -top-10 -right-6 w-40 h-40 bg-rose-500/15 rounded-full blur-[50px]" />
              <div className="absolute -bottom-12 -left-6 w-44 h-44 bg-orange-500/8 rounded-full blur-[60px]" />
            </div>

            <div className="relative">
              {/* Header row */}
              <div className="flex items-start justify-between mb-4">
                <span className="grid place-items-center w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500/20 to-orange-600/10 border border-rose-700/40 text-rose-300 shadow-[0_0_18px_rgba(244,63,94,0.2)]">
                  <Icon name="trophy" className="w-6 h-6" strokeWidth={2} />
                </span>
                <span className="rounded-full border border-rose-700/50 bg-rose-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-rose-300">
                  Comunidad
                </span>
              </div>

              <h2 className="text-2xl font-black tracking-tight text-white leading-[1.1] mb-1">Retos</h2>
              <p className="text-sm text-zinc-400 leading-relaxed mb-4">
                Desafíos de seguimiento estadístico con pick diario real. Cada nivel simula un bankroll distinto para que veas cómo funciona el modelo.
              </p>

              {/* Reto levels preview */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                {[
                  { id: "Conservador", odd: "~1.30", days: "10d", color: "text-emerald-400 border-emerald-800/60 bg-emerald-500/8" },
                  { id: "Intermedio",  odd: "~1.50", days: "10d", color: "text-amber-400 border-amber-800/60 bg-amber-500/8" },
                  { id: "Avanzado",    odd: "~2.00", days: "5d",  color: "text-orange-400 border-orange-800/60 bg-orange-500/8" },
                  { id: "PRO",         odd: "~3.00", days: "5d",  color: "text-rose-400 border-rose-800/60 bg-rose-500/10" },
                ].map((r) => (
                  <div key={r.id} className={`rounded-xl border ${r.color} px-2.5 py-2`}>
                    <p className="text-xs font-black text-white">{r.id}</p>
                    <p className={`text-[10px] font-bold ${r.color.split(" ")[0]}`}>{r.odd} · {r.days}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-zinc-800/60">
                <span className="text-xs text-zinc-500">Pick diario · simulación con 10€</span>
                <span className="text-sm font-black text-rose-300 inline-flex items-center gap-1">
                  Ver retos
                  <Icon name="arrowRight" className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" strokeWidth={2.4} />
                </span>
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* ── Regular tools grid ── */}
      <section className="max-w-5xl mx-auto px-4 pt-6 pb-8">
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-4 px-1">Herramientas</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 stagger">
          {SECTIONS.map((s) => (
            <Link key={s.href} href={s.href}
              className={`group relative rounded-2xl border bg-gradient-to-br p-5 ${s.grad} hover:scale-[1.012] transition-transform duration-200 tap card-glow`}>
              <div className="flex items-start justify-between mb-3.5">
                <span className={`grid place-items-center w-11 h-11 rounded-xl ${s.iconBg}`}>
                  <Icon name={s.icon} className="w-5.5 h-5.5" strokeWidth={2} />
                </span>
                <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${s.badgeColor}`}>
                  {s.badge}
                </span>
              </div>
              <h3 className="text-lg font-black text-white mb-1.5">{s.title}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed mb-3.5">{s.desc}</p>
              <ul className="space-y-1.5 mb-4">
                {s.highlights.map((h) => (
                  <li key={h} className="flex items-center gap-2 text-xs text-zinc-500">
                    <span className={`h-1 w-1 rounded-full ${s.dotColor}`} />{h}
                  </li>
                ))}
              </ul>
              <span className={`text-sm font-bold ${s.textColor} inline-flex items-center gap-1`}>
                Abrir
                <Icon name="arrowRight" className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" strokeWidth={2.4} />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Premium teaser (only for free users) ── */}
      {!isPremium && (
        <section className="max-w-5xl mx-auto px-4 pb-12">
          <Link href="/pricing"
            className="block relative overflow-hidden rounded-2xl border border-emerald-800/50 bg-gradient-to-br from-emerald-600/12 to-cyan-900/6 p-6 tap card-glow animate-border-glow">
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
              <div className="absolute -top-10 -right-10 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl" />
            </div>
            <div className="relative flex items-center gap-4">
              <span className="grid place-items-center w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0 animate-glow-pulse">
                <Icon name="crown" className="w-6 h-6" strokeWidth={2} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-base font-black text-white">Desbloquea el motor completo</p>
                  <span className="text-[10px] font-black bg-gradient-to-r from-emerald-500 to-cyan-500 text-zinc-950 px-2 py-0.5 rounded-full">desde 9.99€</span>
                </div>
                <p className="text-sm text-zinc-400 leading-snug">
                  Todos los value picks, análisis completo, combinadas y bot IA ilimitado.
                </p>
              </div>
              <Icon name="arrowRight" className="w-5 h-5 text-emerald-400 shrink-0" strokeWidth={2.4} />
            </div>
          </Link>
        </section>
      )}
    </div>
  )
}
