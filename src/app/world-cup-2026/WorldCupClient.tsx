"use client"

import { useEffect, useState, useCallback } from "react"
import { usePlan } from "@/lib/plan"
import { useUpgradeModal } from "@/components/premium"
import { Icon } from "@/components/ui/icons"
import { Card, Badge, Button, Spinner, EmptyState } from "@/components/ui/primitives"
import { BracketView } from "@/components/world-cup/BracketView"
import type { WCFixture, WCTeam, MatchCenter, WCGroup, WCGroupStanding, WCGroupTeamStanding } from "@/lib/world-cup/types"
import { fifaRankOf } from "@/lib/world-cup/fifa-ranking"
import type { MatchOdds } from "@/lib/world-cup/odds-service"
import Link from "next/link"

// Kickoff REAL del partido inaugural (México vs Sudáfrica) en UTC explícito (Z).
// Antes: "2026-06-11T20:00:00-04:00" = 2026-06-12T00:00Z → 5h tarde respecto al
// inaugural real (19:00Z), por lo que el contador mostraba horas en el futuro de
// un partido ya jugado. new Date(ISO).getTime() interpreta el instante absoluto
// correctamente y el navegador lo resta contra Date.now() (también UTC interno).
const WC_KICKOFF_ISO = "2026-06-11T19:00:00Z"
const WC_GROUP_ORDER: WCGroup[] = ["A","B","C","D","E","F","G","H","I","J","K","L"]

type PageTab = "grupos" | "eliminatorias" | "partidos"

/* ════════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ════════════════════════════════════════════════════════════════════════════ */

export default function WorldCupClient() {
  const { isPremium } = usePlan()
  const upgrade = useUpgradeModal()
  const [fixtures, setFixtures] = useState<WCFixture[]>([])
  const [teams, setTeams] = useState<Map<string, WCTeam>>(new Map())
  const [byGroup, setByGroup] = useState<Partial<Record<WCGroup, WCTeam[]>>>({})
  const [loading, setLoading] = useState(true)
  const [analysisId, setAnalysisId] = useState<string | null>(null)
  const [tab, setTab] = useState<PageTab>("grupos")
  const [selectedGroup, setSelectedGroup] = useState<WCGroup | null>(null)
  // FASE 4 — datos del cuadro de eliminatorias
  const [knockout, setKnockout] = useState<WCFixture[]>([])
  const [wcGroups, setWcGroups] = useState<WCGroupStanding[]>([])
  const [drawCompleted, setDrawCompleted] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [bracketRes, teamsRes, liveRes] = await Promise.all([
        fetch("/api/world-cup/bracket").then((r) => r.json()),
        fetch("/api/world-cup/teams").then((r) => r.json()),
        // Datos REALES de Supabase (calendario + clasificación calculada del cron).
        fetch("/api/world-cup/live", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
      ])
      const teamMap = new Map<string, WCTeam>()
      for (const t of teamsRes.teams ?? []) teamMap.set(t.code, t)
      setTeams(teamMap)
      setByGroup(teamsRes.byGroup ?? {})
      // Partidos: calendario REAL del Mundial desde Supabase (grupos + eliminatorias).
      const liveFixtures = (liveRes.fixtures as WCFixture[]) ?? []
      setFixtures(liveFixtures)
      // Grupos: clasificación REAL (puntos/victorias/goles) calculada de resultados.
      // Si /live no trae standings, caemos al bracket (vacío hasta que arranque).
      setWcGroups(liveRes.standings?.length ? liveRes.standings : (bracketRes.groups ?? []))
      // Eliminatorias: cruces REALES de Supabase (stage != group) con equipos,
      // banderas y marcadores reales. Solo si /live aún no tiene eliminatorias
      // caemos al bracket (cuadro provisional hasta que arranquen).
      const liveKnockout = liveFixtures.filter((f) => f.stage && f.stage !== "group")
      const knockoutList: WCFixture[] = liveKnockout.length
        ? liveKnockout
        : (bracketRes.knockoutFixtures ?? [])
      setKnockout(knockoutList)
      setDrawCompleted(!!bracketRes.drawCompleted)
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

  // Standings por código de equipo (PL/GD/PTS) — vacío hasta que arranque el torneo.
  const standingsByCode = new Map<string, WCGroupTeamStanding>()
  for (const g of wcGroups) for (const t of (g.teams ?? [])) standingsByCode.set(t.teamCode, t)

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10 safe-x">
      <div className="space-y-7">
        <HeroSection />

        {/* FASE 2: eliminado el aviso de retos comunitarios — no pertenece a la
            vista del Mundial. */}

        {/* Tab picker */}
        <div className="flex gap-1 p-1 rounded-2xl bg-zinc-900/40">
          {([
            ["grupos",        "trophy",      "Grupos"],
            ["eliminatorias", "leaderboard", "Eliminatorias"],
            ["partidos",      "value",       "Partidos"],
          ] as const).map(([id, icon, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-semibold tap transition-all ${
                tab === id
                  ? "bg-zinc-800/90 text-white shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}>
              <Icon name={icon} className="w-4 h-4" strokeWidth={tab === id ? 2.2 : 1.8} />
              {label}
            </button>
          ))}
        </div>

        {/* Grupos tab */}
        {tab === "grupos" && (
          <section>
            <SectionTitle eyebrow="Fase de grupos" title="12 grupos · 48 equipos" />
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-48 rounded-2xl bg-zinc-900/40 animate-pulse" />
                ))}
              </div>
            ) : (
              <GroupsGrid
                byGroup={byGroup}
                teams={teams}
                standings={standingsByCode}
                onGroupClick={(g) => { setSelectedGroup(g); setTab("partidos") }}
              />
            )}
          </section>
        )}

        {/* Eliminatorias tab (FASE 4) */}
        {tab === "eliminatorias" && (
          <section>
            <SectionTitle eyebrow="Fase final" title="Cuadro de eliminatorias" />
            {loading ? (
              <div className="h-72 rounded-2xl bg-zinc-900/40 animate-pulse" />
            ) : (
              <BracketView
                teams={[...teams.values()]}
                groups={wcGroups}
                knockoutFixtures={knockout}
                drawCompleted={drawCompleted}
                onSelectMatch={handleAnalyze}
              />
            )}
          </section>
        )}

        {/* Partidos tab */}
        {tab === "partidos" && (
          <section>
            <div className="flex items-end justify-between mb-5 gap-3 flex-wrap">
              <SectionTitle eyebrow="Próximos partidos" title="Calendario Mundial 2026" mb="mb-0" />
              <div className="flex items-center gap-2">
                {selectedGroup && (
                  <button
                    onClick={() => setSelectedGroup(null)}
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-amber-500/[0.10] text-amber-300 px-3 py-1.5 rounded-full tap hover:bg-amber-500/[0.18] transition-colors"
                  >
                    Grupo {selectedGroup}
                    <Icon name="close" className="w-3 h-3" strokeWidth={2.4} />
                  </button>
                )}
                {isPremium && (
                  <Badge tone="amber" dot>Análisis disponible</Badge>
                )}
              </div>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-28 rounded-2xl bg-zinc-900/40 animate-pulse" />
                ))}
              </div>
            ) : fixtures.length === 0 ? (
              // FASE 2: eliminado el mock PREVIEW_FIXTURES y el banner "Fixtures
              // orientativos". Estado vacío HONESTO (cero inventos). El calendario
              // real del Mundial (con cuotas y estados frescos del cron) vive en
              // la cartelera de /partidos.
              <Card variant="flat" className="px-6 py-12">
                <EmptyState
                  icon="trophy"
                  title="Sin partidos en el cuadro ahora mismo"
                  hint="El calendario se sincroniza automáticamente. Consulta la cartelera del día en Partidos."
                />
              </Card>
            ) : (
              <div className="space-y-3">
                {fixtures
                  .filter((fix) => !selectedGroup || fix.group === selectedGroup)
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

            {!isPremium && <PremiumCTA />}
          </section>
        )}

        {/* Combinadas WC */}
        <Card variant="default" className="p-5 sm:p-6 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-white tracking-tight">Combinadas del Mundial</p>
            <p className="text-[12px] text-zinc-500 mt-1">Motor Poisson · 3 perfiles de riesgo</p>
          </div>
          <Button variant="secondary" size="md" iconRight="arrowRight" href="/combinadas">
            Ir a Combinadas
          </Button>
        </Card>
      </div>

      <upgrade.Modal />
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
   Section title helper
   ──────────────────────────────────────────────────────────────────────────── */

function SectionTitle({ eyebrow, title, mb = "mb-5" }: { eyebrow: string; title: string; mb?: string }) {
  return (
    <div className={mb}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{eyebrow}</p>
      <h2 className="text-[18px] font-semibold text-white mt-1 tracking-tight">{title}</h2>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   Hero
   ════════════════════════════════════════════════════════════════════════════ */

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
    <section className="relative overflow-hidden rounded-3xl bg-zinc-900/40">
      {/* Atmospheric glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-16 -right-12 w-64 h-64 bg-amber-500/[0.08] rounded-full blur-[80px]" />
        <div className="absolute -bottom-20 -left-12 w-72 h-72 bg-yellow-500/[0.05] rounded-full blur-[100px]" />
      </div>

      <div className="relative px-6 sm:px-8 py-8 sm:py-10">
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-300/90">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
            FIFA World Cup
          </span>
        </div>
        <h1 className="font-bold text-white tracking-tight leading-[1.05]"
          style={{ fontSize: "clamp(2.2rem, 5vw, 3.25rem)" }}>
          Mundial <span className="text-amber-400">2026</span>
        </h1>
        <p className="mt-2 text-[14px] text-zinc-400 leading-relaxed">
          48 equipos · 🇺🇸🇲🇽🇨🇦 · 11 jun – 19 jul
        </p>
        <div className="mt-5 flex flex-wrap gap-2.5">
          <span className="inline-flex items-center gap-2 rounded-xl bg-zinc-950/60 border border-amber-700/30 px-3.5 py-2">
            <Icon name="bell" className="w-3.5 h-3.5 text-amber-400" strokeWidth={2.2} />
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Arranque en</span>
            <span className="text-[14px] font-semibold text-amber-300">{countdown}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-950/60 border border-white/[0.05] px-3.5 py-2 text-[11px] text-zinc-400 font-semibold">
            12 grupos · 104 partidos
          </span>
        </div>
      </div>
    </section>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   Groups grid
   ════════════════════════════════════════════════════════════════════════════ */

function GroupsGrid({
  byGroup, teams, standings, onGroupClick,
}: {
  byGroup: Partial<Record<WCGroup, WCTeam[]>>
  teams: Map<string, WCTeam>
  standings: Map<string, WCGroupTeamStanding>
  onGroupClick?: (group: WCGroup) => void
}) {
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
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {WC_GROUP_ORDER.map((group) => {
        const groupTeams = resolvedByGroup[group] ?? []
        const confederations = Array.from(new Set(groupTeams.map((t) => t.confederation).filter(Boolean)))
        return (
          <button
            key={group}
            onClick={() => onGroupClick?.(group)}
            className="group rounded-2xl bg-zinc-900/40 hover:bg-zinc-900/70 overflow-hidden text-left w-full tap transition-all duration-200 hover:-translate-y-[1px]"
          >
            <div className="flex items-center justify-between px-5 py-3.5">
              <span className="text-[11px] font-bold uppercase tracking-widest text-white">
                Grupo {group}
              </span>
              <span className="text-[10px] text-zinc-500 font-semibold">
                {confederations.join(" · ") || "—"}
              </span>
            </div>
            <div className="border-t border-white/[0.04]">
              {/* Cabecera de columnas: Escudo | Nombre | PL | GD | PTS */}
              <div className="flex items-center gap-3 px-5 pt-2 pb-1.5 text-[9.5px] font-bold uppercase tracking-wider text-zinc-600">
                <span className="w-5 shrink-0" aria-hidden="true" />
                <span className="flex-1">Equipo</span>
                <span className="w-7 text-center shrink-0">PL</span>
                <span className="w-9 text-center shrink-0">GD</span>
                <span className="w-7 text-center shrink-0">PTS</span>
              </div>
              {groupTeams.length > 0 ? groupTeams.map((team) => {
                const st = standings.get(team.code)
                const pl = st?.played ?? 0
                const gd = st?.goalDiff ?? 0
                const pts = st?.points ?? 0
                const rank = fifaRankOf(team.code)
                return (
                  <div key={team.code} className="flex items-center gap-3 px-5 py-2.5 border-t border-white/[0.03]">
                    <span className="text-[20px] w-5 shrink-0 text-center leading-none">{team.flagEmoji}</span>
                    <span className="text-[13px] font-semibold text-white flex-1 truncate">
                      {team.name}
                      {rank != null && <span className="ml-1.5 text-[9px] text-zinc-600 font-mono align-middle">FIFA #{rank}</span>}
                    </span>
                    <span className="w-7 text-center shrink-0 text-[12px] tabular-nums text-zinc-400">{pl}</span>
                    <span className="w-9 text-center shrink-0 text-[12px] tabular-nums text-zinc-400">{gd > 0 ? `+${gd}` : gd}</span>
                    <span className="w-7 text-center shrink-0 text-[12px] tabular-nums font-bold text-white">{pts}</span>
                  </div>
                )
              }) : (
                <div className="px-5 py-5">
                  <p className="text-[12px] text-zinc-500">Equipos por confirmar tras el sorteo.</p>
                </div>
              )}
            </div>
            {onGroupClick && (
              <div className="flex items-center justify-end gap-1.5 px-5 py-2.5 border-t border-white/[0.04] bg-zinc-950/30">
                <span className="text-[10px] text-zinc-500 font-semibold group-hover:text-zinc-300 transition-colors">Ver partidos</span>
                <Icon name="arrowRight" className="w-3 h-3 text-zinc-500 group-hover:text-zinc-300 group-hover:translate-x-0.5 transition-all" strokeWidth={2.4} />
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   Fixture card
   ════════════════════════════════════════════════════════════════════════════ */

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
    <Card variant="default" className="overflow-hidden">
      <div className="px-5 sm:px-6 py-4">
        <div className="flex items-center justify-between mb-3.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            {fixture.stage === "group" ? `Grupo ${fixture.group ?? ""}` : fixture.stage} · {fixture.venue.city}
          </span>
          {isLive ? (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              EN VIVO
            </span>
          ) : (
            <span className="text-[11px] font-medium text-zinc-500">
              {isFinal ? "Final" : `${dateStr} · ${timeStr}`}
            </span>
          )}
        </div>

        {/* Teams */}
        <div className="flex items-center justify-between gap-3">
          <TeamSide team={homeTeam} fallback={fixture.homeCode} side="home" />
          <div className="shrink-0 text-center px-2">
            {fixture.result ? (
              <p className="text-[22px] font-bold text-white tracking-tight leading-none">
                {fixture.result.homeScore} – {fixture.result.awayScore}
              </p>
            ) : (
              <p className="text-[13px] font-semibold text-zinc-600">vs</p>
            )}
          </div>
          <TeamSide team={awayTeam} fallback={fixture.awayCode} side="away" />
        </div>

        {fixture.status === "scheduled" && (
          <AnalyzeMatchButton
            isOpen={isOpen}
            isPremium={isPremium}
            onClick={() => onAnalyze(fixture.matchId)}
          />
        )}
      </div>

      {isOpen && <MatchAnalysisPanel matchId={fixture.matchId} />}
    </Card>
  )
}

function TeamSide({ team, fallback, side }: {
  team?: WCTeam; fallback: string; side: "home" | "away"
}) {
  const align = side === "home" ? "" : "flex-row-reverse text-right"
  return (
    <div className={`flex items-center gap-3 min-w-0 flex-1 ${align}`}>
      <span className="text-[26px] shrink-0 leading-none">{team?.flagEmoji ?? "🏳️"}</span>
      <div className="min-w-0">
        <p className="text-[14px] font-semibold text-white truncate tracking-tight">{team?.name ?? fallback}</p>
        <p className="text-[10px] text-zinc-500">#{team?.fifaRanking ?? "?"} FIFA</p>
      </div>
    </div>
  )
}

function AnalyzeMatchButton({ isOpen, isPremium, onClick }: {
  isOpen: boolean; isPremium: boolean; onClick: () => void
}) {
  const base = "mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[12px] font-semibold transition-all tap"
  if (isOpen) {
    return (
      <button onClick={onClick}
        className={`${base} bg-amber-500/[0.12] text-amber-300 ring-1 ring-amber-500/30`}>
        <Icon name="chevronUp" className="w-3.5 h-3.5" strokeWidth={2.2} />
        Ocultar análisis
      </button>
    )
  }
  if (isPremium) {
    return (
      <button onClick={onClick}
        className={`${base} bg-zinc-900/60 text-zinc-300 hover:text-white hover:bg-zinc-900`}>
        <Icon name="stats" className="w-3.5 h-3.5" strokeWidth={2} />
        Análisis estadístico
      </button>
    )
  }
  return (
    <button onClick={onClick}
      className={`${base} bg-zinc-900/40 text-zinc-500 hover:text-zinc-300`}>
      <Icon name="lock" className="w-3.5 h-3.5" strokeWidth={2} />
      Análisis Premium
    </button>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   Match analysis panel
   ════════════════════════════════════════════════════════════════════════════ */

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

    const oddsPromise = homeCode && awayCode
      ? fetch(`/api/world-cup/odds?home=${homeCode}&away=${awayCode}`)
          .then((r) => r.ok ? r.json() : null)
          .then((d) => d && !d.error ? setOdds(d) : null)
          .catch(() => null)
      : Promise.resolve()

    Promise.all([matchPromise, oddsPromise]).finally(() => setLoading(false))
  }, [matchId, homeCode, awayCode])

  if (loading) return (
    <div className="border-t border-white/[0.04] px-5 sm:px-6 py-5">
      <div className="flex items-center gap-2.5 text-[12px] text-zinc-500">
        <Spinner className="w-4 h-4" color="text-amber-400" />
        Cargando análisis…
      </div>
    </div>
  )

  if (error || !data) {
    return <FormBasedAnalysis homeCode={homeCode} awayCode={awayCode} />
  }

  const { home, away, referee, context } = data

  return (
    <div className="border-t border-white/[0.04] bg-zinc-950/30 px-5 sm:px-6 py-5 space-y-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
        Análisis estadístico · Solo datos, sin predicción de resultado
      </p>

      {odds && (
        <div className="rounded-2xl bg-zinc-900/60 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Cuotas reales</p>
            <span className="text-[10px] text-zinc-600">{odds.bookmaker}</span>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { label: `1 ${home.team.flagEmoji}`, value: odds.home, color: "text-emerald-400" },
              { label: "X Empate",                  value: odds.draw, color: "text-amber-400"   },
              { label: `2 ${away.team.flagEmoji}`,  value: odds.away, color: "text-blue-400"    },
            ].map((c) => (
              <div key={c.label} className="text-center rounded-xl bg-zinc-950/70 py-2.5">
                <p className={`text-[18px] font-bold leading-none tracking-tight ${c.color}`}>{c.value?.toFixed(2) ?? "—"}</p>
                <p className="text-[10px] text-zinc-500 mt-1.5">{c.label}</p>
              </div>
            ))}
          </div>
          {odds.over25 && (
            <div className="mt-3 flex items-center justify-center gap-5 border-t border-white/[0.04] pt-3">
              <span className="text-[11px] text-zinc-500">+2.5 <span className="font-semibold text-white">{odds.over25.toFixed(2)}</span></span>
              <span className="text-[11px] text-zinc-500">-2.5 <span className="font-semibold text-white">{odds.under25?.toFixed(2) ?? "—"}</span></span>
            </div>
          )}
        </div>
      )}

      {/* Form comparison */}
      <div className="grid grid-cols-2 gap-2.5">
        {[
          { label: home.team.shortName, form: home.form, flag: home.team.flagEmoji },
          { label: away.team.shortName, form: away.form, flag: away.team.flagEmoji },
        ].map((side) => (
          <div key={side.label} className="rounded-2xl bg-zinc-900/60 p-4">
            <p className="text-[11px] font-semibold text-zinc-400 mb-2.5">{side.flag} {side.label}</p>
            {side.form ? (
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  {side.form.formString.split("").map((c, i) => (
                    <span key={i} className={`w-5 h-5 grid place-items-center rounded text-[9px] font-bold ${
                      c === "W" ? "bg-emerald-500/20 text-emerald-400" :
                      c === "D" ? "bg-amber-500/20 text-amber-400" :
                      "bg-rose-500/20 text-rose-400"
                    }`}>{c}</span>
                  ))}
                </div>
                <p className="text-[10px] text-zinc-500 leading-relaxed">
                  {side.form.goalsForAvg.toFixed(2)} GF · {side.form.goalsAgainstAvg.toFixed(2)} GA · {side.form.cleanSheets} porterías
                </p>
                {side.form.over25Pct > 0 && (
                  <p className="text-[10px] text-zinc-500 leading-relaxed">
                    +2.5 en {Math.round(side.form.over25Pct * 100)}% · BTTS {Math.round(side.form.bttsPct * 100)}%
                  </p>
                )}
              </div>
            ) : (
              <p className="text-[10px] text-zinc-500">Sin datos de forma aún</p>
            )}
          </div>
        ))}
      </div>

      {(home.xg || away.xg) && (
        <div className="rounded-2xl bg-zinc-900/60 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3">xG estimado (últimos 5)</p>
          <div className="flex items-center justify-around">
            {home.xg && (
              <div className="text-center">
                <p className="text-[20px] font-bold text-white tracking-tight">{home.xg.xgFor5.toFixed(2)}</p>
                <p className="text-[10px] text-zinc-500 mt-1">{home.team.shortName} xG</p>
              </div>
            )}
            <span className="text-zinc-700 font-bold">–</span>
            {away.xg && (
              <div className="text-center">
                <p className="text-[20px] font-bold text-white tracking-tight">{away.xg.xgFor5.toFixed(2)}</p>
                <p className="text-[10px] text-zinc-500 mt-1">{away.team.shortName} xG</p>
              </div>
            )}
          </div>
        </div>
      )}

      {referee && (
        <div className="rounded-2xl bg-zinc-900/60 p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Árbitro</p>
            <p className="text-[14px] font-semibold text-white tracking-tight">{referee.name}</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">{referee.nationality} · {referee.cards.yellowPerMatch.toFixed(2)} 🟨/partido</p>
          </div>
          <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${
            referee.severity === "very-strict" ? "bg-rose-500/15 text-rose-400" :
            referee.severity === "strict"      ? "bg-orange-500/15 text-orange-400" :
            referee.severity === "lenient"     ? "bg-emerald-500/15 text-emerald-400" :
            "bg-zinc-800/60 text-zinc-400"
          }`}>
            {referee.severity}
          </span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {context.isKnockout && <ContextPill text="Eliminatoria" tone="amber" />}
        {context.isClassic  && <ContextPill text="Clásico histórico" tone="violet" />}
        {context.highStakes && <ContextPill text="Alta tensión" tone="rose" />}
        {context.bothNeedDraw && <ContextPill text="Empate les vale a ambos" tone="blue" />}
      </div>

      <p className="text-[10px] text-zinc-600 leading-relaxed">
        Análisis estadístico basado en datos de ESPN · no constituye recomendación de apuesta · +18
      </p>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
   Form-based fallback
   ──────────────────────────────────────────────────────────────────────────── */

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
    <div className="border-t border-white/[0.04] px-5 sm:px-6 py-4 flex items-center gap-2.5 text-[12px] text-zinc-500">
      <Spinner className="w-4 h-4" color="text-amber-400" />
      Cargando datos de equipos…
    </div>
  )

  if (!data) return (
    <div className="border-t border-white/[0.04] px-5 sm:px-6 py-4">
      <p className="text-[12px] text-zinc-500">Análisis estadístico en proceso.</p>
    </div>
  )

  const renderTeam = (teamData: any) => {
    const team = teamData?.team
    const form = teamData?.form
    if (!team) return null
    return (
      <div className="rounded-2xl bg-zinc-900/60 p-4">
        <p className="text-[11px] font-semibold text-zinc-400 mb-1.5">{team.flagEmoji} {team.name}</p>
        <p className="text-[10px] text-zinc-500">#{team.fifaRanking ?? "?"} FIFA · {team.confederation}</p>
        {form ? (
          <div className="mt-3 space-y-2">
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
          <p className="text-[10px] text-zinc-500 mt-2">Forma reciente no disponible todavía</p>
        )}
      </div>
    )
  }

  return (
    <div className="border-t border-white/[0.04] bg-zinc-950/30 px-5 sm:px-6 py-5 space-y-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
        Análisis estadístico · Solo datos, sin predicción de resultado
      </p>
      <div className="grid grid-cols-2 gap-2.5">
        {renderTeam(data.home)}
        {renderTeam(data.away)}
      </div>
      <p className="text-[10px] text-zinc-600">Datos de ESPN · informativo · +18</p>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
   Premium CTA + ContextPill helpers
   ──────────────────────────────────────────────────────────────────────────── */

function PremiumCTA() {
  return (
    <Card variant="default" className="mt-6 p-6 sm:p-7 text-center">
      <span className="grid place-items-center w-12 h-12 rounded-2xl bg-amber-500/12 border border-amber-700/40 text-amber-400 mx-auto mb-4">
        <Icon name="spark" className="w-5 h-5" strokeWidth={2.2} />
      </span>
      <p className="text-[15px] font-semibold text-white tracking-tight">Análisis estadístico por partido</p>
      <p className="text-[13px] text-zinc-400 leading-relaxed mt-2 max-w-sm mx-auto">
        Usuarios Premium pueden solicitar un análisis completo de cualquier partido:
        forma, xG, árbitro y contexto. Sin predicciones de resultado.
      </p>
      <div className="mt-5 flex justify-center">
        <Button variant="premium" size="md" iconLeft="crown" href="/pricing">
          Ver Premium
        </Button>
      </div>
    </Card>
  )
}

function ContextPill({ text, tone }: { text: string; tone: "amber" | "violet" | "rose" | "blue" }) {
  const toneClass = {
    amber:  "bg-amber-500/10 text-amber-400",
    violet: "bg-violet-500/10 text-violet-400",
    rose:   "bg-rose-500/10 text-rose-400",
    blue:   "bg-blue-500/10 text-blue-400",
  }[tone]
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold ${toneClass}`}>
      {text}
    </span>
  )
}
