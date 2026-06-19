"use client"

import { useState, useEffect } from "react"
import { getCombinada } from "@/lib/api"
import { PageHeader, Card } from "@/components/ui/primitives"
import { Icon } from "@/components/ui/icons"
import { usePlan } from "@/lib/plan"
import { useUpgradeModal } from "@/components/premium"
import { evaluateExpiry, expiryBanner, edgeFromProbOdds } from "@/lib/expiry"
import Link from "next/link"

interface Leg {
  match: string; league: string; selection: string
  odd: number; prob: number; market: string; reasoning?: string
  kickoff?: string   // ISO 8601 — viaja al cliente y al POST del grupo
}
interface Result {
  mode: string; date: string; legs: Leg[]
  combined_odd: number; combined_prob: number
  fallback_reason?: string
}

/** FASE 3.3: kickoff ISO → "25 jun · 18:00" (hora local del navegador). */
function fmtKickoff(iso?: string): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ""
  const date = d.toLocaleDateString("es-ES", { day: "numeric", month: "short" })
  const time = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
  return `${date} · ${time}`
}

// FASE 4: el filtro "Mundial" se eliminó — no tenía inventario suficiente para
// los objetivos de Balanceada/Soñadora y rompía el motor. Las combinadas se
// generan SIEMPRE sobre el pool global (que ya incluye los partidos del Mundial
// con cuota real), garantizando volumen para el "Mejor Esfuerzo".
const LEAGUES = [
  { id: "", label: "Todas las ligas", flag: "🌍" },
  { id: "1", label: "LaLiga", flag: "🇪🇸" },
  { id: "2", label: "Premier League", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { id: "3", label: "Bundesliga", flag: "🇩🇪" },
  { id: "4", label: "Serie A", flag: "🇮🇹" },
  { id: "5", label: "Ligue 1", flag: "🇫🇷" },
]
type ModeKey = "safe" | "balanced" | "dream"

// safe + balanced son FREE · dream y AI son PREMIUM+
const MODES: {
  key: ModeKey; label: string; icon: string; legs: string; desc: string
  requiresPremium: boolean; accent: string; bar: string
}[] = [
  { key: "safe",     label: "Segura",     icon: "shield", legs: "2 patas", desc: "Las más probables del día",   requiresPremium: false, accent: "text-emerald-400", bar: "bg-emerald-500" },
  { key: "balanced", label: "Balanceada", icon: "stats",  legs: "3 patas", desc: "Equilibrio riesgo/recompensa", requiresPremium: false, accent: "text-amber-400",   bar: "bg-amber-400"   },
  { key: "dream",    label: "Soñadora",   icon: "spark",  legs: "4 patas", desc: "Cuota alta, más riesgo",      requiresPremium: true,  accent: "text-rose-400",    bar: "bg-rose-500"    },
]

const DAILY_KEY = "sp_combi_day"
const FREE_DAILY_LIMIT = 2

function getTodayCount(): number {
  if (typeof window === "undefined") return 0
  try {
    const raw = window.localStorage.getItem(DAILY_KEY)
    if (!raw) return 0
    const { date, count } = JSON.parse(raw)
    if (date !== new Date().toISOString().split("T")[0]) return 0
    return count ?? 0
  } catch { return 0 }
}

function incrementTodayCount() {
  try {
    const date = new Date().toISOString().split("T")[0]
    const count = getTodayCount() + 1
    window.localStorage.setItem(DAILY_KEY, JSON.stringify({ date, count }))
  } catch {}
}

export default function CombinadasClient() {
  const { isPremium, isPro, plan } = usePlan()
  const upgrade = useUpgradeModal()
  const [mode, setMode] = useState<ModeKey>("safe")
  const [leagueId, setLeagueId] = useState("")
  const [result, setResult] = useState<Result | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [todayCount, setTodayCount] = useState(0)

  useEffect(() => { setTodayCount(getTodayCount()) }, [])

  // Mensaje único y limpio cuando no hay material para la combinada pedida.
  const EMPTY_MSG = "No hay suficientes partidos con cuota en los próximos 7 días para armar esta combinada"

  const meta = MODES.find((m) => m.key === mode)!
  const freeAtLimit = !isPremium && todayCount >= FREE_DAILY_LIMIT

  // FASE 2: el clic en la pestaña dispara un fetch REAL inmediato con el modo
  // elegido (pasado explícito para evitar el estado obsoleto de setMode async).
  function pickMode(m: typeof MODES[number]) {
    if (m.requiresPremium && !isPremium) { upgrade.show("combinadas_dream"); return }
    setMode(m.key)
    generate(m.key)
  }

  async function generate(targetMode: ModeKey = mode) {
    if (freeAtLimit) { upgrade.show("combinadas_unlimited"); return }
    setLoading(true); setError(""); setResult(null)
    try {
      // SIEMPRE el pool global del motor (incluye partidos del Mundial con cuota
      // real). Sin rama "Mundial": garantiza volumen para el "Mejor Esfuerzo".
      const data = await getCombinada(targetMode, leagueId)
      // FASE 3: respuesta vacía/sin legs → mensaje limpio (sin mock estático).
      if (data?.error || !(data?.legs?.length)) setError(EMPTY_MSG)
      else {
        setResult(data)
        if (!isPremium) { incrementTodayCount(); setTodayCount(getTodayCount()) }
      }
    } catch {
      setError(EMPTY_MSG)
    } finally { setLoading(false) }
  }

  return (
    <div className="px-4 sm:px-6 py-8 max-w-3xl mx-auto safe-x space-y-5">
      <PageHeader icon="combinadas" title="Combinadas"
        subtitle="Cuotas reales y el mismo motor cuantitativo. Elige el perfil de riesgo." />

      {/* ── Modo selector ─────────────────────────────────────────────────────── */}
      <Card className="p-5 sm:p-6 space-y-5">
        <div>
          <p className="apple-eyebrow text-zinc-500 mb-2.5">Perfil de riesgo</p>
          <div className="grid grid-cols-3 gap-2.5">
            {MODES.map((m) => {
              const active = mode === m.key
              const locked = m.requiresPremium && !isPremium
              return (
                <button key={m.key} onClick={() => pickMode(m)}
                  className={`relative rounded-2xl p-3.5 text-left transition-all tap ${
                    active ? "bg-white/[0.06]" : "bg-white/[0.03] hover:bg-white/[0.05]"
                  }`}>
                  {locked && (
                    <span className="absolute top-2 right-2 text-zinc-600">
                      <Icon name="lock" className="w-3.5 h-3.5" />
                    </span>
                  )}
                  <Icon name={m.icon} className={`w-5 h-5 mb-1.5 ${active ? m.accent : "text-zinc-500"}`} strokeWidth={2} />
                  <p className={`text-sm font-semibold ${active ? "text-white" : "text-zinc-400"}`}>{m.label}</p>
                  <p className="text-[10px] text-zinc-600 mt-0.5">{m.legs}</p>
                </button>
              )
            })}
          </div>
          <p className="text-[11px] text-zinc-500 mt-2.5">{meta.desc} · cuota real por pata</p>
        </div>

        {/* Liga selector */}
        <div>
          <p className="apple-eyebrow text-zinc-500 mb-2.5">Liga</p>
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
            {LEAGUES.map((l) => (
              <button
                key={l.id}
                onClick={() => setLeagueId(l.id)}
                className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all tap ${
                  leagueId === l.id
                    ? "bg-white/[0.06] text-white"
                    : "bg-white/[0.03] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.05]"
                }`}
              >
                <span>{l.flag}</span>
                <span>{l.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Límite diario Free */}
        {!isPremium && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500">Generaciones hoy</span>
            <span className={`font-semibold ${freeAtLimit ? "text-rose-400/90" : "text-zinc-300"}`}>
              {todayCount}/{FREE_DAILY_LIMIT}
            </span>
          </div>
        )}

        {freeAtLimit ? (
          <div className="rounded-2xl bg-amber-400/[0.08] px-4 py-3.5 flex items-start gap-2.5">
            <Icon name="shield" className="w-4 h-4 text-amber-400/90 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-300">Límite diario alcanzado</p>
              <p className="text-xs text-amber-200/80 mt-0.5">
                El plan Free incluye {FREE_DAILY_LIMIT} combinadas al día.{" "}
                <Link href="/pricing" className="underline hover:text-amber-200">Actualiza a Premium ⭐</Link>{" "}
                para generaciones ilimitadas.
              </p>
            </div>
          </div>
        ) : (
          <button onClick={() => generate()} disabled={loading}
            className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-zinc-950 font-semibold rounded-xl text-sm tap inline-flex items-center justify-center gap-2 transition-colors">
            {loading
              ? <><Icon name="settings" className="w-4 h-4 animate-spin" /> Generando…</>
              : <><Icon name="spark" className="w-4 h-4" strokeWidth={2.2} /> Generar combinada {meta.label}</>}
          </button>
        )}
      </Card>

      {/* Error estándar */}
      {error && (
        <div className="flex items-start gap-2.5 rounded-2xl bg-amber-400/[0.08] px-4 py-3.5">
          <Icon name="shield" className="w-4 h-4 text-amber-400/90 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-200/90 leading-snug">{error}</p>
        </div>
      )}

      {/* Resultado estándar */}
      {result && <CombinadaResult result={result} accent={meta.accent} bar={meta.bar} />}

      <upgrade.Modal />
    </div>
  )
}

// ─── Combinada Result ─────────────────────────────────────────────────────────

function CombinadaResult({ result, accent, bar }: {
  result: Result; accent: string; bar: string
}) {
  // FASE 2 "Llegas Tarde": una pata expira si su Edge (prob modelo − implícita de
  // la cuota) cae a ≤ 0 (o la cuota baja ≥5%, si hubiera cuota en vivo).
  const legExpiry = result.legs.map((l) =>
    evaluateExpiry({ initialOdds: l.odd, currentOdds: l.odd, edgePct: edgeFromProbOdds(l.prob, l.odd) }),
  )
  const expiredLeg = legExpiry.find((e) => e.expired) ?? null

  return (
    <Card className={`overflow-hidden animate-scale-in ${expiredLeg ? "opacity-50 border border-rose-500/50" : ""}`}>
      {expiredLeg && (
        <div className="px-5 py-2.5 bg-rose-500/[0.12] border-b border-rose-700/40">
          <p className="text-[11px] font-bold text-rose-300">⏰ {expiryBanner(expiredLeg)}</p>
        </div>
      )}
      {result.fallback_reason && (
        <div className="px-5 py-2.5 bg-amber-400/[0.08]">
          <p className="text-[11px] text-amber-400/90">ℹ️ {result.fallback_reason}</p>
        </div>
      )}

      {/* Summary */}
      <div className="p-5 sm:p-6">
        <p className="text-[11px] text-zinc-500 mb-1.5">
          Combinada {result.mode} · {result.legs.length} patas · cuotas reales
        </p>
        <div className="flex items-end justify-between">
          <div>
            <span className={`text-4xl font-bold ${accent}`}>{result.combined_odd.toFixed(2)}</span>
            <span className="text-zinc-500 text-sm ml-1.5">cuota total</span>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-white">{result.combined_prob.toFixed(1)}%</p>
            <p className="text-[10px] text-zinc-600">prob. del modelo</p>
          </div>
        </div>
        <div className="mt-3 h-2 bg-white/[0.06] rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${bar} opacity-80`}
            style={{ width: `${Math.min(result.combined_prob * 1.5, 100)}%` }} />
        </div>
      </div>

      {/* Legs */}
      <div className="px-5 sm:px-6 pb-2 space-y-1">
        {result.legs.map((leg, i) => (
          <div key={i} className="py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="grid place-items-center w-6 h-6 rounded-lg bg-white/[0.05] text-zinc-500 font-bold text-xs shrink-0">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-[10px] text-zinc-600 uppercase tracking-wide">
                  {leg.league} · {leg.market}{leg.kickoff ? ` · ${fmtKickoff(leg.kickoff)}` : ""}
                </p>
                <p className="text-sm text-white font-semibold truncate">{leg.match}</p>
                <p className={`text-xs font-medium mt-0.5 flex items-center gap-1 ${accent}`}>
                  <Icon name="check" className="w-3 h-3" strokeWidth={2.5} /> {leg.selection}
                </p>
                {leg.reasoning && (
                  <p className="text-[10px] text-zinc-600 mt-0.5 truncate">{leg.reasoning}</p>
                )}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xl font-bold text-white">{leg.odd.toFixed(2)}</p>
              <p className="text-[10px] text-zinc-600">{leg.prob}% modelo</p>
            </div>
          </div>
        ))}
      </div>

      <div className="px-5 py-3">
        <p className="text-[10px] text-zinc-700 text-center">
          Cuotas reales · análisis informativo · no constituye recomendación de apuesta · +18
        </p>
      </div>
    </Card>
  )
}
