"use client"

/**
 * "Partidos de Hoy" (STEP 4) — los 5 partidos más importantes del día con UI
 * premium (glassmorphism). Cada tarjeta es clicable y abre un análisis detallado
 * zero-hallucination (1X2, BTTS, goles O/U, corners, tarjetas). Los marcadores en
 * vivo se superponen en tiempo real vía Supabase Realtime (useLiveMatches).
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { Icon } from "@/components/ui/icons"
import { Modal, Spinner } from "@/components/ui/primitives"
import { useLiveMatches } from "@/hooks/useLiveMatches"
import { AdBanner } from "@/components/ads/AdBanner"
import { TeamCrest } from "@/components/teams/TeamCrest"
import { inferIsInternationalFromESPN } from "@/lib/teams/crest"

const AD_SLOT_FEED = process.env.NEXT_PUBLIC_ADSENSE_SLOT_FEED ?? ""

interface TodayMatch {
  match_id: string
  league: string
  league_name: string
  flag: string
  home_team: string
  away_team: string
  home_id: string | null
  away_id: string | null
  home_logo: string | null
  away_logo: string | null
  home_score: number
  away_score: number
  status_state: string
  status_detail: string | null
  clock: string | null
  kickoff_iso: string | null
  odds_home: number | null
  odds_draw: number | null
  odds_away: number | null
}

function kickoffLabel(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (isNaN(d.getTime())) return "—"
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  const time = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
  if (sameDay) return `Hoy ${time}`
  return d.toLocaleDateString("es-ES", { weekday: "short", hour: "2-digit", minute: "2-digit" })
}

/* ── Barra de probabilidad (muestra N/A si null) ───────────────────────────── */
function ProbBar({ label, value, tone = "emerald" }: { label: string; value: number | null; tone?: string }) {
  const toneMap: Record<string, string> = {
    emerald: "bg-emerald-400", cyan: "bg-cyan-400", violet: "bg-violet-400",
    amber: "bg-amber-400", rose: "bg-rose-400", blue: "bg-blue-400",
  }
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[12px] text-zinc-400 font-medium">{label}</span>
        <span className="text-[12px] font-bold tabular-nums text-white">
          {value == null ? <span className="text-zinc-600">N/A</span> : `${value}%`}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        {value != null && (
          <div className={`h-full rounded-full ${toneMap[tone] ?? toneMap.emerald}`} style={{ width: `${Math.min(100, value)}%` }} />
        )}
      </div>
    </div>
  )
}

function FormChips({ form }: { form: string[] }) {
  if (!form || form.length === 0) return <span className="text-[12px] text-zinc-600">N/A</span>
  const c: Record<string, string> = {
    W: "bg-emerald-400/10 text-emerald-400/90",
    D: "bg-white/[0.05] text-zinc-300",
    L: "bg-rose-400/10 text-rose-400/90",
  }
  return (
    <div className="flex gap-1.5">
      {form.map((r, i) => (
        <span key={i} className={`grid place-items-center w-5 h-5 rounded-md text-[10px] font-semibold ${c[r] ?? c.D}`}>{r}</span>
      ))}
    </div>
  )
}

/* ── Fallback UI cuando faltan datos / amistoso sin historia ──────────────── */
function NoDataFallback({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-amber-700/30 bg-amber-500/[0.06] px-5 py-6 text-center">
      <div className="grid place-items-center w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-700/40 text-amber-400 mx-auto mb-3">
        <Icon name="info" className="w-5 h-5" strokeWidth={2} />
      </div>
      <p className="text-[14px] font-semibold text-white tracking-tight">{title}</p>
      {hint && (
        <p className="text-[12px] text-zinc-400 leading-relaxed mt-2 max-w-xs mx-auto">{hint}</p>
      )}
      <p className="text-[10px] text-zinc-600 mt-3">
        SportsPicks nunca emite pronósticos sin volumen de datos verificables en ESPN.
      </p>
    </div>
  )
}

/* ── Modal de análisis ─────────────────────────────────────────────────────── */
function AnalysisModal({ match, onClose }: { match: TodayMatch; onClose: () => void }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError(null)
    const qs = new URLSearchParams({
      id: match.match_id,
      slug: match.league,
      home: match.home_id ?? "",
      away: match.away_id ?? "",
      hname: match.home_team,
      aname: match.away_team,
      kickoff: match.kickoff_iso ?? "",
    })
    fetch(`/api/matches/analysis?${qs.toString()}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => { if (!cancelled) setData(d?.analysis ?? null) })
      .catch((e) => { if (!cancelled) setError(e?.message ?? "Error") })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [match])

  const a = data
  const noIds = !match.home_id || !match.away_id
  // dataSufficient lo expone el backend cuando el motor no tiene volumen
  // para emitir un pronóstico fiable (amistosos sin historia, debutantes).
  const insufficientData = !loading && !error && !noIds && a && a.dataSufficient === false

  return (
    <Modal open onClose={onClose} title={`${match.home_team} vs ${match.away_team}`} size="lg">
      <div className="max-h-[75vh] overflow-y-auto -mx-1 px-1 space-y-5">
        <div className="flex items-center gap-2 text-[12px] text-zinc-500">
          <span>{match.flag}</span>
          <span className="font-medium text-zinc-400">{match.league_name}</span>
          <span className="text-zinc-700">·</span>
          <span>{kickoffLabel(match.kickoff_iso)}</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16"><Spinner className="w-6 h-6" /></div>
        ) : noIds ? (
          <NoDataFallback
            title="Datos no disponibles para este encuentro"
            hint="ESPN no expone identificadores de equipo para este partido (típico en amistosos preparatorios o partidos de selección sin liga asociada)."
          />
        ) : error ? (
          <NoDataFallback
            title="No se pudo cargar el análisis"
            hint="Inténtalo de nuevo en unos segundos. Si el partido es muy reciente, ESPN aún puede no haber publicado los datos."
          />
        ) : insufficientData ? (
          <NoDataFallback
            title="Sin volumen de datos suficiente"
            hint={a?.dataIssue ?? "Este encuentro tiene poco historial reciente en ESPN — habitual en amistosos internacionales o equipos recién ascendidos. El motor no emite pronóstico sobre muestras pequeñas."}
          />
        ) : a ? (
          <>
            {/* Resultado 1X2 */}
            <section>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 mb-2.5">Resultado (1X2)</p>
              <div className="space-y-2.5">
                <ProbBar label={`1 · ${match.home_team}`} value={a.prob1} tone="emerald" />
                <ProbBar label="X · Empate" value={a.probX} tone="amber" />
                <ProbBar label={`2 · ${match.away_team}`} value={a.prob2} tone="cyan" />
              </div>
            </section>

            {/* Goles */}
            <section>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 mb-2.5">
                Goles {a.goalsEstimate != null && <span className="text-zinc-600 normal-case font-medium">· est. {a.goalsEstimate}</span>}
              </p>
              <div className="grid grid-cols-2 gap-x-5 gap-y-2.5">
                <ProbBar label="Over 1.5" value={a.over15} tone="emerald" />
                <ProbBar label="Under 1.5" value={a.under15} tone="rose" />
                <ProbBar label="Over 2.5" value={a.over25} tone="emerald" />
                <ProbBar label="Under 2.5" value={a.under25} tone="rose" />
              </div>
            </section>

            {/* BTTS */}
            <section>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 mb-2.5">Ambos marcan (BTTS)</p>
              <div className="grid grid-cols-2 gap-5">
                <ProbBar label="Sí" value={a.bttsYes} tone="violet" />
                <ProbBar label="No" value={a.bttsNo} tone="zinc" />
              </div>
            </section>

            {/* Corners */}
            <section>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 mb-2.5">
                Corners {a.corners?.line != null && <span className="text-zinc-600 normal-case font-medium">· línea {a.corners.line} · est. {a.corners.estimate}</span>}
              </p>
              {a.corners ? (
                <div className="grid grid-cols-2 gap-5">
                  <ProbBar label={`Over ${a.corners.line}`} value={a.corners.over} tone="cyan" />
                  <ProbBar label={`Under ${a.corners.line}`} value={a.corners.under} tone="blue" />
                </div>
              ) : <p className="text-[12px] text-zinc-600">N/A · sin datos de boxscore suficientes</p>}
            </section>

            {/* Tarjetas */}
            <section>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 mb-2.5">
                Tarjetas {a.cards?.line != null && <span className="text-zinc-600 normal-case font-medium">· línea {a.cards.line} · est. {a.cards.estimate}</span>}
              </p>
              {a.cards ? (
                <div className="grid grid-cols-2 gap-5">
                  <ProbBar label={`Over ${a.cards.line}`} value={a.cards.over} tone="amber" />
                  <ProbBar label={`Under ${a.cards.line}`} value={a.cards.under} tone="zinc" />
                </div>
              ) : <p className="text-[12px] text-zinc-600">N/A · sin datos de boxscore suficientes</p>}
            </section>

            {/* Forma */}
            <section className="grid grid-cols-2 gap-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 mb-2">Forma {match.home_team}</p>
                <FormChips form={a.home?.form ?? []} />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 mb-2">Forma {match.away_team}</p>
                <FormChips form={a.away?.form ?? []} />
              </div>
            </section>

            <p className="text-[11px] text-zinc-600 leading-snug border-t border-white/[0.06] pt-3">
              Probabilidades calculadas con modelo Poisson sobre datos reales de ESPN y calibradas por el
              histórico del modelo. <strong className="text-zinc-500">N/A</strong> = dato no disponible (nunca inventado).
            </p>
          </>
        ) : null}
      </div>
    </Modal>
  )
}

/* ── Tarjeta de partido ────────────────────────────────────────────────────── */
function MatchCard({ match, live, onClick }: { match: TodayMatch; live?: any; onClick: () => void }) {
  const isLive = (live?.status_state ?? match.status_state) === "in"
  const isPost = (live?.status_state ?? match.status_state) === "post"
  const hs = live?.home_score ?? match.home_score
  const as = live?.away_score ?? match.away_score
  const clock = live?.clock ?? match.clock
  const detail = live?.status_detail ?? match.status_detail
  // ESPN no da escudos fiables de selección → inferimos por el nombre de
  // competición para activar el fallback bandera/siglas del TeamCrest.
  const isIntl = inferIsInternationalFromESPN(match.league_name)

  return (
    <button
      onClick={onClick}
      className="group w-full text-left rounded-2xl border border-white/[0.05] bg-zinc-900/40 p-5 transition-all duration-200 hover:border-white/[0.10] hover:bg-zinc-900/60 active:scale-[0.99] tap"
    >
      {/* top: liga + estado */}
      <div className="flex items-center justify-between mb-3.5">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-400">
          <span>{match.flag}</span>{match.league_name}
        </span>
        {isLive ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-400/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-400/90">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-pulse" />
            {clock || "EN VIVO"}
          </span>
        ) : isPost ? (
          <span className="rounded-full bg-white/[0.04] px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
            {detail || "Final"}
          </span>
        ) : (
          <span className="rounded-full bg-white/[0.04] px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
            {kickoffLabel(match.kickoff_iso)}
          </span>
        )}
      </div>

      {/* equipos */}
      <div className="space-y-2">
        {[{ name: match.home_team, logo: match.home_logo, score: hs, isHome: true },
          { name: match.away_team, logo: match.away_logo, score: as, isHome: false }].map((t, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <TeamCrest
              teamName={t.name}
              logoUrl={t.logo}
              isInternational={isIntl}
              size="sm"
            />
            <span className="flex-1 min-w-0 truncate text-[14px] font-semibold text-white">{t.name}</span>
            {(isLive || isPost) && (
              <span className="text-[15px] font-black tabular-nums text-white">{t.score}</span>
            )}
          </div>
        ))}
      </div>

      {/* footer: cuotas (si hay) + CTA */}
      <div className="flex items-center justify-between mt-4">
        {match.odds_home != null && match.odds_away != null ? (
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="rounded-md bg-white/[0.04] px-2 py-0.5 font-medium text-zinc-300 tabular-nums">{match.odds_home.toFixed(2)}</span>
            {match.odds_draw != null && <span className="rounded-md bg-white/[0.04] px-2 py-0.5 font-medium text-zinc-300 tabular-nums">{match.odds_draw.toFixed(2)}</span>}
            <span className="rounded-md bg-white/[0.04] px-2 py-0.5 font-medium text-zinc-300 tabular-nums">{match.odds_away.toFixed(2)}</span>
          </div>
        ) : <span className="text-[11px] text-zinc-600">Cuotas N/A</span>}
        <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-400/90 group-hover:gap-1.5 transition-all">
          Análisis IA <Icon name="arrowRight" className="w-3.5 h-3.5" strokeWidth={2.4} />
        </span>
      </div>
    </button>
  )
}

/* ── Sección principal ─────────────────────────────────────────────────────── */
export default function TodayMatches() {
  const [matches, setMatches] = useState<TodayMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<TodayMatch | null>(null)
  const { matches: liveMatches } = useLiveMatches()

  const liveMap = useMemo(() => {
    const m = new Map<string, any>()
    for (const lm of liveMatches) m.set(lm.match_id, lm)
    return m
  }, [liveMatches])

  const load = useCallback(() => {
    setLoading(true)
    fetch("/api/matches/today", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.matches) setMatches(d.matches) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  if (!loading && matches.length === 0) return null

  return (
    <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-12 pb-2">
      <div className="flex items-center justify-between mb-4 px-0.5">
        <p className="section-label">Partidos de Hoy</p>
        <span className="text-[11px] text-zinc-600">Top 5 · análisis con datos reales</span>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 h-[150px] animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {matches.flatMap((m, i) => {
            const card = (
              <MatchCard key={m.match_id} match={m} live={liveMap.get(m.match_id)} onClick={() => setSelected(m)} />
            )
            // Anuncio nativo cada 3 tarjetas — ocupa una celda del grid,
            // fluye con el contenido, nunca interrumpe verticalmente.
            if (AD_SLOT_FEED && i === 2) {
              return [card, <AdBanner key={`ad-feed-${i}`} slot={AD_SLOT_FEED} minHeight={170} />]
            }
            return [card]
          })}
        </div>
      )}

      {selected && <AnalysisModal match={selected} onClose={() => setSelected(null)} />}
    </section>
  )
}
