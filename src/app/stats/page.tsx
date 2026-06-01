"use client"

import { useState, useEffect, useRef } from "react"
import { useDebounce } from "@/hooks/useDebounce"
import { PageHeader, Card, Badge, Button, Spinner, Alert, EmptyState } from "@/components/ui/primitives"
import { Icon } from "@/components/ui/icons"
import { usePlan } from "@/lib/plan"
import { useUpgradeModal } from "@/components/premium"
import Link from "next/link"

/* ────────────────────────────────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────────────────────────────────── */

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

/* ────────────────────────────────────────────────────────────────────────────
   Constants
   ──────────────────────────────────────────────────────────────────────────── */

const FORM_COLOR: Record<string, string> = {
  W: "bg-emerald-500/90 text-white",
  D: "bg-zinc-700 text-zinc-200",
  L: "bg-rose-500/90 text-white",
}

const QUICK: TeamResult[] = [
  { id: "86",  name: "Real Madrid",     slug: "esp.1", league: "LaLiga",         country: "España",     flag: "🇪🇸" },
  { id: "382", name: "Manchester City", slug: "eng.1", league: "Premier League", country: "Inglaterra", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { id: "160", name: "PSG",             slug: "fra.1", league: "Ligue 1",        country: "Francia",    flag: "🇫🇷" },
  { id: "132", name: "Bayern Munich",   slug: "ger.1", league: "Bundesliga",     country: "Alemania",   flag: "🇩🇪" },
]

/* ────────────────────────────────────────────────────────────────────────────
   API helpers
   ──────────────────────────────────────────────────────────────────────────── */

async function searchTeams(q: string) {
  const res = await fetch(`/api/stats/search?q=${encodeURIComponent(q)}`)
  return res.json()
}
async function searchPlayers(q: string) {
  const res = await fetch(`/api/stats/player-search?q=${encodeURIComponent(q)}`)
  return res.json()
}
async function getTeamStats(id: string, slug: string) {
  const res = await fetch(`/api/stats/team?id=${id}&slug=${encodeURIComponent(slug)}`)
  return res.json()
}

/* ────────────────────────────────────────────────────────────────────────────
   AI usage tracking (Premium = 1/day, Pro = unlimited)
   ──────────────────────────────────────────────────────────────────────────── */

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

/* ════════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ════════════════════════════════════════════════════════════════════════════ */

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

  const [analysis, setAnalysis] = useState("")
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisError, setAnalysisError] = useState("")
  const [analyzeUsed, setAnalyzeUsed] = useState(false)
  const analysisRef = useRef<HTMLDivElement>(null)

  const debouncedQuery = useDebounce(query, 350)

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

      incrementAnalysisUsage()
      if (!isPro) setAnalyzeUsed(true)

      setTimeout(() => analysisRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100)

    } catch (e: any) {
      setAnalysisError(e.message ?? "Error de red")
    } finally {
      setAnalysisLoading(false)
    }
  }

  const showEmpty = !stats && !selectedPlayer && !loadingTeam

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10 safe-x">
      <PageHeader
        icon="stats"
        title="Estadísticas"
        subtitle="Busca cualquier equipo o jugador del mundo. Datos verificados de ESPN sin filtros."
      />

      {/* Search */}
      <div className="relative mb-8">
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">
            <Icon name="search" className="w-4 h-4" strokeWidth={2} />
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setStats(null); setAnalysis(""); setAnalysisError("") }}
            placeholder="Real Madrid, Mbappé, Boca Juniors…"
            className="w-full h-14 bg-zinc-900/55 border border-white/[0.05] focus:border-emerald-500/40 focus:bg-zinc-900/70 focus:shadow-[0_0_0_4px_rgba(82,181,145,0.10)]
              text-white placeholder-zinc-600 rounded-2xl pl-11 pr-12 text-[15px] outline-none transition-all"
          />
          {loadingSearch && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2">
              <Spinner className="w-4 h-4" />
            </span>
          )}
        </div>

        {(teamResults.length > 0 || playerResults.length > 0) && (
          <div className="absolute top-full mt-2 w-full bg-zinc-900/95 backdrop-blur-2xl border border-white/[0.07]
            rounded-2xl overflow-hidden z-30 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)] max-h-[60vh] overflow-y-auto">
            {teamResults.length > 0 && (
              <>
                <p className="px-4 pt-3 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  Equipos
                </p>
                {teamResults.slice(0, 5).map((t) => (
                  <button key={`team-${t.slug}-${t.id}`} onClick={() => loadTeam(t)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04]
                      transition-colors text-left">
                    <span className="text-xl shrink-0">{t.flag}</span>
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-white truncate">{t.name}</p>
                      <p className="text-[12px] text-zinc-500 truncate">{t.league} · {t.country}</p>
                    </div>
                  </button>
                ))}
              </>
            )}
            {playerResults.length > 0 && (
              <>
                <p className="px-4 pt-3 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  Jugadores
                </p>
                {playerResults.slice(0, 5).map((p) => (
                  <button key={`player-${p.id}`} onClick={() => selectPlayer(p)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04]
                      transition-colors text-left">
                    <div className="grid place-items-center w-9 h-9 rounded-xl bg-zinc-800/80 border border-white/[0.07] shrink-0">
                      <span className="text-[11px] font-bold text-zinc-300">{p.jersey ?? p.positionAbbr}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-white truncate">{p.name}</p>
                      <p className="text-[12px] text-zinc-500 truncate">{p.position} · {p.teamName} · {p.flag} {p.league}</p>
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
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 rounded-3xl bg-zinc-900/40 animate-pulse" />
          ))}
        </div>
      )}

      {/* Player card */}
      {selectedPlayer && !loadingTeam && (
        <PlayerCard player={selectedPlayer} />
      )}

      {/* Stats + AI */}
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
      {showEmpty && (
        <Card variant="flat" className="px-6 py-12 sm:py-16">
          <EmptyState
            icon="search"
            title="Busca un equipo o jugador"
            hint="Más de 300 equipos en 19 ligas. Resultados al instante, datos en directo de ESPN."
            action={
              <div className="flex flex-wrap justify-center gap-2 max-w-md mx-auto">
                {QUICK.map((t) => (
                  <button key={t.id} onClick={() => loadTeam(t)}
                    className="inline-flex items-center gap-2 text-[12px] font-medium px-3.5 py-2
                      bg-zinc-900/70 border border-white/[0.07] hover:border-white/[0.14] hover:bg-zinc-900
                      text-zinc-300 hover:text-white rounded-xl transition-all tap">
                    <span>{t.flag}</span>{t.name}
                  </button>
                ))}
              </div>
            }
          />
        </Card>
      )}

      <upgrade.Modal />
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   Player card
   ════════════════════════════════════════════════════════════════════════════ */

function PlayerCard({ player }: { player: PlayerResult }) {
  return (
    <Card variant="default" className="p-6 sm:p-7 animate-fade-in">
      <div className="flex items-start gap-5">
        <div className="grid place-items-center w-16 h-16 rounded-2xl bg-zinc-800/80 border border-white/[0.07] shrink-0">
          <span className="text-[18px] font-bold text-zinc-200">
            {player.jersey ? `#${player.jersey}` : player.positionAbbr}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-[22px] font-bold text-white tracking-tight leading-tight">{player.name}</h2>
          <p className="text-[13px] text-zinc-500 mt-1">{player.position}</p>
          <div className="flex flex-wrap gap-2 mt-4">
            <Badge tone="zinc">{player.flag} {player.teamName}</Badge>
            <Badge tone="zinc">{player.league}</Badge>
            {player.age && <Badge tone="zinc">{player.age} años</Badge>}
            {player.nationality && <Badge tone="zinc">{player.nationality}</Badge>}
          </div>
        </div>
      </div>
      {player.espnUrl && (
        <Button
          variant="secondary"
          size="md"
          full
          iconRight="external"
          className="mt-6"
          href={player.espnUrl}
        >
          Ver estadísticas completas en ESPN
        </Button>
      )}
      <p className="text-[11px] text-zinc-600 text-center mt-4">
        Datos biográficos verificados de ESPN
      </p>
    </Card>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   Small stat tile (used by TeamStatsView)
   ════════════════════════════════════════════════════════════════════════════ */

function MetricTile({ icon, value, label, color }: {
  icon: string; value: string; label: string
  color: "emerald" | "rose" | "amber" | "blue" | "violet" | "cyan"
}) {
  const valClass: Record<string, string> = {
    emerald: "text-emerald-400",
    rose:    "text-rose-400",
    amber:   "text-amber-400",
    blue:    "text-blue-400",
    violet:  "text-violet-400",
    cyan:    "text-cyan-400",
  }
  return (
    <div className="rounded-2xl bg-zinc-900/40 px-4 py-4 text-center">
      <p className="text-[22px] leading-none mb-2 opacity-70">{icon}</p>
      <p className={`text-[20px] font-bold leading-none tracking-tight ${valClass[color]}`}>{value}</p>
      <p className="text-[11px] text-zinc-500 mt-2 leading-tight">{label}</p>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   Markdown-lite renderer for streaming analysis
   ════════════════════════════════════════════════════════════════════════════ */

function InlineLine({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g)
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1
          ? <strong key={i} className="text-white font-semibold">{part}</strong>
          : <span key={i}>{part}</span>
      )}
    </>
  )
}

function AnalysisText({ text }: { text: string }) {
  const lines = text.split("\n")
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        const isBold = /^\*\*/.test(line)
        return (
          <p key={i} className={isBold
            ? "text-white font-semibold mt-5 first:mt-0 text-[14px] tracking-tight"
            : "text-zinc-300 text-[13.5px] leading-relaxed"}>
            {line ? <InlineLine text={line} /> : <>&nbsp;</>}
          </p>
        )
      })}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   Team stats view
   ════════════════════════════════════════════════════════════════════════════ */

function TeamStatsView({
  stats, isPremium, isPro, analyzeUsed, onAnalyze,
  analysisLoading, analysis, analysisError, analysisRef,
}: {
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
    <div className="space-y-6 animate-fade-in">
      {/* ── Header card: identity + form + AI trigger ─────────────────────── */}
      <Card variant="default" className="p-6 sm:p-7">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">
          <div className="min-w-0">
            <h2 className="text-[24px] sm:text-[26px] font-bold text-white tracking-tight leading-tight">
              {stats.name}
            </h2>
            <p className="text-[13px] text-zinc-500 mt-1">{stats.league} · Temporada {stats.season}</p>
            <p className="text-[12px] text-zinc-600 mt-1">{stats.played} partidos · {points} puntos</p>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-3 shrink-0">
            {stats.form.length > 0 && (
              <div className="flex gap-1.5">
                {stats.form.map((r, i) => (
                  <span key={i}
                    className={`text-[10px] font-bold w-6 h-6 rounded-md flex items-center justify-center ${FORM_COLOR[r] ?? "bg-zinc-700"}`}>
                    {r}
                  </span>
                ))}
              </div>
            )}
            {/* AI trigger */}
            <AnalyzeButton
              isPremium={isPremium}
              isPro={isPro}
              analyzeUsed={analyzeUsed}
              loading={analysisLoading}
              onClick={onAnalyze}
            />
          </div>
        </div>

        {/* W/D/L summary */}
        <div className="grid grid-cols-3 gap-3 mt-6">
          <SummaryCell value={stats.wins} label="Victorias" tone="emerald" />
          <SummaryCell value={stats.draws} label="Empates" tone="zinc" />
          <SummaryCell value={stats.losses} label="Derrotas" tone="rose" />
        </div>
      </Card>

      {/* ── AI teaser (free users) ────────────────────────────────────────── */}
      {!isPremium && (
        <AnalysisTeaser refEl={analysisRef} />
      )}

      {analysisError && (
        <Alert tone="warning">{analysisError}</Alert>
      )}

      {(analysis || analysisLoading) && (
        <Card variant="default" className="overflow-hidden" glow>
          <div ref={analysisRef} />
          <div className="flex items-center gap-3 px-6 pt-5 pb-4 border-b border-white/[0.05]">
            <div className="grid place-items-center w-10 h-10 rounded-xl bg-emerald-500/12 border border-emerald-700/40 text-emerald-400 shrink-0">
              <Icon name="spark" className="w-4 h-4" strokeWidth={2.2} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold text-white tracking-tight">Análisis Scout IA · {stats.name}</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">Basado exclusivamente en datos reales de ESPN · {stats.season}</p>
            </div>
            {analysisLoading && <Spinner className="w-4 h-4 shrink-0" />}
          </div>
          <div className="px-6 py-5">
            {analysis
              ? <AnalysisText text={analysis} />
              : (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className={`h-3.5 bg-white/[0.04] rounded-md animate-pulse ${i === 2 ? "w-3/4" : "w-full"}`} />
                  ))}
                </div>
              )
            }
          </div>
          {!analysisLoading && analysis && (
            <div className="px-6 py-3 border-t border-white/[0.05] bg-zinc-950/40">
              <p className="text-[10px] text-zinc-600 text-center leading-relaxed">
                Generado por IA · solo estadísticas ESPN · no constituye consejo de apuesta · +18
              </p>
            </div>
          )}
        </Card>
      )}

      {/* ── Goals & offense ────────────────────────────────────────────────── */}
      <Section title="Goles y ofensiva">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricTile icon="⚽" value={String(stats.goals_for)}     label="Goles a favor"   color="emerald" />
          <MetricTile icon="🥅" value={String(stats.goals_against)} label="Goles en contra" color="rose" />
          <MetricTile icon="🎯" value={goalsPerGame}                 label="Goles / partido" color="amber" />
          <MetricTile icon="🛡️" value={goalsAgainstPerGame}          label="Encajados / PJ"  color="blue" />
        </div>
      </Section>

      {/* ── Markets ────────────────────────────────────────────────────────── */}
      <Section title="Mercados de apuesta">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: "BTTS",         pct: stats.btts_pct,   tone: "amber"   as const },
            { label: "Over 2.5",     pct: stats.over25_pct, tone: "blue"    as const },
            { label: "Portería a 0", pct: cleanSheetPct,    tone: "emerald" as const },
          ].map((c) => (
            <MarketBar key={c.label} label={c.label} pct={c.pct} tone={c.tone} />
          ))}
        </div>
      </Section>

      {/* ── Advanced ────────────────────────────────────────────────────────── */}
      {(stats.advanced_samples ?? 0) > 0 && (
        <Section
          title="Stats avanzadas"
          eyebrow={`Medias en los últimos ${stats.advanced_samples} partidos`}
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricTile icon="⛳" value={fmt(stats.avg_corners_for)}     label="Córners a favor / PJ"   color="emerald" />
            <MetricTile icon="🚩" value={fmt(stats.avg_corners_against)} label="Córners en contra / PJ" color="blue" />
            <MetricTile icon="🟨" value={fmt(stats.avg_yellows)}         label="Amarillas / PJ"          color="amber" />
            <MetricTile icon="🟥" value={fmt(stats.avg_reds, 2)}         label="Rojas / PJ"              color="rose" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
            <MetricTile icon="⚔️" value={fmt(stats.avg_fouls)}            label="Faltas / PJ"            color="rose" />
            <MetricTile icon="🎯" value={fmt(stats.avg_shots)}            label="Tiros / PJ"             color="violet" />
            <MetricTile icon="🎯" value={fmt(stats.avg_shots_on_target)}  label="A puerta / PJ"          color="violet" />
            <MetricTile icon="⚽" value={stats.avg_possession != null ? stats.avg_possession + "%" : "—"} label="Posesión media" color="cyan" />
          </div>
        </Section>
      )}

      {/* ── Home vs Away ──────────────────────────────────────────────────── */}
      <Section title="Local vs Visitante">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SplitCard label="🏟️ Como local"    data={stats.home} />
          <SplitCard label="✈️ Como visitante" data={stats.away} />
        </div>
      </Section>

      <p className="text-[11px] text-zinc-600 text-center pt-2 pb-2 leading-relaxed">
        Datos verificados de ESPN · stats avanzadas del boxscore de los últimos partidos
      </p>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
   Sub-components for TeamStatsView
   ──────────────────────────────────────────────────────────────────────────── */

function fmt(v: number | null | undefined, digits = 1): string {
  return v != null ? v.toFixed(digits) : "—"
}

function Section({ title, eyebrow, children }: { title: string; eyebrow?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-3 px-1">
        <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">{title}</p>
        {eyebrow && <p className="text-[11px] text-zinc-600 mt-0.5">{eyebrow}</p>}
      </div>
      {children}
    </div>
  )
}

function SummaryCell({ value, label, tone }: {
  value: number; label: string
  tone: "emerald" | "rose" | "zinc"
}) {
  const toneClass = {
    emerald: "bg-emerald-500/[0.07] text-emerald-400",
    rose:    "bg-rose-500/[0.07]    text-rose-400",
    zinc:    "bg-zinc-800/40        text-zinc-200",
  }[tone]
  return (
    <div className={`rounded-2xl px-4 py-3.5 text-center ${toneClass}`}>
      <p className="text-[26px] font-bold leading-none tracking-tight">{value}</p>
      <p className="text-[11px] text-zinc-500 mt-2">{label}</p>
    </div>
  )
}

function MarketBar({ label, pct, tone }: {
  label: string; pct: number
  tone: "amber" | "blue" | "emerald"
}) {
  const tones = {
    amber:   { text: "text-amber-400",   bar: "bg-amber-400/80" },
    blue:    { text: "text-blue-400",    bar: "bg-blue-500/80" },
    emerald: { text: "text-emerald-400", bar: "bg-emerald-500/80" },
  }[tone]
  return (
    <div className="rounded-2xl bg-zinc-900/40 px-4 py-4">
      <div className="flex items-baseline justify-between">
        <p className="text-[12px] font-semibold text-zinc-400">{label}</p>
        <p className={`text-[22px] font-bold leading-none tracking-tight ${tones.text}`}>{pct}%</p>
      </div>
      <div className="mt-3 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
        <div className={`h-full ${tones.bar} rounded-full transition-all`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
      </div>
    </div>
  )
}

function SplitCard({ label, data }: {
  label: string
  data: { played: number; wins: number; draws: number; losses: number; goals_for: number; goals_against: number }
}) {
  return (
    <div className="rounded-2xl bg-zinc-900/40 px-5 py-4">
      <p className="text-[12px] font-semibold text-zinc-400 mb-4">{label}</p>
      <div className="grid grid-cols-4 gap-2 text-center">
        <Cell value={data.wins} label="V" color="text-emerald-400" />
        <Cell value={data.draws} label="E" color="text-zinc-300" />
        <Cell value={data.losses} label="D" color="text-rose-400" />
        <Cell value={`${data.goals_for}-${data.goals_against}`} label="Goles" color="text-white" />
      </div>
    </div>
  )
}

function Cell({ value, label, color }: { value: number | string; label: string; color: string }) {
  return (
    <div>
      <p className={`text-[18px] font-bold leading-none tracking-tight ${color}`}>{value}</p>
      <p className="text-[10px] text-zinc-600 mt-1.5">{label}</p>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
   Analyze button (smart state)
   ──────────────────────────────────────────────────────────────────────────── */

function AnalyzeButton({ isPremium, isPro, analyzeUsed, loading, onClick }: {
  isPremium: boolean; isPro: boolean; analyzeUsed: boolean; loading: boolean; onClick: () => void
}) {
  if (loading) {
    return <Button variant="premium" size="sm" loading>Analizando</Button>
  }
  if (!isPremium) {
    return (
      <Button variant="secondary" size="sm" iconLeft="lock" onClick={onClick}>
        Análisis IA
      </Button>
    )
  }
  if (isPremium && !isPro && analyzeUsed) {
    return (
      <Button variant="secondary" size="sm" iconLeft="lock" disabled>
        Usado hoy · vuelve mañana
      </Button>
    )
  }
  return (
    <Button variant="premium" size="sm" iconLeft="spark" onClick={onClick}>
      Análisis IA{!isPro && <span className="opacity-70 ml-1">· 1/día</span>}
    </Button>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
   Premium teaser
   ──────────────────────────────────────────────────────────────────────────── */

function AnalysisTeaser({ refEl }: { refEl: React.RefObject<HTMLDivElement> }) {
  return (
    <Card variant="default" className="overflow-hidden">
      <div ref={refEl} />
      <div className="flex items-center gap-3 px-6 pt-5 pb-4 border-b border-white/[0.05]">
        <div className="grid place-items-center w-10 h-10 rounded-xl bg-emerald-500/12 border border-emerald-700/40 text-emerald-400 shrink-0">
          <Icon name="spark" className="w-4 h-4" strokeWidth={2.2} />
        </div>
        <div>
          <p className="text-[14px] font-semibold text-white tracking-tight">Análisis Scout IA</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">Disponible para usuarios Premium ⭐ y Pro 👑</p>
        </div>
      </div>
      <div className="relative">
        <div className="blur-[5px] opacity-40 pointer-events-none select-none space-y-2 px-6 py-5">
          <p className="text-[14px] text-white font-semibold">📊 Perfil general</p>
          <p className="text-[13px] text-zinc-300 leading-relaxed">Equipo con presencia ofensiva clara, marcando por encima de la media de la liga con un volumen alto de tiros generados por partido. Su solidez defensiva varía notablemente según el contexto…</p>
          <p className="text-[14px] text-white font-semibold mt-3">🏟️ Comportamiento local vs visitante</p>
          <p className="text-[13px] text-zinc-300 leading-relaxed">Como local domina con claridad. Fuera de casa el rendimiento cae con más goles encajados…</p>
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/30 via-zinc-950/70 to-zinc-950/95 flex items-end justify-center pb-6">
          <Button variant="premium" size="md" iconLeft="crown" href="/pricing">
            Desbloquear con Premium
          </Button>
        </div>
      </div>
    </Card>
  )
}
