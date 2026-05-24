"use client"

import { useState } from "react"
import { getCombinada } from "@/lib/api"
import { DisclaimerBanner } from "@/components/legal/DisclaimerBanner"
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
}

type ModeKey = "safe" | "balanced" | "dream"

const MODES: { key: ModeKey; label: string; icon: string; legs: string; desc: string; premium: boolean; accent: string; bar: string }[] = [
  { key: "safe",     label: "Segura",     icon: "shield",     legs: "2 patas", desc: "Selecciones más probables", premium: false, accent: "text-emerald-400", bar: "bg-emerald-500" },
  { key: "balanced", label: "Balanceada", icon: "stats",      legs: "3 patas", desc: "Equilibrio riesgo/recompensa", premium: true, accent: "text-amber-400", bar: "bg-amber-400" },
  { key: "dream",    label: "Soñadora",   icon: "spark",      legs: "5 patas", desc: "Cuota alta, más riesgo", premium: true, accent: "text-rose-400", bar: "bg-rose-500" },
]

const LEAGUES = [
  { value: "", label: "Todas las ligas" },
  { value: "1", label: "LaLiga" },
  { value: "2", label: "Premier League" },
  { value: "3", label: "Bundesliga" },
  { value: "4", label: "Serie A" },
  { value: "5", label: "Ligue 1" },
]

export default function CombinadasPage() {
  const { isPremium, isPro } = usePlan()
  const upgrade = useUpgradeModal()
  const [mode, setMode] = useState<ModeKey>("safe")
  const [leagueId, setLeagueId] = useState("")
  const [result, setResult] = useState<Result | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // AI combinada por prompt (PRO)
  const [aiPrompt, setAiPrompt] = useState("")
  const [aiResult, setAiResult] = useState<(Result & { ai_reasoning?: string; prompt?: string }) | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState("")

  async function generateAi() {
    if (!aiPrompt.trim()) return
    setAiLoading(true); setAiError(""); setAiResult(null)
    try {
      const r = await fetch("/api/combinadas/ai", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt }),
      })
      const d = await r.json()
      if (d?.error) setAiError(d.error)
      else setAiResult(d)
    } catch (e: any) {
      setAiError(e?.message ?? "Error al generar")
    } finally { setAiLoading(false) }
  }

  const meta = MODES.find((m) => m.key === mode)!

  function pickMode(m: typeof MODES[number]) {
    if (m.premium && !isPremium) { upgrade.show("combinadas_all_modes"); return }
    setMode(m.key)
  }

  async function generate() {
    setLoading(true); setError(""); setResult(null)
    try {
      const data = await getCombinada(mode, leagueId ? Number(leagueId) : undefined)
      if (data?.error) setError(data.error)
      else setResult(data)
    } catch {
      setError("No hay suficientes selecciones con valor. Prueba con otro modo o liga.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="px-4 py-6 max-w-3xl mx-auto safe-x space-y-5">
      <PageHeader icon="combinadas" title="Combinadas"
        subtitle="Cuotas reales y el mismo motor cuantitativo. Elige liga y perfil de riesgo." />

      <DisclaimerBanner variant="combinadas" />

      {/* Config */}
      <Card className="p-5 space-y-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-2.5">Perfil de riesgo</p>
          <div className="grid grid-cols-3 gap-2">
            {MODES.map((m) => {
              const active = mode === m.key
              const locked = m.premium && !isPremium
              return (
                <button key={m.key} onClick={() => pickMode(m)}
                  className={`relative rounded-xl p-3 border text-left transition-all tap ${
                    active ? "border-zinc-600 bg-zinc-800" : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-700"
                  }`}>
                  {locked && (
                    <span className="absolute top-2 right-2 text-zinc-600">
                      <Icon name="lock" className="w-3.5 h-3.5" />
                    </span>
                  )}
                  <Icon name={m.icon} className={`w-5 h-5 mb-1.5 ${active ? m.accent : "text-zinc-500"}`} strokeWidth={2} />
                  <p className={`text-sm font-bold ${active ? "text-white" : "text-zinc-400"}`}>{m.label}</p>
                  <p className="text-[10px] text-zinc-600 mt-0.5">{m.legs}</p>
                </button>
              )
            })}
          </div>
          <p className="text-[11px] text-zinc-500 mt-2">{meta.desc} · cuota real por pata</p>
        </div>

        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-2">Liga / Competición</p>
          <select value={leagueId} onChange={(e) => setLeagueId(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 text-sm text-zinc-200 rounded-xl px-4 py-3 outline-none">
            {LEAGUES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </div>

        <button onClick={generate} disabled={loading}
          className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-cyan-500 disabled:opacity-40 text-zinc-950 font-bold rounded-xl text-sm tap inline-flex items-center justify-center gap-2">
          {loading
            ? <><Icon name="settings" className="w-4 h-4 animate-spin" /> Generando…</>
            : <><Icon name="spark" className="w-4 h-4" strokeWidth={2.2} /> Generar combinada {meta.label}</>}
        </button>
      </Card>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-800/50 bg-amber-500/8 px-4 py-3">
          <Icon name="shield" className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-200/90 leading-snug">{error}</p>
        </div>
      )}

      {result && (
        <Card glow className="overflow-hidden animate-scale-in">
          {/* Summary */}
          <div className="p-5 border-b border-zinc-800 bg-zinc-900">
            <p className="text-[11px] text-zinc-500 mb-1.5">
              Combinada {result.mode} · {result.legs.length} patas · cuotas reales
            </p>
            <div className="flex items-end justify-between">
              <div>
                <span className={`text-4xl font-black ${meta.accent}`}>{result.combined_odd.toFixed(2)}</span>
                <span className="text-zinc-500 text-sm ml-1.5">cuota total</span>
              </div>
              <div className="text-right">
                <p className="text-lg font-black text-white">{result.combined_prob.toFixed(1)}%</p>
                <p className="text-[10px] text-zinc-600">prob. del modelo</p>
              </div>
            </div>
            <div className="mt-3 h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${meta.bar}`}
                style={{ width: `${Math.min(result.combined_prob * 1.5, 100)}%` }} />
            </div>
          </div>

          {/* Legs */}
          <div className="divide-y divide-zinc-800">
            {result.legs.map((leg, i) => (
              <div key={i} className="px-5 py-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="grid place-items-center w-6 h-6 rounded-lg bg-zinc-800 text-zinc-500 font-black text-xs shrink-0">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] text-zinc-600 uppercase tracking-wide">{leg.league} · {leg.market}</p>
                    <p className="text-sm text-white font-semibold truncate">{leg.match}</p>
                    <p className="text-xs text-emerald-400 font-medium mt-0.5 flex items-center gap-1">
                      <Icon name="check" className="w-3 h-3" strokeWidth={2.5} /> {leg.selection}
                    </p>
                    {leg.reasoning && (
                      <p className="text-[10px] text-zinc-500 mt-0.5 truncate">{leg.reasoning}</p>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xl font-black text-white">{leg.odd.toFixed(2)}</p>
                  <p className="text-[10px] text-zinc-600">{leg.prob}% modelo</p>
                </div>
              </div>
            ))}
          </div>

          <div className="px-5 py-3 bg-zinc-950/50 border-t border-zinc-800">
            <p className="text-[10px] text-zinc-700 text-center">
              Cuotas reales · análisis informativo · no constituye recomendación de apuesta · +18
            </p>
          </div>
        </Card>
      )}

      {/* ── AI Combinada por prompt (PRO) ───────────────────────────────────── */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="spark" className="w-5 h-5 text-violet-400" />
            <h2 className="text-base font-black text-white">Combinada IA por prompt</h2>
            <PremiumBadge plan="pro" />
          </div>
        </div>

        {isPro ? (
          <>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Describe lo que buscas y la IA construye una combinada del pool real de hoy.
              Ejemplos: <span className="text-zinc-400">"cuota 3", "solo LaLiga", "BTTS y Premier", "combinada segura de 2 patas".</span>
            </p>
            <textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Ej: combinada cuota 5 con Manchester City y partidos de Premier…"
              rows={3} maxLength={400}
              className="w-full bg-zinc-800 border border-zinc-700 focus:border-violet-600 rounded-xl px-4 py-3 text-sm text-white outline-none resize-none transition-colors" />
            <button onClick={generateAi} disabled={aiLoading || !aiPrompt.trim()}
              className="w-full py-3 bg-gradient-to-r from-violet-500 to-cyan-500 text-zinc-950 font-bold rounded-xl text-sm tap inline-flex items-center justify-center gap-2 disabled:opacity-40">
              {aiLoading
                ? <><Icon name="settings" className="w-4 h-4 animate-spin" /> La IA está pensando…</>
                : <><Icon name="spark" className="w-4 h-4" strokeWidth={2.2} /> Generar combinada IA</>}
            </button>
            {aiError && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-800/50 bg-amber-500/8 px-4 py-2.5">
                <Icon name="shield" className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-200/90 leading-snug">{aiError}</p>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-xl border border-violet-900/50 bg-violet-500/5 p-4 text-center">
            <Icon name="lock" className="w-6 h-6 text-violet-400 mx-auto mb-2" />
            <p className="text-sm font-bold text-white">Función exclusiva Pro</p>
            <p className="text-xs text-zinc-400 mt-1 mb-3 leading-snug max-w-xs mx-auto">
              Pide a la IA combinadas a medida: <span className="text-zinc-300">"cuota 3"</span>, <span className="text-zinc-300">"BTTS y Premier"</span>, <span className="text-zinc-300">"Madrid-Barça"</span>… Construye desde el pool real del día.
            </p>
            <Link href="/pricing" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-500 hover:bg-violet-400 text-white font-bold text-xs tap">
              <Icon name="crown" className="w-3.5 h-3.5" strokeWidth={2.2} /> Desbloquear Pro
            </Link>
          </div>
        )}

        {aiResult && (
          <div className="border-t border-zinc-800 pt-4 animate-scale-in">
            {aiResult.ai_reasoning && (
              <div className="rounded-xl border border-violet-800/50 bg-violet-500/5 px-3.5 py-2.5 mb-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-violet-300 mb-1">💡 Razonamiento de la IA</p>
                <p className="text-xs text-zinc-200 leading-snug">{aiResult.ai_reasoning}</p>
              </div>
            )}
            <div className="flex items-end justify-between mb-3">
              <div>
                <span className="text-3xl font-black text-violet-300">{aiResult.combined_odd.toFixed(2)}</span>
                <span className="text-zinc-500 text-sm ml-1.5">cuota total · {aiResult.legs.length} patas</span>
              </div>
              <div className="text-right">
                <p className="text-base font-black text-white">{aiResult.combined_prob.toFixed(1)}%</p>
                <p className="text-[10px] text-zinc-600">prob. modelo</p>
              </div>
            </div>
            <div className="divide-y divide-zinc-800 -mx-5">
              {aiResult.legs.map((leg, i) => (
                <div key={i} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="grid place-items-center w-6 h-6 rounded-lg bg-violet-500/15 text-violet-300 font-black text-xs shrink-0">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="text-[10px] text-zinc-600 uppercase tracking-wide">{leg.league} · {leg.market}</p>
                      <p className="text-sm text-white font-semibold truncate">{leg.match}</p>
                      <p className="text-xs text-violet-300 mt-0.5 flex items-center gap-1">
                        <Icon name="check" className="w-3 h-3" strokeWidth={2.5} /> {leg.selection}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-lg font-black text-white">{leg.odd.toFixed(2)}</p>
                    <p className="text-[10px] text-zinc-600">{leg.prob}% modelo</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <upgrade.Modal />
    </div>
  )
}
