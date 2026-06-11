"use client"

import { useState, useEffect } from "react"
import { getCombinada } from "@/lib/api"
import { PageHeader, Card } from "@/components/ui/primitives"
import { Icon } from "@/components/ui/icons"
import { usePlan } from "@/lib/plan"
import { useUpgradeModal, PremiumBadge } from "@/components/premium"
import Link from "next/link"

interface Leg {
  match: string; league: string; selection: string
  odd: number; prob: number; market: string; reasoning?: string
}
interface Result {
  mode: string; date: string; legs: Leg[]
  combined_odd: number; combined_prob: number
  ai_reasoning?: string; interpretation?: string; prompt?: string
  fallback_reason?: string
}

const LEAGUES = [
  { id: "", label: "Todas las ligas", flag: "🌍" },
  { id: "wc", label: "Mundial 2026", flag: "🏆" },
  { id: "1", label: "LaLiga", flag: "🇪🇸" },
  { id: "2", label: "Premier League", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { id: "3", label: "Bundesliga", flag: "🇩🇪" },
  { id: "4", label: "Serie A", flag: "🇮🇹" },
  { id: "5", label: "Ligue 1", flag: "🇫🇷" },
]
interface NoMatchResult {
  no_match: true
  requested_market?: string
  requested_league?: string
  message: string
  explanation: string
  available_markets?: string[]
  available_leagues?: string[]
  suggestion?: string
}

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

  // AI combinadas (PREMIUM+)
  const [aiPrompt, setAiPrompt] = useState("")
  const [aiResult, setAiResult] = useState<Result | null>(null)
  const [aiNoMatch, setAiNoMatch] = useState<NoMatchResult | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState("")

  useEffect(() => { setTodayCount(getTodayCount()) }, [])

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
      if (leagueId === "wc") {
        // Mundial 2026 — motor Poisson propio
        const tierMap: Record<ModeKey, string> = { safe: "segura", balanced: "balanceada", dream: "soñadora" }
        const res = await fetch(`/api/world-cup/combinadas?tier=${tierMap[targetMode]}&t=${Date.now()}`, { cache: "no-store" })
        const wc = await res.json()
        console.log("JSON DE COMBINADA (WC):", JSON.stringify(wc, null, 2))
        if (!wc || wc.error) { setError("No hay partidos del Mundial disponibles aún."); return }
        // Mapear WCCombinada → Result
        const mapped: Result = {
          mode: wc.tierLabel ?? targetMode,
          date: wc.generatedAt,
          legs: (wc.legs ?? []).map((leg: any) => ({
            match:     `${leg.homeCode} vs ${leg.awayCode}`,
            league:    "Mundial 2026 🏆",
            selection: leg.marketLabel,
            odd:       leg.impliedOdds,
            prob:      Math.round(leg.modelProb * 100),
            market:    leg.market,
            reasoning: leg.justification,
          })),
          combined_odd:  wc.combinedImpliedOdds,
          combined_prob: Math.round(wc.combinedProb * 100),
        }
        setResult(mapped)
        if (!isPremium) { incrementTodayCount(); setTodayCount(getTodayCount()) }
      } else {
        const data = await getCombinada(targetMode, leagueId)
        console.log("JSON DE COMBINADA:", JSON.stringify(data, null, 2))
        if (data?.error) setError(data.error)
        else {
          setResult(data)
          if (!isPremium) { incrementTodayCount(); setTodayCount(getTodayCount()) }
        }
      }
    } catch {
      setError("No hay suficientes selecciones. Prueba otro modo.")
    } finally { setLoading(false) }
  }

  async function generateAi() {
    if (!aiPrompt.trim()) return
    setAiLoading(true); setAiError(""); setAiResult(null); setAiNoMatch(null)
    try {
      const r = await fetch("/api/combinadas/ai", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt }),
      })
      const d = await r.json()
      if (d?.no_match) setAiNoMatch(d as NoMatchResult)
      else if (d?.error) setAiError(d.error)
      else setAiResult(d)
    } catch (e: any) { setAiError(e?.message ?? "Error al generar") }
    finally { setAiLoading(false) }
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

      {/* ── AI Combinada por prompt (PREMIUM+) ──────────────────────────────── */}
      <Card className="p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Icon name="spark" className="w-5 h-5 text-emerald-400/90" />
          <h2 className="text-base font-bold text-white">Combinada IA por prompt</h2>
          <PremiumBadge plan="premium" />
        </div>

        {isPremium ? (
          <>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Escribe lo que quieres y la IA lo construye del pool real de hoy.
              <span className="block mt-1 text-zinc-600">
                Ejemplos: <em className="text-zinc-400 not-italic">"cuota 3"</em> · <em className="text-zinc-400 not-italic">"BTTS Premier"</em> · <em className="text-zinc-400 not-italic">"combinada defensiva"</em> · <em className="text-zinc-400 not-italic">"cuota 8 soñadora"</em>
              </span>
            </p>
            <div className="flex gap-2">
              <input
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && aiPrompt.trim()) generateAi() }}
                placeholder="Describe tu combinada ideal…"
                maxLength={500}
                className="flex-1 bg-white/[0.04] focus:bg-white/[0.06] rounded-xl px-4 py-3 text-sm text-white outline-none transition-colors"
              />
              <button onClick={generateAi} disabled={aiLoading || !aiPrompt.trim()}
                className="px-4 py-3 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold rounded-xl text-sm tap disabled:opacity-40 shrink-0 inline-flex items-center gap-1.5 transition-colors">
                {aiLoading
                  ? <Icon name="settings" className="w-4 h-4 animate-spin" />
                  : <Icon name="spark" className="w-4 h-4" strokeWidth={2.2} />}
                {aiLoading ? "IA…" : "Generar"}
              </button>
            </div>
            {aiError && (
              <div className="flex items-start gap-2.5 rounded-2xl bg-amber-400/[0.08] px-4 py-3">
                <Icon name="shield" className="w-4 h-4 text-amber-400/90 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-200/90 leading-snug">{aiError}</p>
              </div>
            )}
            {aiNoMatch && <NoMatchPanel nm={aiNoMatch} onRetry={(q) => { setAiPrompt(q); setAiNoMatch(null) }} />}
            {aiResult && <CombinadaResult result={aiResult} accent="text-emerald-400" bar="bg-emerald-500" isAi />}
          </>
        ) : (
          <div className="rounded-2xl bg-emerald-400/[0.06] p-5 sm:p-6 text-center">
            <div className="grid place-items-center w-12 h-12 rounded-2xl bg-emerald-400/10 mx-auto mb-3">
              <Icon name="spark" className="w-6 h-6 text-emerald-400/90" />
            </div>
            <p className="text-sm font-bold text-white mb-1">Disponible en Premium ⭐</p>
            <p className="text-xs text-zinc-400 mb-4 leading-snug max-w-xs mx-auto">
              Pide cualquier combinada: <span className="text-zinc-300">"cuota 3"</span>, <span className="text-zinc-300">"BTTS Premier"</span>, <span className="text-zinc-300">"combinada corners MLS"</span>. La IA la construye del pool real del día.
            </p>
            <Link href="/pricing"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-sm tap transition-colors">
              <Icon name="crown" className="w-4 h-4" strokeWidth={2.2} /> Ver Premium
            </Link>
          </div>
        )}
      </Card>

      <upgrade.Modal />
    </div>
  )
}

// ─── No Match Panel ───────────────────────────────────────────────────────────

function NoMatchPanel({ nm, onRetry }: { nm: NoMatchResult; onRetry: (q: string) => void }) {
  const what = nm.requested_market ?? nm.requested_league ?? "lo pedido"
  return (
    <div className="rounded-2xl bg-zinc-900/40 border border-white/[0.05] overflow-hidden animate-scale-in">
      {/* Header */}
      <div className="px-4 py-3.5 bg-amber-400/[0.06] flex items-start gap-2.5">
        <span className="text-base shrink-0 mt-0.5">🔍</span>
        <div>
          <p className="text-sm font-semibold text-amber-300">{nm.message}</p>
          <p className="text-xs text-zinc-400 mt-1 leading-snug">{nm.explanation}</p>
        </div>
      </div>

      {/* Available markets */}
      {nm.available_markets && nm.available_markets.length > 0 && (
        <div className="px-4 pt-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 mb-2">
            Mercados disponibles en el pool de hoy
          </p>
          <div className="flex flex-wrap gap-1.5">
            {nm.available_markets.map((m) => (
              <span key={m} className="px-2.5 py-1 rounded-lg bg-white/[0.05] text-xs text-zinc-300 font-medium">
                {m}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Available leagues */}
      {nm.available_leagues && nm.available_leagues.length > 0 && (
        <div className="px-4 pt-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 mb-2">
            Ligas disponibles hoy
          </p>
          <div className="flex flex-wrap gap-1.5">
            {nm.available_leagues.slice(0, 8).map((l) => (
              <span key={l} className="px-2.5 py-1 rounded-lg bg-white/[0.05] text-xs text-zinc-300 font-medium">
                {l}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Suggestion + retry */}
      {nm.suggestion && (
        <div className="px-4 py-3.5">
          <p className="text-xs text-zinc-400 leading-snug mb-3">{nm.suggestion}</p>
          <button
            onClick={() => onRetry("combinada 3 patas cuota 4")}
            className="text-xs font-semibold text-emerald-400/90 flex items-center gap-1 tap hover:text-emerald-300">
            <Icon name="spark" className="w-3.5 h-3.5" strokeWidth={2.2} />
            Probar combinada estándar →
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Combinada Result ─────────────────────────────────────────────────────────

function CombinadaResult({ result, accent, bar, isAi = false }: {
  result: Result; accent: string; bar: string; isAi?: boolean
}) {
  return (
    <Card className="overflow-hidden animate-scale-in">
      {result.fallback_reason && (
        <div className="px-5 py-2.5 bg-amber-400/[0.08]">
          <p className="text-[11px] text-amber-400/90">ℹ️ {result.fallback_reason}</p>
        </div>
      )}
      {/* Interpretation badge (AI only) */}
      {isAi && result.interpretation && (
        <div className="px-5 py-3 bg-white/[0.02]">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-400/90 mb-0.5">✦ IA interpretó</p>
          <p className="text-xs text-zinc-300 leading-snug">{result.interpretation}</p>
        </div>
      )}

      {/* Reasoning (AI only) */}
      {isAi && result.ai_reasoning && (
        <div className="px-5 py-3 bg-emerald-400/[0.04]">
          <p className="text-xs text-zinc-400 leading-snug">{result.ai_reasoning}</p>
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
                <p className="text-[10px] text-zinc-600 uppercase tracking-wide">{leg.league} · {leg.market}</p>
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
