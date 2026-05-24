"use client"

import { useEffect, useState } from "react"
import { getChallenges } from "@/lib/api"
import { DisclaimerBanner } from "@/components/legal/DisclaimerBanner"
import { PageHeader } from "@/components/ui/primitives"

interface DailyPick {
  match: string; league: string; kickoff: string
  selection: string; odd: number; market: string
}
interface Challenge {
  id: string; title: string; description: string
  target_picks: number; min_odd: number
  ends_at: string; prize_description: string; payout_info: string
  daily_pick: DailyPick | null
  enrolled: boolean
}

const COLORS = ["emerald", "amber", "rose", "violet", "blue"]
const RING: Record<string, string> = {
  emerald: "border-emerald-700/60 hover:border-emerald-500",
  amber:   "border-amber-700/60   hover:border-amber-500",
  rose:    "border-rose-700/60    hover:border-rose-500",
  violet:  "border-violet-700/60  hover:border-violet-500",
  blue:    "border-blue-700/60    hover:border-blue-500",
}
const ACCENT: Record<string, string> = {
  emerald: "text-emerald-400", amber: "text-amber-400",
  rose: "text-rose-400", violet: "text-violet-400", blue: "text-blue-400",
}
const BAR: Record<string, string> = {
  emerald: "bg-emerald-500", amber: "bg-amber-400",
  rose: "bg-rose-500", violet: "bg-violet-500", blue: "bg-blue-500",
}
const BADGE: Record<string, string> = {
  emerald: "bg-emerald-500/15 border-emerald-700 text-emerald-400",
  amber:   "bg-amber-500/15   border-amber-700   text-amber-400",
  rose:    "bg-rose-500/15    border-rose-700    text-rose-400",
  violet:  "bg-violet-500/15  border-violet-700  text-violet-400",
  blue:    "bg-blue-500/15    border-blue-700    text-blue-400",
}

function renderBold(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return parts.map((p, i) =>
    p.startsWith("**") ? <strong key={i} className="text-white">{p.slice(2, -2)}</strong> : p
  )
}

export default function RetosPage() {
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [loading, setLoading] = useState(true)
  const [enrolled, setEnrolled] = useState<Set<string>>(new Set())
  const [tab, setTab] = useState<"all" | "mine">("all")

  useEffect(() => {
    getChallenges()
      .then((d) => setChallenges(d.challenges ?? []))
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [])

  const shown = tab === "mine" ? challenges.filter((c) => enrolled.has(c.id)) : challenges

  return (
    <div className="px-4 py-6 max-w-5xl mx-auto safe-x">
      <PageHeader icon="trophy" title="Retos"
        subtitle="Desafíos de tracking estadístico con pick diario real. Sin dinero real, solo simulaciones." />

      <div className="mb-5">
        <DisclaimerBanner variant="retos" />
      </div>

      <div className="flex gap-2 mb-6">
        {(["all", "mine"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors
              ${tab === t ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
          >
            {t === "all" ? "Todos los retos" : `Mis retos (${enrolled.size})`}
          </button>
        ))}
      </div>

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-64 rounded-2xl bg-zinc-900 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && shown.length === 0 && tab === "mine" && (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">🏆</p>
          <p className="text-zinc-400 font-medium">Aún no te has inscrito en ningún reto</p>
          <button onClick={() => setTab("all")} className="mt-3 text-sm text-emerald-400 hover:underline">
            Ver todos los retos →
          </button>
        </div>
      )}

      {!loading && shown.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {shown.map((c, i) => {
            const color = COLORS[i % COLORS.length]
            const isEnrolled = enrolled.has(c.id)
            const daysLeft = Math.max(0, Math.round((new Date(c.ends_at).getTime() - Date.now()) / 86400000))
            const kickoffTime = c.daily_pick
              ? new Date(c.daily_pick.kickoff).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
              : null

            return (
              <div key={c.id} className={`bg-zinc-900 border rounded-2xl overflow-hidden transition-all ${RING[color]}`}>
                {/* Header */}
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className={`text-lg font-black ${ACCENT[color]}`}>{c.title}</h3>
                      <p className="text-xs text-zinc-600 mt-0.5">
                        {c.target_picks} picks consecutivos · {daysLeft}d restantes
                      </p>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full border ${BADGE[color]}`}>
                      Cuota min. {c.min_odd.toFixed(1)}
                    </span>
                  </div>

                  <p className="text-sm text-zinc-400 leading-relaxed mb-3">{c.description}</p>

                  {/* Payout highlight */}
                  <div className="bg-zinc-800/60 rounded-xl px-3 py-2.5 mb-4 border border-zinc-700/50">
                    <p className="text-[11px] text-zinc-500 mb-0.5">💰 Potencial con 10€ (simulado)</p>
                    <p className="text-sm text-zinc-300 leading-snug">{renderBold(c.payout_info)}</p>
                  </div>

                  <div className="flex gap-3 text-xs text-zinc-600 mb-4">
                    <span>🎯 Cuota mínima {c.min_odd.toFixed(1)}</span>
                    <span>·</span>
                    <span>🏆 {c.prize_description}</span>
                  </div>
                </div>

                {/* Daily pick box */}
                {c.daily_pick && (
                  <div className="border-t border-zinc-800 px-5 py-3 bg-zinc-950/40">
                    <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1.5">
                      Pick de hoy · {c.daily_pick.league}
                    </p>
                    {isEnrolled ? (
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-zinc-200">{c.daily_pick.match}</p>
                          <p className={`text-xs mt-0.5 ${ACCENT[color]}`}>
                            → {c.daily_pick.selection} · cuota real {c.daily_pick.odd.toFixed(2)}
                          </p>
                        </div>
                        {kickoffTime && (
                          <span className="text-xs text-zinc-600 shrink-0 ml-2">⏰ {kickoffTime}</span>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-zinc-600">
                        <span className="text-base">🔒</span>
                        <p className="text-xs">Inscríbete para ver el pick diario</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Enroll button */}
                <div className="px-5 pb-4 pt-3">
                  {isEnrolled ? (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-500">Tu progreso</span>
                        <span className={ACCENT[color]}>0 / {c.target_picks} picks</span>
                      </div>
                      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div className={`h-full ${BAR[color]} rounded-full`} style={{ width: "0%" }} />
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setEnrolled((prev) => new Set([...prev, c.id]))}
                      className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors
                        bg-zinc-800 hover:bg-zinc-700 ${ACCENT[color]}`}
                    >
                      Inscribirse al reto →
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <p className="text-center text-[11px] text-zinc-700 mt-8">
        Los retos son simulaciones estadísticas. No implican dinero real. Los payouts son cálculos hipotéticos.
      </p>
    </div>
  )
}
