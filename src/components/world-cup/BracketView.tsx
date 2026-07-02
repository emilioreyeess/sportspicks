"use client"

import { useMemo } from "react"
import type { WCGroup, WCTeam, WCFixture, WCGroupStanding } from "@/lib/world-cup/types"
import { TeamCrest } from "./TeamCrest"
import { Icon } from "@/components/ui/icons"

interface Props {
  teams: WCTeam[]
  groups: WCGroupStanding[]
  knockoutFixtures: WCFixture[]
  drawCompleted: boolean
  onSelectMatch?: (matchId: string) => void
}

export function BracketView({ teams, groups, knockoutFixtures, onSelectMatch }: Props) {
  const teamByCode = useMemo(() => {
    const m = new Map<string, WCTeam>()
    for (const t of teams) m.set(t.code, t)
    return m
  }, [teams])

  // Agrupar equipos por grupo (A-L)
  const teamsByGroup = useMemo(() => {
    const groupMap: Partial<Record<WCGroup, WCTeam[]>> = {}
    for (const t of teams) {
      if (t.group) {
        if (!groupMap[t.group]) groupMap[t.group] = []
        groupMap[t.group]!.push(t)
      }
    }
    return groupMap
  }, [teams])

  const groupLetters: WCGroup[] = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"]

  return (
    <div className="space-y-6">
      {/* Grid de grupos */}
      <div>
        <SectionTitle icon="combinadas" title="Fase de grupos" subtitle="Top 2 + 8 mejores terceros pasan a Dieciseisavos" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-4">
          {groupLetters.map((letter) => {
            const groupTeams = teamsByGroup[letter] ?? []
            const standings = groups.find((g) => g.group === letter)
            return (
              <GroupCard
                key={letter}
                letter={letter}
                teams={groupTeams}
                standings={standings}
              />
            )
          })}
        </div>
      </div>

      {/* Eliminatorias */}
      <div>
        <SectionTitle icon="trophy" title="Eliminatorias" subtitle="32 → 16 → Cuartos → Semis → Final" />
        {knockoutFixtures.length === 0 ? (
          <KnockoutTreePlaceholder />
        ) : (
          <div className="mt-4 overflow-x-auto pb-2">
            <div className="flex gap-3 min-w-max">
              {knockoutFixtures.map((f) => {
                const homeTeam = teamByCode.get(f.homeCode) ?? null
                const awayTeam = teamByCode.get(f.awayCode) ?? null
                // INTEGRIDAD: si algún equipo es null (cruce sin resolver), la
                // tarjeta es ESTÁTICA — prohibido disparar análisis/cuotas/H2H.
                const resolvable = !!homeTeam && !!awayTeam
                const inner = (
                  <>
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-400 mb-2">
                      {f.stage.replace(/-/g, " ")}
                    </p>
                    <KOFixtureRow team={homeTeam} score={f.result?.homeScore} />
                    <KOFixtureRow team={awayTeam} score={f.result?.awayScore} />
                    <p className="text-[10px] text-zinc-600 mt-2 truncate">
                      {new Date(f.kickoffISO).toLocaleDateString("es-ES", { day: "numeric", month: "short" })} · {f.venue.city}
                    </p>
                  </>
                )
                return resolvable ? (
                  <button
                    key={f.matchId}
                    onClick={() => onSelectMatch?.(f.matchId)}
                    className="shrink-0 w-56 text-left rounded-xl border border-white/[0.07] bg-zinc-900/70 backdrop-blur-sm p-3 hover:border-amber-700/60 transition-colors tap"
                  >
                    {inner}
                  </button>
                ) : (
                  <div
                    key={f.matchId}
                    className="shrink-0 w-56 text-left rounded-xl border border-white/[0.07] bg-zinc-900/70 backdrop-blur-sm p-3 opacity-80"
                  >
                    {inner}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function GroupCard({
  letter, teams, standings,
}: {
  letter: WCGroup
  teams: WCTeam[]
  standings: WCGroupStanding | undefined
}) {
  // Si hay standings, usar el orden y los stats reales. Si no, mostrar solo los 4 equipos.
  const rows = standings?.teams ?? teams.map((t, i) => ({
    teamCode: t.code,
    played: 0, won: 0, drawn: 0, lost: 0,
    goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0,
    position: i + 1,
    qualificationStatus: "pending" as const,
  }))
  const teamByCode = new Map(teams.map((t) => [t.code, t]))

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-zinc-900/70 backdrop-blur-sm overflow-hidden shadow-xl">
      <div className="bg-gradient-to-br from-amber-600/15 via-amber-600/5 to-transparent px-4 py-2.5 border-b border-white/[0.07] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid place-items-center w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-yellow-500 text-zinc-950 font-black text-sm shadow-lg shadow-amber-900/30">
            {letter}
          </span>
          <span className="text-[11px] font-black uppercase tracking-widest text-zinc-400">Grupo</span>
        </div>
        {standings && (
          <span className="text-[10px] text-zinc-600 font-bold">J{rows[0]?.played ?? 0}</span>
        )}
      </div>

      <ul className="divide-y divide-white/[0.07]">
        {rows.slice(0, 4).map((row, idx) => {
          const team = teamByCode.get(row.teamCode)
          const isQualified = idx < 2
          return (
            <li key={row.teamCode} className="px-4 py-2.5 flex items-center gap-3">
              <span className={`shrink-0 w-5 text-center text-xs font-black ${
                isQualified ? "text-amber-400" : "text-zinc-600"
              }`}>{idx + 1}</span>
              {team ? (
                <TeamCrest team={team} size="sm" showName={true} className="flex-1 min-w-0" />
              ) : (
                <span className="flex-1 text-xs text-zinc-500 truncate">{row.teamCode}</span>
              )}
              {standings && (
                <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 shrink-0">
                  <span title="Goles a favor / en contra">{row.goalsFor}:{row.goalsAgainst}</span>
                  <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-200 font-black">{row.points}</span>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function KOFixtureRow({ team, score }: { team: WCTeam | null; score?: number }) {
  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-base leading-none">{team?.flagEmoji ?? "🏳️"}</span>
        <span className="text-sm font-bold text-white truncate">{team?.shortName ?? "TBD"}</span>
      </div>
      {score != null && <span className="text-base font-black text-amber-300 ml-2">{score}</span>}
    </div>
  )
}

function SectionTitle({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid place-items-center w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-yellow-600/10 border border-amber-700/40 text-amber-400 shadow-[0_0_14px_rgba(245,158,11,0.18)]">
        <Icon name={icon} className="w-5 h-5" strokeWidth={2} />
      </span>
      <div>
        <h2 className="text-lg font-black text-white tracking-tight">{title}</h2>
        <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>
      </div>
    </div>
  )
}

// ── Cuadro de eliminatorias PLACEHOLDER (FASE 4) ──────────────────────────────
// Renderiza el árbol con slots provisionales ("1A" vs "2B") y las fechas
// OFICIALES de cada ronda, aunque los equipos aún no estén asignados.
const WC_GROUPS = "ABCDEFGHIJKL".split("")

const KO_ROUNDS: { stage: string; dates: string; slots: [string, string][] }[] = [
  {
    stage: "Dieciseisavos", dates: "28 jun – 3 jul",
    slots: Array.from({ length: 16 }, (_, i) => [`1${WC_GROUPS[i % 12]}`, `2${WC_GROUPS[(i + 1) % 12]}`] as [string, string]),
  },
  { stage: "Octavos",     dates: "4 – 7 jul",   slots: Array.from({ length: 8 }, () => ["Ganador", "Ganador"] as [string, string]) },
  { stage: "Cuartos",     dates: "9 – 11 jul",  slots: Array.from({ length: 4 }, () => ["Ganador", "Ganador"] as [string, string]) },
  { stage: "Semifinales", dates: "14 – 15 jul", slots: Array.from({ length: 2 }, () => ["Ganador", "Ganador"] as [string, string]) },
  { stage: "Final",       dates: "19 jul",      slots: [["Ganador SF1", "Ganador SF2"]] },
]

function KnockoutTreePlaceholder() {
  return (
    <div className="mt-4">
      <p className="text-[11px] text-zinc-600 mb-3">
        Cuadro provisional — las selecciones se asignan al cerrar la fase de grupos. Fechas oficiales confirmadas.
      </p>
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-4 min-w-max">
          {KO_ROUNDS.map((round) => (
            <div key={round.stage} className="shrink-0 w-44 space-y-2">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-400">{round.stage}</p>
                <p className="text-[10px] text-zinc-600">{round.dates}</p>
              </div>
              {round.slots.map((slot, i) => (
                <div key={i} className="rounded-xl border border-white/[0.07] bg-zinc-900/70 p-2.5">
                  <PlaceholderSlot label={slot[0]} />
                  <div className="h-px bg-white/[0.06] my-1.5" />
                  <PlaceholderSlot label={slot[1]} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function PlaceholderSlot({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-base leading-none opacity-50">🏳️</span>
      <span className="text-[12px] font-bold text-zinc-400 truncate">{label}</span>
    </div>
  )
}
