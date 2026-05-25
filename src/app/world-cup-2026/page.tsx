"use client"

import { useEffect, useState, useCallback } from "react"
import type { TeamsResponse, BracketResponse } from "@/lib/world-cup/types"
import { BracketView } from "@/components/world-cup/BracketView"
import { MatchCenterModal } from "@/components/world-cup/MatchCenter"
import { DarkHorsesSection } from "@/components/world-cup/DarkHorsesSection"
import { Icon } from "@/components/ui/icons"
import { DisclaimerBanner } from "@/components/legal/DisclaimerBanner"

const WC_KICKOFF_ISO = "2026-06-11T20:00:00-04:00"

export default function WorldCupHubPage() {
  const [teamsData, setTeamsData] = useState<TeamsResponse | null>(null)
  const [bracketData, setBracketData] = useState<BracketResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openMatchId, setOpenMatchId] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [teamsRes, bracketRes] = await Promise.all([
        fetch("/api/world-cup/teams").then((r) => r.json() as Promise<TeamsResponse>),
        fetch("/api/world-cup/bracket").then((r) => r.json() as Promise<BracketResponse>),
      ])
      setTeamsData(teamsRes)
      setBracketData(bracketRes)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  return (
    <div className="px-4 py-6 max-w-5xl mx-auto safe-x">
      <HeroHeader kickoffISO={WC_KICKOFF_ISO} />

      <div className="mt-6">
        <DisclaimerBanner variant="retos" />
      </div>

      {loading && <HubSkeleton />}

      {error && !loading && (
        <div className="mt-6 rounded-2xl border border-rose-700/50 bg-rose-500/10 px-4 py-4">
          <p className="text-sm font-black text-rose-300">No pudimos cargar el Hub</p>
          <p className="text-[11px] text-zinc-500 mt-1">{error}. Reintenta en unos segundos.</p>
          <button
            onClick={fetchAll}
            className="mt-3 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs tap"
          >
            Reintentar
          </button>
        </div>
      )}

      {teamsData && bracketData && !loading && (
        <div className="mt-6 space-y-8">
          {/* Stats strip */}
          <StatsStrip teamsData={teamsData} bracketData={bracketData} />

          {/* Bracket */}
          <BracketView
            teams={teamsData.teams}
            groups={bracketData.groups}
            knockoutFixtures={bracketData.knockoutFixtures}
            drawCompleted={teamsData.drawCompleted}
            onSelectMatch={setOpenMatchId}
          />

          {/* Dark horses */}
          <DarkHorsesSection />

          {/* Footer note */}
          <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 px-5 py-4 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-400 mb-1">SportsPicks · Mundial 2026</p>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Hub independiente con datos reales de ESPN, plantilla curada de árbitros élite y motor de decisión
              ajustado al contexto internacional. Información estadística — no es asesoramiento de apuestas. +18.
            </p>
          </div>
        </div>
      )}

      {openMatchId && <MatchCenterModal matchId={openMatchId} onClose={() => setOpenMatchId(null)} />}
    </div>
  )
}

// ─── HERO ─────────────────────────────────────────────────────────────────────

function HeroHeader({ kickoffISO }: { kickoffISO: string }) {
  const [countdown, setCountdown] = useState<string>("")

  useEffect(() => {
    const update = () => {
      const ms = new Date(kickoffISO).getTime() - Date.now()
      if (ms < 0) { setCountdown("¡En marcha!"); return }
      const days = Math.floor(ms / 86_400_000)
      const hours = Math.floor((ms / 3_600_000) % 24)
      setCountdown(days > 0 ? `${days}d ${hours}h` : `${hours}h`)
    }
    update()
    const id = setInterval(update, 60_000)
    return () => clearInterval(id)
  }, [kickoffISO])

  return (
    <section className="relative overflow-hidden rounded-3xl border border-amber-700/40 bg-gradient-to-br from-amber-600/10 via-zinc-900/80 to-zinc-950 backdrop-blur-sm px-5 py-6 sm:px-8 sm:py-8">
      {/* Glow blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
        <div className="absolute -top-12 -right-8 w-48 h-48 bg-amber-500/20 rounded-full blur-[60px]" />
        <div className="absolute -bottom-16 -left-8 w-56 h-56 bg-yellow-500/10 rounded-full blur-[80px]" />
      </div>

      <div className="relative">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-700/50 bg-amber-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-300 mb-3">
          <Icon name="trophy" className="w-3 h-3" strokeWidth={2.4} />
          Hub independiente
        </div>
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-[1.05] text-white">
          Mundial <span className="bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-200 bg-clip-text text-transparent">2026</span>
        </h1>
        <p className="mt-2 text-sm text-zinc-400 max-w-md leading-relaxed">
          48 selecciones, 12 grupos, motor ajustado al contexto internacional. Datos reales, árbitros analizados, dark horses detectados.
        </p>

        {/* Countdown + venue strip */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-xl border border-amber-700/40 bg-zinc-950/60 px-3 py-1.5">
            <Icon name="bell" className="w-3.5 h-3.5 text-amber-400" strokeWidth={2.2} />
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Faltan</span>
            <span className="text-sm font-black text-amber-300">{countdown}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-1.5 text-[11px] text-zinc-400 font-bold">
            🇺🇸🇲🇽🇨🇦 Anfitriones
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-1.5 text-[11px] text-zinc-400 font-bold">
            11 jun – 19 jul
          </span>
        </div>
      </div>
    </section>
  )
}

// ─── Stats strip ──────────────────────────────────────────────────────────────

function StatsStrip({ teamsData, bracketData }: { teamsData: TeamsResponse; bracketData: BracketResponse }) {
  const totalTeams = teamsData.teams.length
  const confs = new Set(teamsData.teams.map((t) => t.confederation)).size
  const groups = bracketData.groups.length
  const knockoutCount = bracketData.knockoutFixtures.length

  const cells = [
    { label: "Selecciones", value: String(totalTeams),  icon: "user" },
    { label: "Grupos",      value: teamsData.drawCompleted ? String(groups || 12) : "12", icon: "combinadas" },
    { label: "Confeds.",    value: String(confs), icon: "stats" },
    { label: "KO listos",   value: String(knockoutCount), icon: "trophy" },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
      {cells.map((c) => (
        <div key={c.label} className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-sm p-3.5">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="grid place-items-center w-6 h-6 rounded-lg bg-amber-500/15 text-amber-400">
              <Icon name={c.icon} className="w-3.5 h-3.5" strokeWidth={2} />
            </span>
            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600">{c.label}</span>
          </div>
          <p className="text-2xl font-black tracking-tight text-amber-300">{c.value}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function HubSkeleton() {
  return (
    <div className="mt-6 space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-zinc-900/60 animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-48 rounded-2xl bg-zinc-900/60 animate-pulse" />
        ))}
      </div>
    </div>
  )
}
