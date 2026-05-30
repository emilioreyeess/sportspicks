"use client"

import { useEffect, useState, useCallback } from "react"
import { usePlan } from "@/lib/plan"
import { useUpgradeModal } from "@/components/premium"
import { Icon } from "@/components/ui/icons"
import { DisclaimerBanner } from "@/components/legal/DisclaimerBanner"
import type { WCFixture, WCTeam, MatchCenter, WCGroup } from "@/lib/world-cup/types"
import type { MatchOdds } from "@/lib/world-cup/odds-service"
import Link from "next/link"

const WC_KICKOFF_ISO = "2026-06-11T20:00:00-04:00"
const WC_GROUP_ORDER: WCGroup[] = ["A","B","C","D","E","F","G","H","I","J","K","L"]

// ─── Main page ────────────────────────────────────────────────────────────────

type PageTab = "grupos" | "partidos"

export default function WorldCupPage() {
  const { isPremium } = usePlan()
  const upgrade = useUpgradeModal()
  const [fixtures, setFixtures] = useState<WCFixture[]>([])
  const [teams, setTeams] = useState<Map<string, WCTeam>>(new Map())
  const [byGroup, setByGroup] = useState<Partial<Record<WCGroup, WCTeam[]>>>({})
  const [loading, setLoading] = useState(true)
  const [analysisId, setAnalysisId] = useState<string | null>(null)
  const [tab, setTab] = useState<PageTab>("grupos")
  const [selectedGroup, setSelectedGroup] = useState<WCGroup | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [bracketRes, teamsRes] = await Promise.all([
        fetch("/api/world-cup/bracket").then((r) => r.json()),
        fetch("/api/world-cup/teams").then((r) => r.json()),
      ])
      const teamMap = new Map<string, WCTeam>()
      for (const t of teamsRes.teams ?? []) teamMap.set(t.code, t)
      setTeams(teamMap)
      setByGroup(teamsRes.byGroup ?? {})

      const fixList: WCFixture[] = bracketRes.knockoutFixtures ?? []
      setFixtures(fixList.slice(0, 20))
    } catch {
      // non-critical
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function handleAnalyze(matchId: string) {
    if (!isPremium) { upgrade.show("wc_match_analysis"); return }
    setAnalysisId(matchId === analysisId ? null : matchId)
  }

  return (
    <div className="px-4 py-6 max-w-3xl mx-auto safe-x space-y-6">
      {/* Hero */}
      <HeroSection />

      <DisclaimerBanner variant="retos" />

      {/* Tab picker */}
      <div className="flex gap-1 p-1 rounded-xl bg-zinc-900/80 border border-white/[0.07]">
        {([
          ["grupos",   "trophy",  "Grupos"],
          ["partidos", "value",   "Partidos"],
        ] as const).map(([id, icon, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold tap transition-all ${
              tab === id ? "bg-white/[0.09] text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
            }`}>
            <Icon name={icon} className="w-3.5 h-3.5" strokeWidth={tab === id ? 2.2 : 1.8} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Grupos tab ─────────────────────────────────────────── */}
      {tab === "grupos" && (
        <section>
          <div className="mb-4">
            <span className="section-label">Fase de grupos</span>
            <h2 className="text-lg font-bold text-white mt-0.5">12 Grupos · 48 Equipos</h2>
          </div>
          {loading ? (
            <div className="space-y-2.5">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-36 rounded-2xl bg-zinc-900/60 animate-pulse" />
              ))}
            </div>
          ) : (
            <GroupsGrid
              byGroup={byGroup}
              teams={teams}
              onGroupClick={(g) => { setSelectedGroup(g); setTab("partidos") }}
            />
          )}
        </section>
      )}

      {/* ── Partidos tab ───────────────────────────────────────── */}
      {tab === "partidos" && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="section-label">Próximos partidos</span>
              <h2 className="text-lg font-bold text-white mt-0.5">
                Calendario Mundial 2026
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {selectedGroup && (
                <button
                  onClick={() => setSelectedGroup(null)}
                  className="flex items-center gap-1 text-[10px] font-bold bg-amber-500/15 border border-amber-700/40 text-amber-400 px-2.5 py-1 rounded-full tap hover:bg-amber-500/25 transition-colors"
                >
                  Grupo {selectedGroup} ×
                </button>
              )}
              {isPremium && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-amber-400 border border-amber-700/50 bg-amber-500/10 rounded-full px-2.5 py-1">
                  <Icon name="spark" className="w-3 h-3" strokeWidth={2.5} />
                  Análisis disponible
                </span>
              )}
            </div>
          </div>

          {loading ? (
            <div className="space-y-2.5">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-24 rounded-2xl bg-zinc-900/60 animate-pulse" />
              ))}
            </div>
          ) : fixtures.length === 0 ? (
            <PreTournamentFixtures
              teams={teams}
              onAnalyze={handleAnalyze}
              analysisId={analysisId}
              isPremium={isPremium}
              filterGroup={selectedGroup ?? undefined}
            />
          ) : (
            <div className="space-y-2.5">
              {fixtures
                .filter(fix => !selectedGroup || fix.group === selectedGroup)
                .map((fix) => (
                  <FixtureCard
                    key={fix.matchId}
                    fixture={fix}
                    homeTeam={teams.get(fix.homeCode)}
                    awayTeam={teams.get(fix.awayCode)}
                    onAnalyze={handleAnalyze}
                    analysisId={analysisId}
                    isPremium={isPremium}
                  />
                ))}
            </div>
          )}

          {/* Premium CTA si no es premium */}
          {!isPremium && (
            <div className="mt-5 rounded-2xl border border-amber-700/40 bg-gradient-to-br from-amber-600/10 via-zinc-900/60 to-zinc-950 p-5 text-center">
              <span className="grid place-items-center w-12 h-12 rounded-2xl bg-amber-500/15 mx-auto mb-3">
                <Icon name="spark" className="w-6 h-6 text-amber-400" strokeWidth={2} />
              </span>
              <p className="text-sm font-bold text-white mb-1">Análisis estadístico por partido</p>
              <p className="text-xs text-zinc-400 leading-relaxed mb-4 max-w-xs mx-auto">
                Usuarios Premium pueden solicitar un análisis completo de cualquier partido: forma, xG, árbitro, contexto. Sin predicciones de resultado.
              </p>
              <Link href="/pricing"
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-zinc-950 font-bold text-sm tap">
                <Icon name="crown" className="w-4 h-4" strokeWidth={2.2} /> Ver Premium
              </Link>
            </div>
          )}
        </section>
      )}

      {/* Combinadas WC */}
      <div className="rounded-2xl border border-white/[0.07] bg-zinc-900/60 p-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-white">Combinadas del Mundial</p>
          <p className="text-xs text-zinc-500 mt-0.5">Motor Poisson · 3 perfiles de riesgo</p>
        </div>
        <Link href="/combinadas"
          className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500/15 border border-amber-700/40 text-amber-300 font-bold text-xs tap hover:bg-amber-500/25 transition-colors">
          Ir a Combinadas
          <Icon name="arrowRight" className="w-3.5 h-3.5" strokeWidth={2.2} />
        </Link>
      </div>

      <upgrade.Modal />
    </div>
  )
}

// ─── Groups grid ──────────────────────────────────────────────────────────────

function GroupsGrid({
  byGroup,
  teams,
  onGroupClick,
}: {
  byGroup: Partial<Record<WCGroup, WCTeam[]>>
  teams: Map<string, WCTeam>
  onGroupClick?: (group: WCGroup) => void
}) {
  // If byGroup is empty (API miss), build it from teams map
  const resolvedByGroup: Partial<Record<WCGroup, WCTeam[]>> = Object.keys(byGroup).length > 0
    ? byGroup
    : (() => {
        const built: Partial<Record<WCGroup, WCTeam[]>> = {}
        teams.forEach((t) => {
          if (t.group) {
            if (!built[t.group]) built[t.group] = []
            built[t.group]!.push(t)
          }
        })
        return built
      })()

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {WC_GROUP_ORDER.map((group) => {
        const groupTeams = resolvedByGroup[group] ?? []
        return (
          <button
            key={group}
            onClick={() => onGroupClick?.(group)}
            className="rounded-2xl border border-white/[0.07] bg-zinc-900/60 overflow-hidden text-left w-full tap hover:border-amber-700/40 hover:bg-zinc-900/80 transition-all"
          >
            {/* Group header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.07] bg-zinc-900/60">
              <span className="text-xs font-bold uppercase tracking-widest text-white">
                Grupo {group}
              </span>
              <span className="text-[10px] text-zinc-600 font-bold">
                {groupTeams[0]?.confederation ?? ""}
                {groupTeams.length > 1 && groupTeams[1]?.confederation !== groupTeams[0]?.confederation
                  ? ` · ${groupTeams[1]?.confederation}`
                  : ""}
              </span>
            </div>
            {/* Teams */}
            <div className="divide-y divide-white/[0.07]">
              {groupTeams.length > 0 ? groupTeams.map((team, i) => (
                <div key={team.code} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="text-[11px] text-zinc-600 w-3.5 shrink-0 font-bold">{i + 1}</span>
                  <span className="text-xl shrink-0">{team.flagEmoji}</span>
                  <span className="text-sm font-bold text-white flex-1 truncate">{team.name}</span>
                  <span className="text-[10px] text-zinc-500 shrink-0 font-mono">
                    {team.fifaRanking != null ? `#${team.fifaRanking}` : "—"}
                  </span>
                </div>
              )) : (
                <div className="px-4 py-4">
                  <p className="text-xs text-zinc-600">Sin datos</p>
                </div>
              )}
            </div>
            {/* Click hint footer */}
            {onGroupClick && (
              <div className="flex items-center justify-end gap-1 px-4 py-1.5 border-t border-white/[0.05] bg-zinc-950/30">
                <span className="text-[9px] text-zinc-700 font-bold">Ver partidos</span>
                <Icon name="arrowRight" className="w-2.5 h-2.5 text-zinc-700" strokeWidth={2.5} />
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function HeroSection() {
  const [countdown, setCountdown] = useState("")

  useEffect(() => {
    const update = () => {
      const ms = new Date(WC_KICKOFF_ISO).getTime() - Date.now()
      if (ms < 0) { setCountdown("¡En marcha!"); return }
      const days = Math.floor(ms / 86_400_000)
      const hours = Math.floor((ms / 3_600_000) % 24)
      setCountdown(days > 0 ? `${days}d ${hours}h` : `${hours}h`)
    }
    update()
    const id = setInterval(update, 60_000)
    return () => clearInterval(id)
  }, [])

  return (
    <section className="relative overflow-hidden rounded-3xl border border-amber-700/40 bg-gradient-to-br from-amber-600/10 via-zinc-900/80 to-zinc-950 px-5 py-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
        <div className="absolute -top-10 -right-8 w-40 h-40 bg-amber-500/20 rounded-full blur-[50px]" />
        <div className="absolute -bottom-12 -left-8 w-48 h-48 bg-yellow-500/10 rounded-full blur-[70px]" />
      </div>
      <div className="relative">
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Mundial <span className="bg-gradient-to-r from-amber-300 to-yellow-400 bg-clip-text text-transparent">2026</span>
        </h1>
        <p className="mt-1.5 text-sm text-zinc-400">48 equipos · 🇺🇸🇲🇽🇨🇦 · 11 jun – 19 jul</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-2 rounded-xl border border-amber-700/40 bg-zinc-950/60 px-3 py-1.5">
            <Icon name="bell" className="w-3.5 h-3.5 text-amber-400" strokeWidth={2.2} />
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Arranque en</span>
            <span className="text-sm font-bold text-amber-300">{countdown}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.07] bg-zinc-950/60 px-3 py-1.5 text-[11px] text-zinc-400 font-bold">
            12 grupos · 104 partidos
          </span>
        </div>
      </div>
    </section>
  )
}

// ─── Fixture card ─────────────────────────────────────────────────────────────

function FixtureCard({
  fixture, homeTeam, awayTeam, onAnalyze, analysisId, isPremium,
}: {
  fixture: WCFixture
  homeTeam?: WCTeam
  awayTeam?: WCTeam
  onAnalyze: (id: string) => void
  analysisId: string | null
  isPremium: boolean
}) {
  const isOpen = analysisId === fixture.matchId
  const kickoff = new Date(fixture.kickoffISO)
  const dateStr = kickoff.toLocaleDateString("es-ES", { weekday: "short", day: "2-digit", month: "short" })
  const timeStr = kickoff.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
  const isLive = fixture.status === "live"
  const isFinal = fixture.status === "final"

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-zinc-900/60 overflow-hidden">
      <div className="px-4 py-3.5">
        {/* Date + stage */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
            {fixture.stage === "group" ? `Grupo ${fixture.group ?? ""}` : fixture.stage} · {fixture.venue.city}
          </span>
          <span className={`text-[10px] font-bold ${isLive ? "text-emerald-400" : isFinal ? "text-zinc-500" : "text-zinc-500"}`}>
            {isLive ? "🔴 EN VIVO" : isFinal ? "Final" : `${dateStr} ${timeStr}`}
          </span>
        </div>

        {/* Teams */}
        <div className="flex items-center justify-between gap-2">
          {/* Home */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-2xl shrink-0">{homeTeam?.flagEmoji ?? "🏳️"}</span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate">{homeTeam?.name ?? fixture.homeCode}</p>
              <p className="text-[10px] text-zinc-600">#{homeTeam?.fifaRanking ?? "?"} FIFA</p>
            </div>
          </div>

          {/* Score / VS */}
          <div className="shrink-0 text-center px-2">
            {fixture.result ? (
              <p className="text-xl font-bold text-white">
                {fixture.result.homeScore} – {fixture.result.awayScore}
              </p>
            ) : (
              <p className="text-sm font-bold text-zinc-600">vs</p>
            )}
          </div>

          {/* Away */}
          <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
            <div className="min-w-0 text-right">
              <p className="text-sm font-bold text-white truncate">{awayTeam?.name ?? fixture.awayCode}</p>
              <p className="text-[10px] text-zinc-600">#{awayTeam?.fifaRanking ?? "?"} FIFA</p>
            </div>
            <span className="text-2xl shrink-0">{awayTeam?.flagEmoji ?? "🏳️"}</span>
          </div>
        </div>

        {/* Analyze button */}
        {fixture.status === "scheduled" && (
          <button
            onClick={() => onAnalyze(fixture.matchId)}
            className={`mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-bold transition-all tap ${
              isOpen
                ? "border-amber-600/60 bg-amber-500/15 text-amber-300"
                : isPremium
                  ? "border-white/[0.07] bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 hover:border-white/[0.12]"
                  : "border-white/[0.05] bg-zinc-900/50 text-zinc-600"
            }`}
          >
            {isPremium ? (
              <>
                <Icon name="stats" className="w-3.5 h-3.5" strokeWidth={2} />
                {isOpen ? "Ocultar análisis" : "Análisis estadístico"}
              </>
            ) : (
              <>
                <Icon name="lock" className="w-3.5 h-3.5" strokeWidth={2} />
                Análisis Premium
              </>
            )}
          </button>
        )}
      </div>

      {/* Analysis panel */}
      {isOpen && <MatchAnalysisPanel matchId={fixture.matchId} />}
    </div>
  )
}

// ─── Pre-tournament fixtures (static group matches) ───────────────────────────

function PreTournamentFixtures({
  teams, onAnalyze, analysisId, isPremium, filterGroup,
}: {
  teams: Map<string, WCTeam>
  onAnalyze: (id: string) => void
  analysisId: string | null
  isPremium: boolean
  filterGroup?: WCGroup
}) {
  // Show group openers as example until ESPN exposes fixtures
  const PREVIEW_FIXTURES: Array<{
    matchId: string; group: string; homeCode: string; awayCode: string
    kickoffISO: string; venue: string; city: string
  }> = [
    { matchId: "wc26-A-1", group: "A", homeCode: "MEX", awayCode: "KOR", kickoffISO: "2026-06-11T20:00:00-04:00", venue: "SoFi Stadium", city: "Los Ángeles" },
    { matchId: "wc26-A-2", group: "A", homeCode: "RSA", awayCode: "CZE", kickoffISO: "2026-06-12T14:00:00-04:00", venue: "AT&T Stadium", city: "Dallas" },
    { matchId: "wc26-B-1", group: "B", homeCode: "CAN", awayCode: "SUI", kickoffISO: "2026-06-12T17:00:00-04:00", venue: "BMO Field", city: "Toronto" },
    { matchId: "wc26-C-1", group: "C", homeCode: "BRA", awayCode: "MAR", kickoffISO: "2026-06-13T20:00:00-04:00", venue: "MetLife Stadium", city: "Nueva York" },
    { matchId: "wc26-D-1", group: "D", homeCode: "USA", awayCode: "PAR", kickoffISO: "2026-06-14T20:00:00-04:00", venue: "Rose Bowl", city: "Los Ángeles" },
    { matchId: "wc26-H-1", group: "H", homeCode: "ESP", awayCode: "URU", kickoffISO: "2026-06-15T20:00:00-04:00", venue: "Estadio Azteca", city: "Ciudad de México" },
    { matchId: "wc26-I-1", group: "I", homeCode: "FRA", awayCode: "SEN", kickoffISO: "2026-06-16T20:00:00-04:00", venue: "SoFi Stadium", city: "Los Ángeles" },
    { matchId: "wc26-J-1", group: "J", homeCode: "ARG", awayCode: "AUT", kickoffISO: "2026-06-17T20:00:00-04:00", venue: "MetLife Stadium", city: "Nueva York" },
  ]

  const displayed = filterGroup
    ? PREVIEW_FIXTURES.filter(f => f.group === filterGroup)
    : PREVIEW_FIXTURES

  return (
    <div className="space-y-2.5">
      <div className="rounded-xl border border-amber-800/30 bg-amber-500/5 px-4 py-2.5 mb-1">
        <p className="text-[11px] text-amber-400/80 font-bold">
          {filterGroup
            ? `Grupo ${filterGroup} — Fixtures orientativos (se confirman el 11 jun 2026)`
            : "Fixtures orientativos — se confirman al inicio del torneo (11 jun 2026)"}
        </p>
      </div>
      {displayed.length === 0 && (
        <div className="py-10 text-center">
          <p className="text-sm text-zinc-600 font-bold">Sin partidos prevista para el Grupo {filterGroup}</p>
          <p className="text-xs text-zinc-700 mt-1">Los fixtures del grupo se confirmarán el 11 jun 2026.</p>
        </div>
      )}
      {displayed.map((fix) => {
        const homeTeam = teams.get(fix.homeCode)
        const awayTeam = teams.get(fix.awayCode)
        const isOpen = analysisId === fix.matchId
        const kickoff = new Date(fix.kickoffISO)
        const dateStr = kickoff.toLocaleDateString("es-ES", { weekday: "short", day: "2-digit", month: "short" })
        const timeStr = kickoff.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })

        return (
          <div key={fix.matchId} className="rounded-2xl border border-white/[0.07] bg-zinc-900/60 overflow-hidden">
            <div className="px-4 py-3.5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                  Grupo {fix.group} · {fix.city}
                </span>
                <span className="text-[10px] text-zinc-500">{dateStr} {timeStr}</span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-2xl shrink-0">{homeTeam?.flagEmoji ?? "🏳️"}</span>
                  <div>
                    <p className="text-sm font-bold text-white">{homeTeam?.name ?? fix.homeCode}</p>
                    <p className="text-[10px] text-zinc-600">#{homeTeam?.fifaRanking ?? "?"} FIFA</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-zinc-600 px-2">vs</span>
                <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
                  <div className="text-right">
                    <p className="text-sm font-bold text-white">{awayTeam?.name ?? fix.awayCode}</p>
                    <p className="text-[10px] text-zinc-600">#{awayTeam?.fifaRanking ?? "?"} FIFA</p>
                  </div>
                  <span className="text-2xl shrink-0">{awayTeam?.flagEmoji ?? "🏳️"}</span>
                </div>
              </div>

              <button
                onClick={() => onAnalyze(fix.matchId)}
                className={`mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-bold transition-all tap ${
                  isOpen
                    ? "border-amber-600/60 bg-amber-500/15 text-amber-300"
                    : isPremium
                      ? "border-white/[0.10] bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 hover:border-white/[0.18]"
                      : "border-white/[0.05] bg-zinc-900/30 text-zinc-600"
                }`}
              >
                {isPremium ? (
                  <><Icon name="stats" className="w-3.5 h-3.5" strokeWidth={2} />{isOpen ? "Ocultar análisis" : "Análisis estadístico"}</>
                ) : (
                  <><Icon name="lock" className="w-3.5 h-3.5" strokeWidth={2} />Análisis Premium</>
                )}
              </button>
            </div>

            {isOpen && <MatchAnalysisPanel matchId={fix.matchId} homeCode={fix.homeCode} awayCode={fix.awayCode} />}
          </div>
        )
      })}
    </div>
  )
}

// ─── Match analysis panel (premium) ──────────────────────────────────────────

function MatchAnalysisPanel({
  matchId, homeCode, awayCode,
}: {
  matchId: string
  homeCode?: string
  awayCode?: string
}) {
  const [data, setData] = useState<MatchCenter | null>(null)
  const [odds, setOdds] = useState<MatchOdds | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(false)
    const matchPromise = fetch(`/api/world-cup/match/${encodeURIComponent(matchId)}`)
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then(setData)
      .catch(() => setError(true))

    // Load real odds in parallel
    const oddsPromise = homeCode && awayCode
      ? fetch(`/api/world-cup/odds?home=${homeCode}&away=${awayCode}`)
          .then((r) => r.ok ? r.json() : null)
          .then((d) => d && !d.error ? setOdds(d) : null)
          .catch(() => null)
      : Promise.resolve()

    Promise.all([matchPromise, oddsPromise]).finally(() => setLoading(false))
  }, [matchId, homeCode, awayCode])

  if (loading) return (
    <div className="border-t border-white/[0.07] px-4 py-4">
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <span className="w-3.5 h-3.5 rounded-full border-2 border-white/[0.08] border-t-amber-400 animate-spin block shrink-0" />
        Cargando análisis…
      </div>
    </div>
  )

  // If ESPN doesn't have match data yet, show form-based analysis using homeCode/awayCode
  if (error || !data) {
    return <FormBasedAnalysis homeCode={homeCode} awayCode={awayCode} />
  }

  const { home, away, referee, context } = data

  return (
    <div className="border-t border-white/[0.07] bg-zinc-950/40 px-4 py-4 space-y-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
        Análisis estadístico · Solo datos, sin predicción de resultado
      </p>

      {/* Cuotas reales */}
      {odds && (
        <div className="rounded-xl border border-white/[0.07] bg-zinc-900/60 p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Cuotas reales</p>
            <span className="text-[9px] text-zinc-600">{odds.bookmaker}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: `1 ${home.team.flagEmoji}`, value: odds.home,  color: "text-emerald-400" },
              { label: "X Empate",                  value: odds.draw,  color: "text-amber-400"   },
              { label: `2 ${away.team.flagEmoji}`,  value: odds.away,  color: "text-blue-400"    },
            ].map((c) => (
              <div key={c.label} className="text-center rounded-lg border border-white/[0.07] bg-zinc-950/60 py-2">
                <p className={`text-lg font-bold ${c.color}`}>{c.value?.toFixed(2) ?? "—"}</p>
                <p className="text-[9px] text-zinc-600">{c.label}</p>
              </div>
            ))}
          </div>
          {odds.over25 && (
            <div className="mt-2 flex items-center justify-center gap-4 border-t border-white/[0.07] pt-2">
              <span className="text-[10px] text-zinc-500">+2.5 <span className="font-bold text-white">{odds.over25.toFixed(2)}</span></span>
              <span className="text-[10px] text-zinc-500">-2.5 <span className="font-bold text-white">{odds.under25?.toFixed(2) ?? "—"}</span></span>
            </div>
          )}
        </div>
      )}

      {/* Form comparison */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: home.team.shortName, form: home.form, flag: home.team.flagEmoji },
          { label: away.team.shortName, form: away.form, flag: away.team.flagEmoji },
        ].map((side) => (
          <div key={side.label} className="rounded-xl border border-white/[0.07] bg-zinc-900/60 p-3">
            <p className="text-[10px] font-bold text-zinc-500 mb-2">{side.flag} {side.label}</p>
            {side.form ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1">
                  {side.form.formString.split("").map((c, i) => (
                    <span key={i} className={`w-5 h-5 grid place-items-center rounded text-[9px] font-bold ${
                      c === "W" ? "bg-emerald-500/20 text-emerald-400" :
                      c === "D" ? "bg-amber-500/20 text-amber-400" :
                      "bg-rose-500/20 text-rose-400"
                    }`}>{c}</span>
                  ))}
                </div>
                <p className="text-[10px] text-zinc-500">
                  {side.form.goalsForAvg.toFixed(2)} GF · {side.form.goalsAgainstAvg.toFixed(2)} GA · {side.form.cleanSheets} porterías
                </p>
                {side.form.over25Pct > 0 && (
                  <p className="text-[10px] text-zinc-500">
                    +2.5 en {Math.round(side.form.over25Pct * 100)}% · BTTS {Math.round(side.form.bttsPct * 100)}%
                  </p>
                )}
              </div>
            ) : (
              <p className="text-[10px] text-zinc-600">Sin datos de forma aún</p>
            )}
          </div>
        ))}
      </div>

      {/* xG */}
      {(home.xg || away.xg) && (
        <div className="rounded-xl border border-white/[0.07] bg-zinc-900/60 p-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-2">xG estimado (últimos 5)</p>
          <div className="flex items-center justify-around">
            {home.xg && (
              <div className="text-center">
                <p className="text-lg font-bold text-white">{home.xg.xgFor5.toFixed(2)}</p>
                <p className="text-[9px] text-zinc-600">{home.team.shortName} xG</p>
              </div>
            )}
            <span className="text-zinc-700 font-bold">–</span>
            {away.xg && (
              <div className="text-center">
                <p className="text-lg font-bold text-white">{away.xg.xgFor5.toFixed(2)}</p>
                <p className="text-[9px] text-zinc-600">{away.team.shortName} xG</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Referee */}
      {referee && (
        <div className="rounded-xl border border-white/[0.07] bg-zinc-900/60 p-3 flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-0.5">Árbitro</p>
            <p className="text-sm font-bold text-white">{referee.name}</p>
            <p className="text-[10px] text-zinc-500">{referee.nationality} · {referee.cards.yellowPerMatch.toFixed(2)} 🟨/partido</p>
          </div>
          <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-lg ${
            referee.severity === "very-strict" ? "bg-rose-500/15 text-rose-400" :
            referee.severity === "strict"      ? "bg-orange-500/15 text-orange-400" :
            referee.severity === "lenient"     ? "bg-emerald-500/15 text-emerald-400" :
            "bg-zinc-800/60 text-zinc-400 border border-white/[0.07]"
          }`}>
            {referee.severity}
          </span>
        </div>
      )}

      {/* Context flags */}
      <div className="flex flex-wrap gap-1.5">
        {context.isKnockout && <ContextPill text="Eliminatoria" color="amber" />}
        {context.isClassic  && <ContextPill text="Clásico histórico" color="violet" />}
        {context.highStakes && <ContextPill text="Alta tensión" color="rose" />}
        {context.bothNeedDraw && <ContextPill text="Empate les vale a ambos" color="blue" />}
      </div>

      <p className="text-[9px] text-zinc-700 leading-relaxed">
        Análisis estadístico basado en datos de ESPN. No constituye recomendación de apuesta. +18.
      </p>
    </div>
  )
}

// ─── Form-based analysis fallback ────────────────────────────────────────────

function FormBasedAnalysis({ homeCode, awayCode }: { homeCode?: string; awayCode?: string }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!homeCode || !awayCode) { setLoading(false); return }
    Promise.all([
      fetch(`/api/world-cup/team/${homeCode}`).then((r) => r.ok ? r.json() : null),
      fetch(`/api/world-cup/team/${awayCode}`).then((r) => r.ok ? r.json() : null),
    ]).then(([home, away]) => setData({ home, away }))
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [homeCode, awayCode])

  if (loading) return (
    <div className="border-t border-white/[0.07] px-4 py-3">
      <span className="text-[11px] text-zinc-500">Cargando datos de equipos…</span>
    </div>
  )

  if (!data) return (
    <div className="border-t border-white/[0.07] px-4 py-3">
      <p className="text-[11px] text-zinc-500">Datos disponibles al inicio del torneo (11 jun 2026).</p>
    </div>
  )

  const renderTeam = (teamData: any, code: string) => {
    const team = teamData?.team
    const form = teamData?.form
    if (!team) return null
    return (
      <div className="rounded-xl border border-white/[0.07] bg-zinc-900/60 p-3">
        <p className="text-[10px] font-bold text-zinc-500 mb-1.5">{team.flagEmoji} {team.name}</p>
        <p className="text-[10px] text-zinc-500">#{team.fifaRanking ?? "?"} FIFA · {team.confederation}</p>
        {form ? (
          <div className="mt-2 space-y-1">
            <div className="flex items-center gap-1">
              {form.formString.split("").map((c: string, i: number) => (
                <span key={i} className={`w-5 h-5 grid place-items-center rounded text-[9px] font-bold ${
                  c === "W" ? "bg-emerald-500/20 text-emerald-400" :
                  c === "D" ? "bg-amber-500/20 text-amber-400" :
                  "bg-rose-500/20 text-rose-400"
                }`}>{c}</span>
              ))}
            </div>
            <p className="text-[10px] text-zinc-500">{form.goalsForAvg.toFixed(2)} GF · {form.goalsAgainstAvg.toFixed(2)} GA</p>
          </div>
        ) : (
          <p className="text-[10px] text-zinc-600 mt-1">Forma disponible al inicio del torneo</p>
        )}
      </div>
    )
  }

  return (
    <div className="border-t border-white/[0.07] bg-zinc-950/40 px-4 py-4 space-y-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
        Análisis estadístico · Solo datos, sin predicción de resultado
      </p>
      <div className="grid grid-cols-2 gap-2">
        {renderTeam(data.home, homeCode ?? "")}
        {renderTeam(data.away, awayCode ?? "")}
      </div>
      <p className="text-[9px] text-zinc-700">Datos de ESPN. Análisis informativo. +18.</p>
    </div>
  )
}

// ─── Context pill ─────────────────────────────────────────────────────────────

function ContextPill({ text, color }: { text: string; color: string }) {
  const colors: Record<string, string> = {
    amber:  "border-amber-700/40 bg-amber-500/10 text-amber-400",
    violet: "border-violet-700/40 bg-violet-500/10 text-violet-400",
    rose:   "border-rose-700/40 bg-rose-500/10 text-rose-400",
    blue:   "border-blue-700/40 bg-blue-500/10 text-blue-400",
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg border text-[10px] font-bold ${colors[color] ?? colors.amber}`}>
      {text}
    </span>
  )
}
