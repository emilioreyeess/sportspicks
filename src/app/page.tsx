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
  iconBg: string; badge: string; text: string
}> = {
  emerald: { iconBg: "bg-emerald-400/10 text-emerald-400/90", badge: "text-emerald-300/80", text: "text-emerald-400/90" },
  violet:  { iconBg: "bg-violet-400/10 text-violet-400/90",   badge: "text-violet-300/80",  text: "text-violet-400/90"  },
  amber:   { iconBg: "bg-amber-400/10 text-amber-400/90",     badge: "text-amber-300/80",   text: "text-amber-400/90"   },
  blue:    { iconBg: "bg-blue-400/10 text-blue-400/90",       badge: "text-blue-300/80",    text: "text-blue-400/90"    },
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
    <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-10 pb-2">
      <div className="rounded-3xl bg-zinc-900/40 border border-white/[0.05] px-5 sm:px-6 py-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="grid place-items-center w-9 h-9 rounded-xl bg-amber-400/10">
              <Icon name="star" className="w-[18px] h-[18px] text-amber-400/90" strokeWidth={2.2} />
            </span>
            <div>
              <p className="text-[14px] font-semibold text-white leading-tight">Histórico de ayer</p>
              <p className="text-[12px] text-zinc-500 leading-tight mt-0.5">Creadas y analizadas por Bot IA</p>
            </div>
          </div>
          <Link href="/value" className="text-[12px] font-medium text-zinc-400 hover:text-white transition-colors tap">
            Ver todo →
          </Link>
        </div>
        <div className="space-y-1">
          {loading ? (
            [...Array(3)].map((_, i) => (
              <div key={i} className="py-2.5 flex items-center gap-3 animate-pulse">
                <div className="h-3 bg-zinc-800/80 rounded flex-1" />
                <div className="h-5 w-12 bg-zinc-800/80 rounded" />
              </div>
            ))
          ) : picks.length > 0 ? picks.map((p: any) => (
            <div key={p.id} className="py-2.5 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-white truncate">{p.home_team} vs {p.away_team}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[12px] text-zinc-500">{p.selection}</span>
                  <span className="text-[12px] font-semibold text-emerald-400/90">@{p.best_odd?.toFixed(2) ?? "—"}</span>
                  <span className="text-[11px] text-zinc-600">IA {Math.round(p.model_prob)}%</span>
                </div>
              </div>
              <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full shrink-0 ${R[p.result] ?? R.VOID}`}>
                {p.result}
              </span>
            </div>
          )) : (
            // CERO MOCKS: si no hay picks reales resueltos de ayer, estado vacío sutil.
            <p className="py-3 text-[12px] text-zinc-600">Sin actividad ayer</p>
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
    <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-4">
      <div className="rounded-3xl border border-white/[0.05] bg-zinc-900/40 px-5 sm:px-6 py-5">
        <div className="flex items-center gap-2.5 mb-4">
          <span className="text-[10px] font-semibold tracking-wide bg-violet-400/10 text-violet-300/90 px-2.5 py-1 rounded-full">TIPSTER VIP</span>
          <p className="text-[14px] font-semibold text-white">Panel de Tipster</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/creators" className="flex flex-col items-center gap-2 py-5 rounded-2xl bg-white/[0.02] hover:bg-white/[0.04] tap transition-colors">
            <Icon name="image" className="w-5 h-5 text-violet-400/90" strokeWidth={2} />
            <span className="text-[12px] font-medium text-zinc-300">Crear imagen</span>
          </Link>
          <Link href="/creators" className="flex flex-col items-center gap-2 py-5 rounded-2xl bg-white/[0.02] hover:bg-white/[0.04] tap transition-colors">
            <Icon name="gift" className="w-5 h-5 text-amber-400/90" strokeWidth={2} />
            <span className="text-[12px] font-medium text-zinc-300">Mis bounties</span>
          </Link>
        </div>
      </div>
    </section>
  )
}

/* ── FASE 3.1: Banner de Confianza — ROI global auditado desde la BD ────────── */
function TrustBanner() {
  const [roi, setRoi] = useState<number | null>(null)
  const [wr, setWr] = useState<number | null>(null)
  useEffect(() => {
    fetch("/api/picks/stats", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) { setRoi(d.roi_pct ?? null); setWr(d.winrate_pct ?? null) } })
      .catch(() => {})
  }, [])
  return (
    <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-4">
      <div className="rounded-2xl bg-emerald-500/[0.06] border border-emerald-700/30 px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <span className="grid place-items-center w-9 h-9 rounded-xl bg-emerald-500/15 shrink-0">
            <Icon name="shield" className="w-[18px] h-[18px] text-emerald-400" strokeWidth={2.2} />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-400/90">Resultados Auditados</p>
            <p className="text-[13px] text-zinc-300 leading-tight mt-0.5">
              ROI global <strong className="text-white">{roi != null ? `${roi > 0 ? "+" : ""}${roi.toFixed(1)}%` : "—"}</strong>
              {wr != null && <span className="text-zinc-500"> · acierto {wr.toFixed(0)}%</span>}
            </p>
          </div>
        </div>
        <Link href="/historico" className="shrink-0 text-[12px] font-semibold text-emerald-400 hover:text-emerald-300 tap">
          Ver Histórico →
        </Link>
      </div>
    </section>
  )
}

/* ── FASE 3.2: Mundial Hoy — partidos del día + barras 1X2/BTTS del modelo ──── */
function Bar({ label, pct, color }: { label: string; pct: number | null; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-zinc-500 w-24 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-white/[0.06] rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct ?? 0}%` }} />
      </div>
      <span className="text-[10px] font-semibold text-zinc-400 w-9 text-right shrink-0">{pct != null ? `${pct}%` : "—"}</span>
    </div>
  )
}

function MundialHoy() {
  const [matches, setMatches] = useState<any[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  useEffect(() => {
    fetch("/api/world-cup/live", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const today = new Date().toISOString().slice(0, 10)
        setMatches((d?.fixtures ?? []).filter((f: any) => (f.kickoffISO ?? "").slice(0, 10) === today))
      })
      .catch(() => {})
  }, [])
  if (matches.length === 0) return null
  const impl = (o: number | null) => (o && o > 1 ? 1 / o : null)
  return (
    <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-10 pb-2">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-base">🏆</span>
        <p className="text-[14px] font-semibold text-white">Mundial hoy</p>
      </div>
      <div className="space-y-2">
        {matches.map((m: any) => {
          const odds = m.odds ?? {}
          const ph = impl(odds.home), pd = impl(odds.draw), pa = impl(odds.away)
          const sum = (ph ?? 0) + (pd ?? 0) + (pa ?? 0)
          const norm = (p: number | null) => (p != null && sum > 0 ? Math.round((p / sum) * 100) : null)
          const btts = impl(odds.bttsYes)
          const open = openId === m.matchId
          return (
            <div key={m.matchId} className="rounded-2xl bg-zinc-900/40 border border-white/[0.05] px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[13px] font-semibold text-white truncate">{m.homeName} vs {m.awayName}</p>
                <button onClick={() => setOpenId(open ? null : m.matchId)} className="shrink-0 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 tap">
                  {open ? "Ocultar" : "Análisis"}
                </button>
              </div>
              {open && (
                <div className="mt-3 space-y-1.5">
                  <Bar label="Victoria local" pct={norm(ph)} color="bg-emerald-500" />
                  <Bar label="Empate" pct={norm(pd)} color="bg-zinc-500" />
                  <Bar label="Victoria visitante" pct={norm(pa)} color="bg-sky-500" />
                  <Bar label="Ambos marcan" pct={btts != null ? Math.round(btts * 100) : null} color="bg-amber-500" />
                </div>
              )}
            </div>
          )
        })}
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
          {/* Aerial depth overlay — soft desaturated glow, no grid noise */}
          <div className="absolute inset-0"
            style={{
              backgroundImage: [
                "radial-gradient(ellipse 95% 55% at 50% -12%, rgba(82,181,145,0.045) 0%, transparent 60%)",
                "radial-gradient(ellipse 70% 42% at 25% 55%, rgba(77,179,195,0.015) 0%, transparent 58%)",
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

          {/* ── Stats strip — clean grid, whitespace instead of dividers ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-7 pt-12 sm:pt-14 text-left">
            {STATS.map((s) => (
              <div key={s.l}>
                {/* Large display value */}
                <p
                  className="font-bold text-emerald-400/90 leading-none mb-1.5 tracking-tight"
                  style={{ fontSize: "clamp(1.75rem, 4vw, 2.75rem)" }}
                >
                  {s.v}
                </p>
                <p className="text-[13px] font-medium text-zinc-300 leading-tight">{s.l}</p>
                <p className="text-[11px] text-zinc-600 leading-snug mt-1">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FASE 3.1: Banner de Confianza (ROI global auditado) ───────────── */}
      <TrustBanner />

      {/* ── Hall of Fame ──────────────────────────────────────────────────── */}
      <HallOfFame />

      {/* ── FASE 3.2: Mundial Hoy (partidos del día + barras de análisis) ──── */}
      <MundialHoy />

      {/* ── Partidos de Hoy (STEP 4) — realtime + análisis IA ─────────────── */}
      <TodayMatches />

      {/* ── Featured: Mundial + Retos ─────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-10 pb-2">
        <p className="section-label mb-4 px-0.5">Destacado</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Mundial 2026 */}
          <Link href="/world-cup-2026"
            className="group rounded-3xl border border-white/[0.05] bg-zinc-900/40 p-5 sm:p-6 tap hover:border-white/[0.10] transition-all duration-200">
            <div className="flex items-start justify-between mb-5">
              <span className="grid place-items-center w-11 h-11 rounded-2xl bg-amber-400/10 text-amber-400/90">
                <Icon name="worldcup" className="w-5 h-5" strokeWidth={2} />
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-300/90">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                {countdown || "En breve"}
              </span>
            </div>
            <h2 className="text-[22px] font-bold tracking-tight text-white leading-none">
              Mundial <span className="text-amber-400/90">2026</span>
            </h2>
            <p className="text-[12px] text-zinc-500 mt-2">48 equipos · 12 grupos confirmados</p>
            <div className="flex flex-wrap gap-1.5 mt-5 mb-5">
              {["A","B","C","D","E","F","G","H","I","J","K","L"].map((g) => (
                <span key={g} className="grid place-items-center w-6 h-6 rounded-md bg-white/[0.03] text-[10px] font-semibold text-zinc-400">
                  {g}
                </span>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-zinc-600">🇺🇸🇲🇽🇨🇦 · 11 jun – 19 jul</span>
              <span className="text-[13px] font-semibold text-amber-400/90 inline-flex items-center gap-1">
                Ver hub <Icon name="arrowRight" className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" strokeWidth={2.4} />
              </span>
            </div>
          </Link>

          {/* Retos */}
          <Link href="/retos"
            className="group rounded-3xl border border-white/[0.05] bg-zinc-900/40 p-5 sm:p-6 tap hover:border-white/[0.10] transition-all duration-200">
            <div className="flex items-start justify-between mb-5">
              <span className="grid place-items-center w-11 h-11 rounded-2xl bg-rose-400/10 text-rose-400/90">
                <Icon name="trophy" className="w-5 h-5" strokeWidth={2} />
              </span>
              <span className="rounded-full bg-rose-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-rose-300/90">
                Comunidad
              </span>
            </div>
            <h2 className="text-[22px] font-bold tracking-tight text-white leading-none">Retos</h2>
            <p className="text-[12px] text-zinc-500 mt-2">Pick diario real · simulación con bankroll</p>
            <div className="grid grid-cols-2 gap-2 mt-5 mb-5">
              {[
                { id: "Conservador", odd: "~1.30", c: "text-emerald-400/90" },
                { id: "Intermedio",  odd: "~1.50", c: "text-amber-400/90"   },
                { id: "Avanzado",    odd: "~2.00", c: "text-orange-400/90"  },
                { id: "PRO",         odd: "~3.00", c: "text-rose-400/90"    },
              ].map((r) => (
                <div key={r.id} className="rounded-xl bg-white/[0.02] px-3 py-2.5">
                  <p className="text-[12px] font-medium text-white leading-tight">{r.id}</p>
                  <p className={`text-[11px] font-semibold leading-tight mt-0.5 ${r.c}`}>{r.odd}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-zinc-600">4 niveles · sin dinero real</span>
              <span className="text-[13px] font-semibold text-rose-400/90 inline-flex items-center gap-1">
                Ver retos <Icon name="arrowRight" className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" strokeWidth={2.4} />
              </span>
            </div>
          </Link>
        </div>
      </section>

      {/* ── Herramientas ──────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-12 pb-8">
        <p className="section-label mb-4 px-0.5">Herramientas</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger">
          {TOOLS.map((tool) => {
            const c = TOOL_COLORS[tool.color]
            return (
              <Link key={tool.href} href={tool.href}
                className="group rounded-3xl border border-white/[0.05] bg-zinc-900/40 p-5 sm:p-6 tap hover:border-white/[0.10] transition-all duration-200">
                <div className="flex items-start justify-between mb-4">
                  <span className={`grid place-items-center w-11 h-11 rounded-2xl ${c.iconBg}`}>
                    <Icon name={tool.icon} className="w-5 h-5" strokeWidth={2} />
                  </span>
                  <span className={`text-[10px] font-semibold uppercase tracking-wide ${c.badge}`}>
                    {tool.badge}
                  </span>
                </div>
                <h3 className="text-[17px] font-semibold text-white leading-tight">{tool.title}</h3>
                <p className="text-[13px] text-zinc-500 leading-relaxed mt-2 mb-4">{tool.desc}</p>
                <span className={`text-[13px] font-semibold inline-flex items-center gap-1 ${c.text}`}>
                  Abrir
                  <Icon name="arrowRight" className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" strokeWidth={2.4} />
                </span>
              </Link>
            )
          })}
        </div>
      </section>

      {/* ── Tipster VIP ───────────────────────────────────────────────────── */}
      <TipsterQuickAccess />

      {/* ── Grupos de amigos ──────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-4">
        <Link href="/groups"
          className="flex items-center gap-4 rounded-3xl border border-white/[0.05] bg-zinc-900/40 hover:border-white/[0.10] p-5 sm:p-6 tap transition-colors">
          <span className="grid place-items-center w-11 h-11 rounded-2xl bg-blue-400/10 text-blue-400/90 shrink-0">
            <Icon name="groups" className="w-5 h-5" strokeWidth={2} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-[14px] font-semibold text-white leading-tight">Grupos de amigos</p>
              <span className="text-[10px] font-semibold bg-blue-400/10 text-blue-300/90 px-2 py-0.5 rounded-full">Nuevo</span>
            </div>
            <p className="text-[12px] text-zinc-500 leading-snug">
              Comparte boletos, chatea y compite en el leaderboard de tu grupo.
            </p>
          </div>
          <Icon name="arrowRight" className="w-4 h-4 text-zinc-500 shrink-0" strokeWidth={2.2} />
        </Link>
      </section>

      {/* ── Premium teaser (free only) ────────────────────────────────────── */}
      {!isPremium && (
        <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-12">
          <Link href="/pricing"
            className="flex items-center gap-4 rounded-3xl border border-white/[0.05] bg-zinc-900/40 hover:border-white/[0.10] p-5 sm:p-6 tap transition-colors">
            <span className="grid place-items-center w-11 h-11 rounded-2xl bg-emerald-400/10 text-emerald-400/90 shrink-0">
              <Icon name="crown" className="w-5 h-5" strokeWidth={2} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-[14px] font-semibold text-white leading-tight">Desbloquea el motor completo</p>
                <span className="text-[10px] font-semibold bg-emerald-400/10 text-emerald-300/90 px-2 py-0.5 rounded-full">desde 9.99€</span>
              </div>
              <p className="text-[12px] text-zinc-500 leading-snug">
                Todos los value picks, análisis completo, combinadas y bot IA ilimitado.
              </p>
            </div>
            <Icon name="arrowRight" className="w-4 h-4 text-zinc-500 shrink-0" strokeWidth={2.2} />
          </Link>
        </section>
      )}

    </div>
  )
}
