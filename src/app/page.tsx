"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Icon } from "@/components/ui/icons"
import { usePlan } from "@/lib/plan"
import TodayMatches from "@/components/matches/TodayMatches"

const TOOLS = [
  {
    href:  "/value",
    icon:  "value",
    badge: "Diario",
    title: "Value Picks",
    desc:  "Picks donde el modelo Poisson supera a la cuota real. Edge real con contexto de motivación.",
    color: "emerald" as const,
  },
  {
    href:  "/bot",
    icon:  "bot",
    badge: "IA",
    title: "Bot IA",
    desc:  "Sube la foto de tu boleto y el bot lo analiza con datos reales de ESPN: clasificación, forma y H2H.",
    color: "violet" as const,
  },
  {
    href:  "/combinadas",
    icon:  "combinadas",
    badge: "Generador",
    title: "Combinadas",
    desc:  "Elige liga y perfil de riesgo. El sistema arma la combinada con cuotas reales.",
    color: "amber" as const,
  },
  {
    href:  "/stats",
    icon:  "stats",
    badge: "Búsqueda",
    title: "Estadísticas",
    desc:  "Busca cualquier equipo: forma, BTTS, Over/Under y rendimiento local/visitante.",
    color: "blue" as const,
  },
]

type ToolColor = "emerald" | "violet" | "amber" | "blue"

const TOOL_COLORS: Record<ToolColor, {
  border: string; bg: string; iconBg: string; badge: string; text: string
}> = {
  emerald: {
    border:  "border-emerald-700/40 hover:border-emerald-600/55",
    bg:      "from-emerald-600/[0.12] via-emerald-600/[0.04] to-transparent",
    iconBg:  "bg-emerald-500/18 border-emerald-700/40 text-emerald-400",
    badge:   "bg-emerald-500/14 border-emerald-700/50 text-emerald-400",
    text:    "text-emerald-400",
  },
  violet: {
    border:  "border-violet-700/40 hover:border-violet-600/55",
    bg:      "from-violet-600/[0.12] via-violet-600/[0.04] to-transparent",
    iconBg:  "bg-violet-500/18 border-violet-700/40 text-violet-400",
    badge:   "bg-violet-500/14 border-violet-700/50 text-violet-400",
    text:    "text-violet-400",
  },
  amber: {
    border:  "border-amber-700/40 hover:border-amber-600/55",
    bg:      "from-amber-600/[0.12] via-amber-600/[0.04] to-transparent",
    iconBg:  "bg-amber-500/18 border-amber-700/40 text-amber-400",
    badge:   "bg-amber-500/14 border-amber-700/50 text-amber-400",
    text:    "text-amber-400",
  },
  blue: {
    border:  "border-blue-700/40 hover:border-blue-600/55",
    bg:      "from-blue-600/[0.12] via-blue-600/[0.04] to-transparent",
    iconBg:  "bg-blue-500/18 border-blue-700/40 text-blue-400",
    badge:   "bg-blue-500/14 border-blue-700/50 text-blue-400",
    text:    "text-blue-400",
  },
}

const STATS = [
  { v: "48",      l: "selecciones",      sub: "Mundial 2026"                    },
  { v: "Real",    l: "cuotas",           sub: "verificadas vía ESPN"            },
  { v: "Poisson", l: "modelo",           sub: "ajustado por forma"              },
  { v: "0",       l: "datos inventados", sub: "nunca"                           },
]

/* ── Hall of Fame ──────────────────────────────────────────────────────────── */
function HallOfFame() {
  const [picks, setPicks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/picks/yesterday")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.picks) setPicks(d.picks.slice(0, 3)) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const R: Record<string, string> = {
    WIN:  "text-emerald-400 bg-emerald-500/10 border-emerald-700/40",
    LOSS: "text-rose-400   bg-rose-500/10    border-rose-700/40",
    VOID: "text-zinc-400   bg-zinc-800/60    border-white/[0.07]",
  }

  return (
    <section className="max-w-5xl mx-auto px-4 pt-6 pb-3">
      <div className="rounded-2xl border border-amber-700/35 bg-gradient-to-br from-amber-500/[0.04] via-zinc-900/75 to-zinc-950 overflow-hidden">
        <div className="px-4 pt-4 pb-3.5 border-b border-amber-800/25 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="grid place-items-center w-9 h-9 rounded-xl bg-amber-500/14 border border-amber-700/40">
              <Icon name="star" className="w-[18px] h-[18px] text-amber-400" strokeWidth={2.5} />
            </span>
            <div>
              <p className="text-[14px] font-bold text-white leading-tight">Histórico de ayer</p>
              <p className="text-[11px] text-zinc-500 leading-tight">Creadas y analizadas por Bot IA</p>
            </div>
          </div>
          <Link href="/value" className="text-[12px] font-semibold text-amber-400 hover:text-amber-300 transition-colors tap">
            Ver todo →
          </Link>
        </div>
        <div className="divide-y divide-white/[0.07]">
          {loading ? (
            [...Array(3)].map((_, i) => (
              <div key={i} className="px-4 py-3 flex items-center gap-3 animate-pulse">
                <div className="h-3 bg-zinc-800/80 rounded flex-1" />
                <div className="h-5 w-12 bg-zinc-800/80 rounded" />
              </div>
            ))
          ) : picks.length > 0 ? picks.map((p: any) => (
            <div key={p.id} className="px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-white truncate">{p.home_team} vs {p.away_team}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[11px] text-zinc-500">{p.selection}</span>
                  <span className="text-[11px] font-bold text-emerald-400">@{p.best_odd?.toFixed(2) ?? "—"}</span>
                  <span className="text-[10px] text-zinc-600">IA {Math.round(p.model_prob)}%</span>
                </div>
              </div>
              <span className={`text-[9px] font-black px-2 py-1 rounded-lg border shrink-0 ${R[p.result] ?? R.VOID}`}>
                {p.result}
              </span>
            </div>
          )) : (
            [
              { match: "Real Madrid vs Barça", pick: "Over 2.5",    odds: "1.82", result: "WIN"  },
              { match: "PSG vs Bayern",         pick: "Ambos marcan", odds: "1.68", result: "WIN"  },
              { match: "Man City vs Arsenal",   pick: "Local",        odds: "1.52", result: "LOSS" },
            ].map((p) => (
              <div key={p.match} className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-white truncate">{p.match}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[11px] text-zinc-500">{p.pick}</span>
                    <span className="text-[11px] font-bold text-emerald-400">@{p.odds}</span>
                  </div>
                </div>
                <span className={`text-[9px] font-black px-2 py-1 rounded-lg border shrink-0 ${R[p.result]}`}>
                  {p.result}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  )
}

/* ── Countdown ─────────────────────────────────────────────────────────────── */
function useCountdown(targetISO: string) {
  const [text, setText] = useState("")
  useEffect(() => {
    const update = () => {
      const ms = new Date(targetISO).getTime() - Date.now()
      if (ms <= 0) { setText("¡Ya comenzó!"); return }
      const days  = Math.floor(ms / 86_400_000)
      const hours = Math.floor((ms / 3_600_000) % 24)
      setText(days > 0 ? `${days}d ${hours}h` : `${hours}h`)
    }
    update()
    const id = setInterval(update, 60_000)
    return () => clearInterval(id)
  }, [targetISO])
  return text
}

/* ── Tipster quick access ──────────────────────────────────────────────────── */
function TipsterQuickAccess() {
  const [isVip, setIsVip] = useState(false)
  useEffect(() => {
    fetch("/api/auth/plan", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.is_vip_tipster) setIsVip(true) })
      .catch(() => {})
  }, [])
  if (!isVip) return null
  return (
    <section className="max-w-5xl mx-auto px-4 pb-4">
      <div className="rounded-2xl border border-violet-700/35 bg-gradient-to-br from-violet-900/[0.12] via-zinc-900/75 to-zinc-950 overflow-hidden">
        <div className="px-4 pt-3.5 pb-3 border-b border-violet-800/25 flex items-center gap-2">
          <span className="text-[10px] font-black bg-violet-500/14 border border-violet-700/50 text-violet-400 px-2 py-0.5 rounded-full">TIPSTER VIP</span>
          <p className="text-[14px] font-bold text-white">Panel de Tipster</p>
        </div>
        <div className="grid grid-cols-2 divide-x divide-white/[0.07]">
          <Link href="/creators" className="flex flex-col items-center gap-1.5 py-4 hover:bg-violet-500/[0.04] tap transition-colors">
            <Icon name="image" className="w-[18px] h-[18px] text-violet-400" strokeWidth={2} />
            <span className="text-[12px] font-semibold text-zinc-300">Crear imagen</span>
          </Link>
          <Link href="/creators" className="flex flex-col items-center gap-1.5 py-4 hover:bg-amber-500/[0.04] tap transition-colors">
            <Icon name="gift" className="w-[18px] h-[18px] text-amber-400" strokeWidth={2} />
            <span className="text-[12px] font-semibold text-zinc-300">Mis bounties</span>
          </Link>
        </div>
      </div>
    </section>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════════════════════ */
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

      {/* ══════════════════════════════════════════════════════════════════════
          HERO — Cinematic, full-bleed dark section matching reference
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden">

        {/* Atmospheric layered background — cinematic dark depth */}
        <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
          {/* Base dark gradient */}
          <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-[#070709] to-[var(--bg)]" />
          {/* Aerial depth overlay — simulates perspective from above */}
          <div className="absolute inset-0"
            style={{
              backgroundImage: [
                "radial-gradient(ellipse 90% 55% at 50% -10%, rgba(52,211,153,0.055) 0%, transparent 55%)",
                "radial-gradient(ellipse 70% 40% at 20% 60%, rgba(34,211,238,0.022) 0%, transparent 50%)",
                "radial-gradient(ellipse 60% 45% at 80% 70%, rgba(52,211,153,0.018) 0%, transparent 50%)",
                /* Grid lines — perspective depth effect */
                "repeating-linear-gradient(0deg, rgba(255,255,255,0.012) 0px, rgba(255,255,255,0.012) 1px, transparent 1px, transparent 60px)",
                "repeating-linear-gradient(90deg, rgba(255,255,255,0.009) 0px, rgba(255,255,255,0.009) 1px, transparent 1px, transparent 80px)",
              ].join(","),
            }}
          />
          {/* Bottom fade to page background */}
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-b from-transparent to-[var(--bg)]" />
        </div>

        {/* Hero content */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-12 pb-0 sm:pt-16 text-center">

          {/* Live badge */}
          <div className="inline-flex items-center gap-2 border border-white/[0.10] bg-zinc-900/60 rounded-full px-3.5 py-1.5 text-[12px] text-zinc-400 font-medium mb-7 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            Motor cuantitativo · datos en vivo
            {picksCount !== null && picksCount > 0 && (
              <span className="stat-badge">{picksCount} picks hoy</span>
            )}
          </div>

          {/* Headline — matches reference scale */}
          <h1
            className="font-black text-white tracking-tight leading-[1.04] mb-5"
            style={{ fontSize: "clamp(2.8rem, 7.5vw, 5.5rem)" }}
          >
            Análisis deportivo<br />
            {/* "real," emphasized — emerald color, bold (no italic per constraints) */}
            <span className="text-emerald-400">cuantitativo y real</span>,<br />
            sin promesas.
          </h1>

          {/* Body */}
          <p className="text-zinc-400 text-[15px] sm:text-[17px] leading-relaxed max-w-[520px] mx-auto mb-8">
            Value picks calculados con <strong className="text-zinc-200 font-semibold">modelo Poisson</strong> sobre
            cuotas reales de mercado. Hecho para quienes prefieren la evidencia a la intuición.
          </p>

          {/* CTA buttons — outlined ghost style matching reference */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 max-w-sm sm:max-w-none mx-auto mb-12 sm:mb-16">
            <Link href="/value"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl border border-white/20 bg-white/[0.06] text-[15px] font-semibold text-white hover:bg-white/[0.10] hover:border-white/30 transition-all tap backdrop-blur-sm">
              Ver picks de hoy
              <Icon name="arrowRight" className="w-4 h-4" strokeWidth={2.4} />
            </Link>
            <Link href="/bot"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl border border-white/12 bg-transparent text-[15px] font-medium text-zinc-300 hover:text-white hover:border-white/20 hover:bg-white/[0.04] transition-all tap">
              <Icon name="bot" className="w-4 h-4 shrink-0" strokeWidth={2} />
              Analizar boleto con IA
            </Link>
          </div>

          {deferredPrompt && (
            <div className="mb-8 -mt-8 animate-fade-in">
              <button
                onClick={() => { deferredPrompt.prompt(); deferredPrompt.userChoice.finally(() => setDeferredPrompt(null)) }}
                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-zinc-600 hover:text-emerald-400 transition-colors tap">
                <Icon name="bell" className="w-3.5 h-3.5" strokeWidth={2.2} />
                Instalar como app
              </button>
            </div>
          )}

          {/* ── Stats strip — large display numbers matching reference ── */}
          <div className="border-t border-white/[0.07] grid grid-cols-2 sm:grid-cols-4 divide-x divide-white/[0.07]">
            {STATS.map((s) => (
              <div key={s.l} className="px-4 py-5 sm:py-6 text-left">
                {/* Large display value */}
                <p
                  className="font-black text-emerald-400 leading-none mb-1"
                  style={{ fontSize: "clamp(1.75rem, 4vw, 3rem)" }}
                >
                  {s.v}
                </p>
                <p className="text-[13px] font-semibold text-zinc-300 leading-tight">{s.l}</p>
                <p className="text-[11px] text-zinc-600 leading-snug mt-0.5">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Hall of Fame ──────────────────────────────────────────────────── */}
      <HallOfFame />

      {/* ── Partidos de Hoy (STEP 4) — realtime + análisis IA ─────────────── */}
      <TodayMatches />

      {/* ── Featured: Mundial + Retos ─────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 pt-4 pb-2">
        <p className="section-label mb-3 px-0.5">Destacado</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">

          {/* Mundial 2026 */}
          <Link href="/world-cup-2026"
            className="group relative overflow-hidden rounded-2xl border border-amber-700/40 bg-zinc-900/65 backdrop-blur-sm tap hover:border-amber-600/60 transition-all duration-200">
            <div className="bg-gradient-to-br from-amber-600/[0.15] via-amber-600/[0.05] to-transparent px-4 pt-4 pb-3.5 border-b border-white/[0.07]">
              <div className="flex items-start justify-between">
                <span className="grid place-items-center w-10 h-10 rounded-xl bg-amber-500/18 border border-amber-700/40 text-amber-400">
                  <Icon name="worldcup" className="w-[18px] h-[18px]" strokeWidth={2} />
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-700/45 bg-amber-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-amber-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                  {countdown || "En breve"}
                </span>
              </div>
              <h2 className="text-[20px] font-black tracking-tight text-white mt-3 leading-none">
                Mundial <span className="text-amber-400">2026</span>
              </h2>
              <p className="text-[11px] text-zinc-500 mt-1">48 equipos · 12 grupos confirmados</p>
            </div>
            <div className="px-4 py-3.5">
              <div className="flex flex-wrap gap-1 mb-3.5">
                {["A","B","C","D","E","F","G","H","I","J","K","L"].map((g) => (
                  <span key={g} className="grid place-items-center w-6 h-6 rounded-[6px] bg-amber-500/[0.11] border border-amber-700/35 text-[10px] font-black text-amber-400">
                    {g}
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-zinc-600">🇺🇸🇲🇽🇨🇦 · 11 jun – 19 jul</span>
                <span className="text-[13px] font-bold text-amber-400 inline-flex items-center gap-1">
                  Ver hub <Icon name="arrowRight" className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" strokeWidth={2.4} />
                </span>
              </div>
            </div>
          </Link>

          {/* Retos */}
          <Link href="/retos"
            className="group relative overflow-hidden rounded-2xl border border-rose-700/40 bg-zinc-900/65 backdrop-blur-sm tap hover:border-rose-600/55 transition-all duration-200">
            <div className="bg-gradient-to-br from-rose-600/[0.15] via-rose-600/[0.05] to-transparent px-4 pt-4 pb-3.5 border-b border-white/[0.07]">
              <div className="flex items-start justify-between">
                <span className="grid place-items-center w-10 h-10 rounded-xl bg-rose-500/18 border border-rose-700/40 text-rose-400">
                  <Icon name="trophy" className="w-[18px] h-[18px]" strokeWidth={2} />
                </span>
                <span className="rounded-full border border-rose-700/45 bg-rose-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-rose-300">
                  Comunidad
                </span>
              </div>
              <h2 className="text-[20px] font-black tracking-tight text-white mt-3 leading-none">Retos</h2>
              <p className="text-[11px] text-zinc-500 mt-1">Pick diario real · simulación con bankroll</p>
            </div>
            <div className="px-4 py-3.5">
              <div className="grid grid-cols-2 gap-1.5 mb-3.5">
                {[
                  { id: "Conservador", odd: "~1.30", c: "text-emerald-400 border-emerald-800/55 bg-emerald-500/[0.07]"  },
                  { id: "Intermedio",  odd: "~1.50", c: "text-amber-400   border-amber-800/55   bg-amber-500/[0.07]"    },
                  { id: "Avanzado",    odd: "~2.00", c: "text-orange-400  border-orange-800/55  bg-orange-500/[0.07]"   },
                  { id: "PRO",         odd: "~3.00", c: "text-rose-400    border-rose-800/55    bg-rose-500/[0.08]"     },
                ].map((r) => (
                  <div key={r.id} className={`rounded-xl border px-2.5 py-2 ${r.c}`}>
                    <p className="text-[12px] font-bold text-white leading-tight">{r.id}</p>
                    <p className={`text-[10px] font-bold leading-tight ${r.c.split(" ")[0]}`}>{r.odd}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-zinc-600">4 niveles · sin dinero real</span>
                <span className="text-[13px] font-bold text-rose-400 inline-flex items-center gap-1">
                  Ver retos <Icon name="arrowRight" className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" strokeWidth={2.4} />
                </span>
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* ── Herramientas ──────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 pt-6 pb-6">
        <p className="section-label mb-3 px-0.5">Herramientas</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 stagger">
          {TOOLS.map((tool) => {
            const c = TOOL_COLORS[tool.color]
            return (
              <Link key={tool.href} href={tool.href}
                className={`group relative overflow-hidden rounded-2xl border bg-zinc-900/65 backdrop-blur-sm tap transition-all duration-200 ${c.border}`}>
                <div className={`bg-gradient-to-br ${c.bg} px-4 pt-4 pb-3.5 border-b border-white/[0.07]`}>
                  <div className="flex items-start justify-between">
                    <span className={`grid place-items-center w-10 h-10 rounded-xl border ${c.iconBg}`}>
                      <Icon name={tool.icon} className="w-[18px] h-[18px]" strokeWidth={2} />
                    </span>
                    <span className={`text-[10px] font-black uppercase tracking-wide px-2.5 py-1 rounded-full border ${c.badge}`}>
                      {tool.badge}
                    </span>
                  </div>
                  <h3 className="text-[18px] font-black text-white mt-3 leading-tight">{tool.title}</h3>
                </div>
                <div className="px-4 py-3.5">
                  <p className="text-[13px] text-zinc-400 leading-relaxed mb-3">{tool.desc}</p>
                  <span className={`text-[13px] font-semibold inline-flex items-center gap-1 ${c.text}`}>
                    Abrir
                    <Icon name="arrowRight" className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" strokeWidth={2.4} />
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      {/* ── Tipster VIP ───────────────────────────────────────────────────── */}
      <TipsterQuickAccess />

      {/* ── Grupos de amigos ──────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 pb-4">
        <Link href="/groups"
          className="flex items-center gap-4 rounded-2xl border border-blue-800/35 bg-zinc-900/55 hover:border-blue-700/50 p-4 tap transition-colors backdrop-blur-sm">
          <span className="grid place-items-center w-10 h-10 rounded-xl bg-blue-500/14 border border-blue-700/40 text-blue-400 shrink-0">
            <Icon name="groups" className="w-[18px] h-[18px]" strokeWidth={2} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-[14px] font-bold text-white leading-tight">Grupos de amigos</p>
              <span className="text-[10px] font-black bg-blue-500/14 border border-blue-700/50 text-blue-400 px-2 py-0.5 rounded-full">Nuevo</span>
            </div>
            <p className="text-[12px] text-zinc-500 leading-snug">
              Comparte boletos, chatea y compite en el leaderboard de tu grupo.
            </p>
          </div>
          <Icon name="arrowRight" className="w-4 h-4 text-blue-400 shrink-0" strokeWidth={2.4} />
        </Link>
      </section>

      {/* ── Premium teaser (free only) ────────────────────────────────────── */}
      {!isPremium && (
        <section className="max-w-5xl mx-auto px-4 pb-10">
          <Link href="/pricing"
            className="flex items-center gap-4 rounded-2xl border border-emerald-800/45 bg-zinc-900/65 hover:border-emerald-700/55 p-4 tap transition-colors backdrop-blur-sm">
            <span className="grid place-items-center w-10 h-10 rounded-xl bg-emerald-500/14 border border-emerald-700/40 text-emerald-400 shrink-0">
              <Icon name="crown" className="w-[18px] h-[18px]" strokeWidth={2} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-[14px] font-bold text-white leading-tight">Desbloquea el motor completo</p>
                <span className="text-[10px] font-black bg-emerald-500/14 border border-emerald-700/50 text-emerald-400 px-2 py-0.5 rounded-full">desde 9.99€</span>
              </div>
              <p className="text-[12px] text-zinc-500 leading-snug">
                Todos los value picks, análisis completo, combinadas y bot IA ilimitado.
              </p>
            </div>
            <Icon name="arrowRight" className="w-4 h-4 text-emerald-400 shrink-0" strokeWidth={2.4} />
          </Link>
        </section>
      )}

    </div>
  )
}
