"use client"

import { useState, useEffect, useRef } from "react"
import { useDebounce } from "@/hooks/useDebounce"
import { PageHeader, Card } from "@/components/ui/primitives"
import { Icon } from "@/components/ui/icons"
import { usePlan } from "@/lib/plan"
import { useUpgradeModal } from "@/components/premium"
import Link from "next/link"

interface TeamResult { id: string; name: string; slug: string; league: string; country: string; flag: string }
interface PlayerResult {
  id: string; name: string; shortName: string
  position: string; positionAbbr: string
  age: number | null; jersey: string | null; nationality: string | null
  teamId: string; teamName: string; league: string; leagueSlug: string; flag: string
  espnUrl: string | null
}
interface TeamStats {
  id: number; name: string; league: string; season: string
  played: number; wins: number; draws: number; losses: number
  goals_for: number; goals_against: number
  xg_for: number | null; xg_against: number | null
  btts_pct: number; over25_pct: number; clean_sheets: number
  avg_corners_for: number | null; avg_corners_against: number | null; avg_cards: number | null
  avg_yellows?: number | null; avg_reds?: number | null; avg_fouls?: number | null
  avg_shots?: number | null; avg_shots_on_target?: number | null; avg_possession?: number | null
  advanced_samples?: number
  form: string[]
  home: { played: number; wins: number; draws: number; losses: number; goals_for: number; goals_against: number }
  away: { played: number; wins: number; draws: number; losses: number; goals_for: number; goals_against: number }
}

const FORM_COLOR: Record<string, string> = {
  W: "bg-emerald-500 text-white",
  D: "bg-zinc-600 text-zinc-300",
  L: "bg-red-500/80 text-white",
}

const QUICK: TeamResult[] = [
  { id: "86",  name: "Real Madrid",     slug: "esp.1", league: "LaLiga",         country: "España",     flag: "🇪🇸" },
  { id: "382", name: "Manchester City", slug: "eng.1", league: "Premier League", country: "Inglaterra", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { id: "160", name: "PSG",             slug: "fra.1", league: "Ligue 1",        country: "Francia",    flag: "🇫🇷" },
  { id: "132", name: "Bayern Munich",   slug: "ger.1", league: "Bundesliga",     country: "Alemania",   flag: "🇩🇪" },
]

async function searchTeams(q: string) {
  const res = await fetch(`/api/stats/search?q=${encodeURIComponent(q)}`)
  return res.json()
}

async function searchPlayers(q: string) {
  const res = await fetch(`/api/stats/player-search?q=${encodeURIComponent(q)}`)
  return res.json()
}

// ── Rate limit para análisis IA (localStorage) ─────────────────────────────
function getAnalysisUsage(): { count: number; date: string } {
  try {
    const raw = localStorage.getItem("sp_analyze_usage")
    if (raw) return JSON.parse(raw)
  } catch {}
  return { count: 0, date: "" }
}
function incrementAnalysisUsage() {
  const today = new Date().toISOString().slice(0, 10)
  const prev = getAnalysisUsage()
  const count = prev.date === today ? prev.count + 1 : 1
  try { localStorage.setItem("sp_analyze_usage", JSON.stringify({ count, date: today })) } catch {}
  return count
}
function canRunAnalysis(isPro: boolean): { ok: boolean; remaining: number } {
  if (isPro) return { ok: true, remaining: Infinity }
  const today = new Date().toISOString().slice(0, 10)
  const { count, date } = getAnalysisUsage()
  const used = date === today ? count : 0
  return { ok: used < 1, remaining: Math.max(0, 1 - used) }
}

async function getTeamStats(id: string, slug: string) {
  const res = await fetch(`/api/stats/team?id=${id}&slug=${encodeURIComponent(slug)}`)
  return res.json()
}

export default function StatsPage() {
  const { isPremium, isPro } = usePlan()
  const upgrade = useUpgradeModal()

  const [query, setQuery] = useState("")
  const [teamResults, setTeamResults] = useState<TeamResult[]>([])
  const [playerResults, setPlayerResults] = useState<PlayerResult[]>([])
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerResult | null>(null)
  const [stats, setStats] = useState<TeamStats | null>(null)
  const [loadingSearch, setLoadingSearch] = useState(false)
  const [loadingTeam, setLoadingTeam] = useState(false)

  // Análisis IA
  const [analysis, setAnalysis] = useState("")
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisError, setAnalysisError] = useState("")
  const [analyzeUsed, setAnalyzeUsed] = useState(false)
  const analysisRef = useRef<HTMLDivElement>(null)

  const debouncedQuery = useDebounce(query, 350)

  // Check analysis usage on mount
  useEffect(() => {
    if (isPremium && !isPro) {
      const { ok } = canRunAnalysis(false)
      setAnalyzeUsed(!ok)
    }
  }, [isPremium, isPro])

  useEffect(() => {
    if (debouncedQuery.length < 2) { setTeamResults([]); setPlayerResults([]); return }
    setLoadingSearch(true)
    Promise.all([
      searchTeams(debouncedQuery).then((d) => setTeamResults(d.teams ?? [])).catch(() => null),
      searchPlayers(debouncedQuery).then((d) => setPlayerResults(d.players ?? [])).catch(() => null),
    ]).finally(() => setLoadingSearch(false))
  }, [debouncedQuery])

  async function loadTeam(t: TeamResult) {
    setTeamResults([]); setPlayerResults([])
    setSelectedPlayer(null)
    setQuery(t.name)
    setStats(null)
    setAnalysis("")
    setAnalysisError("")
    setLoadingTeam(true)
    try {
      const data = await getTeamStats(String(t.id), t.slug)
      setStats(data)
    } finally {
      setLoadingTeam(false)
    }
  }

  function selectPlayer(p: PlayerResult) {
    setTeamResults([]); setPlayerResults([])
    setQuery(p.name)
    setSelectedPlayer(p)
    setStats(null)
    setAnalysis("")
    setAnalysisError("")
  }

  async function runAnalysis() {
    if (!stats) return
    if (!isPremium) { upgrade.show("stats_advanced"); return }

    // Rate limit: Premium = 1/día, Pro = ilimitado
    const { ok } = canRunAnalysis(isPro)
    if (!ok) {
      setAnalysisError("Has usado tu análisis diario. Vuelve mañana o mejora a Pro para análisis ilimitados.")
      return
    }

    setAnalysisLoading(true)
    setAnalysis("")
    setAnalysisError("")

    try {
      const res = await fetch("/api/stats/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(stats),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setAnalysisError(err.error ?? "Error al generar el análisis.")
        return
      }

      const reader = res.body?.getReader()
      if (!reader) { setAnalysisError("No se pudo leer la respuesta."); return }

      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          const raw = line.slice(6).trim()
          if (raw === "[DONE]") break
          try {
            const { text } = JSON.parse(raw)
            setAnalysis((prev) => prev + text)
          } catch {}
        }
      }

      // Registrar uso y actualizar estado
      incrementAnalysisUsage()
      if (!isPro) setAnalyzeUsed(true)

      setTimeout(() => analysisRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100)

    } catch (e: any) {
      setAnalysisError(e.message ?? "Error de red")
    } finally {
      setAnalysisLoading(false)
    }
  }

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto safe-x">
      <PageHeader icon="stats" title="Estadísticas"
        subtitle="Busca cualquier equipo del mundo · Datos reales de ESPN" />

      {/* Search */}
      <div className="relative mb-6">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">
          <Icon name="stats" className="w-4 h-4" />
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setStats(null); setAnalysis(""); setAnalysisError("") }}
          placeholder="Busca un equipo: Real Madrid, Boca Juniors, Al Nassr…"
          className="w-full bg-zinc-900 border border-zinc-700 focus:border-zinc-500
            text-white placeholder-zinc-600 rounded-2xl pl-10 pr-4 py-3.5 text-sm outline-none transition-colors"
        />
        {loadingSearch && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">Buscando…</span>
        )}
        {(teamResults.length > 0 || playerResults.length > 0) && (
          <div className="absolute top-full mt-2 w-full bg-zinc-900 border border-zinc-700
            rounded-2xl overflow-hidden z-20 shadow-2xl max-h-80 overflow-y-auto">
            {/* Equipos */}
            {teamResults.length > 0 && (
              <>
                <p className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-zinc-600 border-b border-zinc-800">
                  Equipos
                </p>
                {teamResults.slice(0, 5).map((t) => (
                  <button key={`team-${t.slug}-${t.id}`} onClick={() => loadTeam(t)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800
                      transition-colors text-left border-b border-zinc-800 last:border-0">
                    <span className="text-xl">{t.flag}</span>
                    <div>
                      <p className="text-sm font-medium text-white">{t.name}</p>
                      <p className="text-xs text-zinc-500">{t.league} · {t.country}</p>
                    </div>
                  </button>
                ))}
              </>
            )}
            {/* Jugadores */}
            {playerResults.length > 0 && (
              <>
                <p className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-zinc-600 border-b border-zinc-800">
                  Jugadores
                </p>
                {playerResults.slice(0, 5).map((p) => (
                  <button key={`player-${p.id}`} onClick={() => selectPlayer(p)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800
                      transition-colors text-left border-b border-zinc-800 last:border-0">
                    <div className="grid place-items-center w-9 h-9 rounded-xl bg-zinc-800 border border-zinc-700 shrink-0">
                      <span className="text-xs font-black text-zinc-400">{p.jersey ?? p.positionAbbr}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{p.name}</p>
                      <p className="text-xs text-zinc-500">{p.position} · {p.teamName} · {p.flag} {p.league}</p>
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Loading skeleton */}
      {loadingTeam && (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-zinc-900 animate-pulse" />
          ))}
        </div>
      )}

      {/* Player card */}
      {selectedPlayer && !loadingTeam && (
        <PlayerCard player={selectedPlayer} />
      )}

      {/* Stats + AI button */}
      {stats && !loadingTeam && (
        <TeamStatsView
          stats={stats}
          isPremium={isPremium}
          isPro={isPro}
          analyzeUsed={analyzeUsed}
          onAnalyze={runAnalysis}
          analysisLoading={analysisLoading}
          analysis={analysis}
          analysisError={analysisError}
          analysisRef={analysisRef}
        />
      )}

      {/* Empty state */}
      {!stats && !selectedPlayer && !loadingTeam && (
        <div className="text-center py-16 space-y-3">
          <p className="text-5xl">📊</p>
          <p className="text-zinc-400 font-medium">Busca un equipo para ver sus estadísticas</p>
          <p className="text-xs text-zinc-600">Más de 300 equipos de 19 ligas en todo el mundo</p>
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {QUICK.map((t) => (
              <button key={t.id} onClick={() => loadTeam(t)}
                className="text-xs px-3 py-1.5 bg-zinc-900 border border-zinc-800
                  text-zinc-400 hover:text-white rounded-xl transition-colors">
                {t.flag} {t.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <upgrade.Modal />
    </div>
  )
}

// ─── Player card ─────────────────────────────────────────────────────────────

function PlayerCard({ player }: { player: PlayerResult }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 animate-fade-in">
      <div className="flex items-start gap-4">
        <div className="grid place-items-center w-14 h-14 rounded-2xl bg-zinc-800 border border-zinc-700 shrink-0">
          <span className="text-xl font-black text-zinc-300">
            {player.jersey ? `#${player.jersey}` : player.positionAbbr}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-black text-white leading-tight">{player.name}</h2>
          <p className="text-sm text-zinc-400 mt-0.5">{player.position}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 px-2.5 py-1 rounded-full">
              {player.flag} {player.teamName}
            </span>
            <span className="text-xs bg-zinc-800 border border-zinc-700 text-zinc-500 px-2.5 py-1 rounded-full">
              {player.league}
            </span>
            {player.age && (
              <span className="text-xs bg-zinc-800 border border-zinc-700 text-zinc-500 px-2.5 py-1 rounded-full">
                {player.age} años
              </span>
            )}
            {player.nationality && (
              <span className="text-xs bg-zinc-800 border border-zinc-700 text-zinc-500 px-2.5 py-1 rounded-full">
                {player.nationality}
              </span>
            )}
          </div>
        </div>
      </div>
      {player.espnUrl && (
        <a href={player.espnUrl} target="_blank" rel="noopener noreferrer"
          className="mt-4 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl
            bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-semibold transition-colors tap">
          <Icon name="arrowRight" className="w-4 h-4" strokeWidth={2.2} />
          Ver estadísticas completas en ESPN
        </a>
      )}
      <p className="text-[10px] text-zinc-700 text-center mt-3">
        Datos biográficos de ESPN · estadísticas de partidos disponibles en ESPN
      </p>
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ icon, value, label, color }: { icon: string; value: string; label: string; color: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
      <p className="text-2xl mb-0.5">{icon}</p>
      <p className={`text-xl font-black ${color}`}>{value}</p>
      <p className="text-[10px] text-zinc-600 mt-0.5">{label}</p>
    </div>
  )
}

// ─── Render del markdown simple (negrita, saltos de línea) ────────────────────
// CN-007: No dangerouslySetInnerHTML — parse inline **bold** with React elements

function InlineLine({ text }: { text: string }) {
  // Split on **bold** markers and render as React spans/strongs
  const parts = text.split(/\*\*(.+?)\*\*/g)
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1
          ? <strong key={i} className="text-white font-bold">{part}</strong>
          : <span key={i}>{part}</span>
      )}
    </>
  )
}

function AnalysisText({ text }: { text: string }) {
  const lines = text.split("\n")
  return (
    <div className="space-y-0.5">
      {lines.map((line, i) => {
        const isBold = /^\*\*/.test(line)
        return (
          <p key={i} className={isBold ? "text-white font-bold mt-4 first:mt-0" : "text-zinc-300 text-sm leading-relaxed"}>
            {line ? <InlineLine text={line} /> : <>&nbsp;</>}
          </p>
        )
      })}
    </div>
  )
}

// ─── Vista completa del equipo ────────────────────────────────────────────────

function TeamStatsView({ stats, isPremium, isPro, analyzeUsed, onAnalyze, analysisLoading, analysis, analysisError, analysisRef }: {
  stats: TeamStats
  isPremium: boolean
  isPro: boolean
  analyzeUsed: boolean
  onAnalyze: () => void
  analysisLoading: boolean
  analysis: string
  analysisError: string
  analysisRef: React.RefObject<HTMLDivElement>
}) {
  const cleanSheetPct = stats.played ? Math.round((stats.clean_sheets / stats.played) * 100) : 0
  const goalsPerGame = stats.played ? (stats.goals_for / stats.played).toFixed(2) : "—"
  const goalsAgainstPerGame = stats.played ? (stats.goals_against / stats.played).toFixed(2) : "—"
  const points = stats.wins * 3 + stats.draws

  return (
    <div className="space-y-5">
      {/* Header + botón análisis IA */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        <div className="flex items-start justify-between mb-4 gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-black text-white">{stats.name}</h2>
            <p className="text-sm text-zinc-500">{stats.league} · Temporada {stats.season}</p>
            <p className="text-xs text-zinc-600 mt-0.5">{stats.played} partidos · {points} puntos</p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="flex gap-1">
              {stats.form.map((r, i) => (
                <span key={i} className={`text-[10px] font-bold w-5 h-5 rounded flex items-center justify-center ${FORM_COLOR[r] ?? "bg-zinc-700"}`}>
                  {r}
                </span>
              ))}
            </div>
            {/* ── BOTÓN ANÁLISIS IA ───────────────────────────────── */}
            <button
              onClick={onAnalyze}
              disabled={analysisLoading || (isPremium && !isPro && analyzeUsed)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold tap transition-all ${
                !isPremium
                  ? "bg-zinc-800 border border-zinc-700 text-zinc-400 hover:border-zinc-600"
                  : isPremium && !isPro && analyzeUsed
                  ? "bg-zinc-800 border border-zinc-700 text-zinc-500 cursor-not-allowed opacity-60"
                  : "bg-gradient-to-r from-emerald-500 to-cyan-500 text-zinc-950 hover:opacity-90 disabled:opacity-50"
              }`}
            >
              {analysisLoading ? (
                <><Icon name="settings" className="w-3.5 h-3.5 animate-spin" />Analizando…</>
              ) : !isPremium ? (
                <><Icon name="lock" className="w-3.5 h-3.5" strokeWidth={2} />Análisis IA
                  <span className="text-[9px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-800/60 px-1 py-0.5 rounded-full leading-none">⭐</span>
                </>
              ) : isPremium && !isPro && analyzeUsed ? (
                <><Icon name="lock" className="w-3.5 h-3.5" strokeWidth={2} />Usado hoy</>
              ) : (
                <><Icon name="spark" className="w-3.5 h-3.5" strokeWidth={2.2} />
                  Análisis IA{!isPro && <span className="opacity-60">· 1/día</span>}
                </>
              )}
            </button>
          </div>
        </div>

        {/* W/D/L */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-emerald-500/10 rounded-xl p-3">
            <p className="text-2xl font-black text-emerald-400">{stats.wins}</p>
            <p className="text-[10px] text-zinc-500">Victorias</p>
          </div>
          <div className="bg-zinc-800/50 rounded-xl p-3">
            <p className="text-2xl font-black text-zinc-300">{stats.draws}</p>
            <p className="text-[10px] text-zinc-500">Empates</p>
          </div>
          <div className="bg-red-500/10 rounded-xl p-3">
            <p className="text-2xl font-black text-red-400">{stats.losses}</p>
            <p className="text-[10px] text-zinc-500">Derrotas</p>
          </div>
        </div>
      </div>

      {/* ── ANÁLISIS IA — resultado ─────────────────────────────────────────── */}
      {!isPremium && (
        <div ref={analysisRef} className="rounded-2xl border border-emerald-800/40 bg-emerald-500/5 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="grid place-items-center w-10 h-10 rounded-xl bg-emerald-500/10 shrink-0">
              <Icon name="spark" className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-black text-white">Análisis Scout IA</p>
              <p className="text-xs text-zinc-500">Disponible en Premium ⭐ y Pro 👑</p>
            </div>
          </div>
          {/* Vista previa difuminada de cómo se vería */}
          <div className="relative rounded-xl overflow-hidden">
            <div className="blur-[5px] opacity-40 pointer-events-none select-none space-y-1.5 px-1">
              <p className="text-sm text-white font-bold">📊 Perfil general</p>
              <p className="text-sm text-zinc-300 leading-relaxed">Equipo con presencia ofensiva clara, marcando por encima de la media de la liga con un volumen alto de tiros generados por partido. Su solidez defensiva varía notablemente según el contexto…</p>
              <p className="text-sm text-white font-bold mt-2">🏟️ Comportamiento local vs visitante</p>
              <p className="text-sm text-zinc-300 leading-relaxed">Como local domina con claridad: alta tasa de victoria y media goleadora superior. Fuera de casa el rendimiento cae significativamente, con más goles encajados y menor control del partido…</p>
              <p className="text-sm text-white font-bold mt-2">💡 Oportunidades de mercado</p>
              <p className="text-sm text-zinc-300 leading-relaxed">El porcentaje BTTS y Over 2.5 histórico sugiere que los mercados de goles tienen respaldo estadístico en partidos donde…</p>
            </div>
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-zinc-950/60 to-zinc-950/95 flex items-end justify-center pb-4">
              <Link href="/pricing"
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-zinc-950 font-bold text-sm tap">
                <Icon name="crown" className="w-4 h-4" strokeWidth={2.2} />
                Desbloquear con Premium
              </Link>
            </div>
          </div>
        </div>
      )}

      {analysisError && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-800/50 bg-amber-500/8 px-4 py-3">
          <Icon name="shield" className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-200/90 leading-snug">{analysisError}</p>
        </div>
      )}

      {(analysis || analysisLoading) && (
        <div ref={analysisRef} className="rounded-2xl border border-emerald-800/40 bg-gradient-to-b from-emerald-500/5 to-zinc-900 overflow-hidden animate-fade-in">
          {/* Header del informe */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-800">
            <div className="grid place-items-center w-9 h-9 rounded-xl bg-emerald-500/15 shrink-0">
              <Icon name="spark" className="w-4.5 h-4.5 text-emerald-400" strokeWidth={2} />
            </div>
            <div>
              <p className="text-sm font-black text-white">Análisis Scout IA · {stats.name}</p>
              <p className="text-[10px] text-zinc-500">Basado exclusivamente en datos reales de ESPN · {stats.season}</p>
            </div>
            {analysisLoading && (
              <Icon name="settings" className="w-4 h-4 text-emerald-400 animate-spin ml-auto shrink-0" />
            )}
          </div>
          {/* Contenido */}
          <div className="px-5 py-4">
            {analysis
              ? <AnalysisText text={analysis} />
              : <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className={`h-3.5 bg-zinc-800 rounded animate-pulse ${i === 2 ? "w-3/4" : "w-full"}`} />
                  ))}
                </div>
            }
          </div>
          {!analysisLoading && analysis && (
            <div className="px-5 py-2.5 border-t border-zinc-800 bg-zinc-950/40">
              <p className="text-[10px] text-zinc-700 text-center">
                Análisis generado por IA · basado solo en estadísticas ESPN · no constituye consejo de apuesta · +18
              </p>
            </div>
          )}
        </div>
      )}

      {/* Goals & available metrics */}
      <div>
        <p className="text-xs text-zinc-600 uppercase tracking-wider mb-3">Goles y ofensiva</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon="⚽" value={String(stats.goals_for)}     label="Goles a favor"   color="text-emerald-400" />
          <StatCard icon="🥅" value={String(stats.goals_against)} label="Goles en contra" color="text-red-400" />
          <StatCard icon="🎯" value={goalsPerGame}                 label="Goles/partido"   color="text-amber-400" />
          <StatCard icon="🛡️" value={goalsAgainstPerGame}          label="Encaj./partido"  color="text-blue-400" />
        </div>
      </div>

      {/* Betting markets */}
      <div>
        <p className="text-xs text-zinc-600 uppercase tracking-wider mb-3">Mercados de apuesta</p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "BTTS",         pct: stats.btts_pct,   color: "amber" },
            { label: "Over 2.5",     pct: stats.over25_pct, color: "blue" },
            { label: "Portería a 0", pct: cleanSheetPct,    color: "emerald" },
          ].map((c) => {
            const colors: Record<string, string> = { amber: "text-amber-400", blue: "text-blue-400", emerald: "text-emerald-400" }
            const bars: Record<string, string>   = { amber: "bg-amber-400",   blue: "bg-blue-500",   emerald: "bg-emerald-500" }
            return (
              <div key={c.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
                <p className={`text-2xl font-black ${colors[c.color]}`}>{c.pct}%</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">{c.label}</p>
                <div className="mt-2 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div className={`h-full ${bars[c.color]} rounded-full`} style={{ width: `${c.pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Stats avanzadas */}
      {(stats.advanced_samples ?? 0) > 0 && (
        <div>
          <p className="text-xs text-zinc-600 uppercase tracking-wider mb-3">
            Stats avanzadas · medias últimos {stats.advanced_samples} partidos
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon="⛳" value={stats.avg_corners_for != null ? stats.avg_corners_for.toFixed(1) : "—"}      label="Córners a favor/PJ"   color="text-emerald-400" />
            <StatCard icon="🚩" value={stats.avg_corners_against != null ? stats.avg_corners_against.toFixed(1) : "—"} label="Córners en contra/PJ" color="text-blue-400" />
            <StatCard icon="🟨" value={stats.avg_yellows != null ? stats.avg_yellows.toFixed(1) : "—"}              label="Amarillas/PJ"         color="text-amber-400" />
            <StatCard icon="🟥" value={stats.avg_reds != null ? stats.avg_reds.toFixed(2) : "—"}                    label="Rojas/PJ"             color="text-red-400" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
            <StatCard icon="⚔️" value={stats.avg_fouls != null ? stats.avg_fouls.toFixed(1) : "—"}                  label="Faltas/PJ"            color="text-rose-400" />
            <StatCard icon="🎯" value={stats.avg_shots != null ? stats.avg_shots.toFixed(1) : "—"}                  label="Tiros/PJ"             color="text-violet-400" />
            <StatCard icon="🎯" value={stats.avg_shots_on_target != null ? stats.avg_shots_on_target.toFixed(1) : "—"} label="A puerta/PJ"       color="text-violet-300" />
            <StatCard icon="⚽" value={stats.avg_possession != null ? stats.avg_possession + "%" : "—"}             label="Posesión media"       color="text-cyan-400" />
          </div>
        </div>
      )}

      {/* Home vs Away */}
      <div>
        <p className="text-xs text-zinc-600 uppercase tracking-wider mb-3">Local vs Visitante</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "🏟️ Como local",    data: stats.home },
            { label: "✈️ Como visitante", data: stats.away },
          ].map((s) => (
            <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <p className="text-xs font-bold text-zinc-400 mb-3">{s.label}</p>
              <div className="flex justify-between text-center">
                <div>
                  <p className="text-xl font-black text-emerald-400">{s.data.wins}</p>
                  <p className="text-[10px] text-zinc-600">V</p>
                </div>
                <div>
                  <p className="text-xl font-black text-zinc-400">{s.data.draws}</p>
                  <p className="text-[10px] text-zinc-600">E</p>
                </div>
                <div>
                  <p className="text-xl font-black text-red-400">{s.data.losses}</p>
                  <p className="text-[10px] text-zinc-600">D</p>
                </div>
                <div>
                  <p className="text-lg font-black text-white">{s.data.goals_for}-{s.data.goals_against}</p>
                  <p className="text-[10px] text-zinc-600">Goles</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Data note */}
      <p className="text-[11px] text-zinc-700 text-center pb-2">
        Datos reales de ESPN · stats avanzadas del boxscore de los últimos partidos · xG no disponible en esta fuente
      </p>
    </div>
  )
}
