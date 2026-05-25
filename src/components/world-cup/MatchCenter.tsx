"use client"

import { useEffect, useState } from "react"
import type { MatchCenter } from "@/lib/world-cup/types"
import { TeamCrest } from "./TeamCrest"
import { RefereeThermometer } from "./RefereeThermometer"
import { XgRadar } from "./XgRadar"
import { Icon } from "@/components/ui/icons"

interface Props {
  matchId: string
  onClose: () => void
}

export function MatchCenterModal({ matchId, onClose }: Props) {
  const [data, setData] = useState<MatchCenter | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/world-cup/match/${encodeURIComponent(matchId)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`Error ${r.status}`)
        return r.json() as Promise<MatchCenter>
      })
      .then((d) => { if (!cancelled) setData(d) })
      .catch((e: Error) => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [matchId])

  // Lock scroll del body cuando se abre el modal
  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-3xl max-h-[92vh] overflow-y-auto bg-zinc-950 sm:bg-zinc-950/95 backdrop-blur-xl border-t sm:border border-zinc-800/80 rounded-t-3xl sm:rounded-2xl animate-slide-up safe-bottom"
      >
        {/* Header sticky */}
        <div className="sticky top-0 z-10 bg-gradient-to-b from-zinc-950 to-zinc-950/90 backdrop-blur-md border-b border-zinc-800/60 px-4 py-3 flex items-center gap-3">
          <span className="grid place-items-center w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/20 to-yellow-600/10 border border-amber-700/40 text-amber-400">
            <Icon name="worldcup" className="w-4.5 h-4.5" strokeWidth={2} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-400">Match Center</p>
            <p className="text-xs text-zinc-400 truncate">Mundial 2026</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="grid place-items-center w-9 h-9 rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors tap"
          >
            <Icon name="close" className="w-5 h-5" strokeWidth={2.2} />
          </button>
        </div>

        <div className="px-4 sm:px-5 py-4 space-y-4">
          {loading && <MatchCenterSkeleton />}
          {error && !loading && (
            <div className="rounded-2xl border border-rose-700/50 bg-rose-500/10 px-4 py-4">
              <p className="text-sm font-black text-rose-300">No pudimos cargar el partido</p>
              <p className="text-[11px] text-zinc-500 mt-1">{error}. Inténtalo de nuevo en unos segundos.</p>
            </div>
          )}
          {data && !loading && <MatchBody data={data} />}
        </div>
      </div>
    </div>
  )
}

function MatchBody({ data }: { data: MatchCenter }) {
  const { home, away, fixture, context, referee } = data
  const kickoffLocal = new Date(fixture.kickoffISO).toLocaleString("es-ES", {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  })

  return (
    <>
      {/* Versus header */}
      <div className="rounded-2xl bg-gradient-to-br from-amber-600/15 via-zinc-900/80 to-cyan-600/12 border border-zinc-800/60 backdrop-blur-sm p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 text-center">
            <div className="text-5xl mb-1.5">{home.team.flagEmoji}</div>
            <p className="text-base font-black text-white tracking-tight">{home.team.shortName}</p>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">Local</p>
          </div>
          <div className="text-center">
            {fixture.result ? (
              <p className="text-5xl font-black tracking-tighter">
                <span className="text-amber-300">{fixture.result.homeScore}</span>
                <span className="text-zinc-700 mx-2">–</span>
                <span className="text-cyan-300">{fixture.result.awayScore}</span>
              </p>
            ) : (
              <p className="text-2xl font-black text-zinc-500 tracking-tight">VS</p>
            )}
            <p className="text-[10px] text-zinc-500 mt-1.5">{kickoffLocal}</p>
          </div>
          <div className="flex-1 text-center">
            <div className="text-5xl mb-1.5">{away.team.flagEmoji}</div>
            <p className="text-base font-black text-white tracking-tight">{away.team.shortName}</p>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">Visitante</p>
          </div>
        </div>

        {/* Venue */}
        <div className="mt-4 pt-3 border-t border-zinc-800/60 text-center">
          <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">📍 {fixture.venue.stadium}</p>
          <p className="text-[10px] text-zinc-700 mt-0.5">{fixture.venue.city}, {fixture.venue.country}</p>
        </div>
      </div>

      {/* Context flags */}
      {(context.isKnockout || context.isClassic || context.bothNeedDraw || context.highStakes) && (
        <div className="flex flex-wrap gap-2">
          {context.isKnockout && <ContextChip icon="trophy" label="Eliminatoria directa" tone="amber" />}
          {context.isClassic && <ContextChip icon="flame" label="Clásico mundial" tone="rose" />}
          {context.bothNeedDraw && <ContextChip icon="alert" label="A ambos les vale el empate" tone="cyan" />}
          {context.highStakes && <ContextChip icon="spark" label="Partido de máxima exigencia" tone="violet" />}
        </div>
      )}

      {/* Referee thermometer */}
      <RefereeThermometer referee={referee} />

      {/* xG radar */}
      <XgRadar
        home={{ name: home.team.name, code: home.team.shortName, xg: home.xg }}
        away={{ name: away.team.name, code: away.team.shortName, xg: away.xg }}
      />

      {/* Form bars */}
      <div className="grid grid-cols-2 gap-3">
        <FormCard label={home.team.shortName} form={home.form} accent="amber" />
        <FormCard label={away.team.shortName} form={away.form} accent="cyan" />
      </div>

      {/* Key absences */}
      <div className="grid grid-cols-2 gap-3">
        <AbsencesCard team={home.team.shortName} absences={home.keyAbsences} squad={home.squad} accent="amber" />
        <AbsencesCard team={away.team.shortName} absences={away.keyAbsences} squad={away.squad} accent="cyan" />
      </div>

      <p className="text-[10px] text-zinc-700 text-center leading-relaxed">
        Datos en vivo de ESPN cuando disponibles. xG es proxy computado (no StatsBomb).
        Información estadística — no es asesoramiento de apuestas. +18.
      </p>
    </>
  )
}

function ContextChip({ icon, label, tone }: { icon: string; label: string; tone: "amber" | "rose" | "cyan" | "violet" }) {
  const TONE = {
    amber:  "bg-amber-500/15 border-amber-700/60 text-amber-300",
    rose:   "bg-rose-500/15 border-rose-700/60 text-rose-300",
    cyan:   "bg-cyan-500/15 border-cyan-700/60 text-cyan-300",
    violet: "bg-violet-500/15 border-violet-700/60 text-violet-300",
  } as const
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-black uppercase tracking-wider ${TONE[tone]}`}>
      <Icon name={icon} className="w-3.5 h-3.5" strokeWidth={2.2} />
      {label}
    </span>
  )
}

function FormCard({ label, form, accent }: { label: string; form: MatchCenter["home"]["form"]; accent: "amber" | "cyan" }) {
  const ACCENT = accent === "amber" ? "text-amber-300" : "text-cyan-300"
  if (!form) {
    return (
      <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/60 p-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">{label} · Forma</p>
        <p className="text-xs text-zinc-500">Sin datos recientes</p>
      </div>
    )
  }
  return (
    <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/60 p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">{label} · Últimos 5</p>
      <div className="flex items-center gap-1.5 mb-3">
        {form.formString.split("").map((r, i) => (
          <span
            key={i}
            className={`w-7 h-7 grid place-items-center rounded-lg text-xs font-black ${
              r === "W" ? "bg-emerald-500 text-white"
              : r === "L" ? "bg-rose-500 text-white"
              : "bg-zinc-700 text-zinc-200"
            }`}
          >
            {r}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 text-[10px] text-zinc-500">
        <div><span className={`font-black ${ACCENT}`}>{form.goalsForAvg.toFixed(2)}</span> GF/p</div>
        <div><span className={`font-black ${ACCENT}`}>{form.goalsAgainstAvg.toFixed(2)}</span> GA/p</div>
        <div><span className={`font-black ${ACCENT}`}>{Math.round(form.bttsPct * 100)}%</span> BTTS</div>
        <div><span className={`font-black ${ACCENT}`}>{Math.round(form.over25Pct * 100)}%</span> Over 2.5</div>
      </div>
    </div>
  )
}

function AbsencesCard({ team, absences, squad, accent }: {
  team: string
  absences: MatchCenter["home"]["keyAbsences"]
  squad: MatchCenter["home"]["squad"]
  accent: "amber" | "cyan"
}) {
  const hasAbsences = absences.length > 0
  return (
    <div className={`rounded-2xl border ${hasAbsences ? "border-rose-700/50 bg-rose-500/5" : "border-zinc-800/60 bg-zinc-900/60"} p-4`}>
      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">{team} · Bajas</p>
      {hasAbsences ? (
        <ul className="space-y-1.5">
          {absences.slice(0, 3).map((p) => (
            <li key={p.id} className="flex items-center gap-2 text-xs">
              <span className="text-rose-400 text-base leading-none">●</span>
              <span className="font-bold text-white truncate">{p.name}</span>
              <span className="text-[10px] text-zinc-500 ml-auto shrink-0">{p.position}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-zinc-500">
          {squad ? "Sin bajas confirmadas" : "Plantilla pendiente"}
        </p>
      )}
    </div>
  )
}

function MatchCenterSkeleton() {
  return (
    <>
      <div className="h-44 rounded-2xl bg-zinc-900/60 animate-pulse" />
      <div className="h-32 rounded-2xl bg-zinc-900/60 animate-pulse" />
      <div className="h-72 rounded-2xl bg-zinc-900/60 animate-pulse" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-28 rounded-2xl bg-zinc-900/60 animate-pulse" />
        <div className="h-28 rounded-2xl bg-zinc-900/60 animate-pulse" />
      </div>
    </>
  )
}
