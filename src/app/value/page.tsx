"use client"

import { useEffect, useState } from "react"
import { getPicks } from "@/lib/api"
import type { Pick } from "@/types"
import { PickCard } from "@/components/picks/PickCard"
import { PickDetail } from "@/components/picks/PickDetail"
import { DisclaimerBanner } from "@/components/legal/DisclaimerBanner"
import { PageHeader, Card, Skeleton, EmptyState } from "@/components/ui/primitives"
import { Icon } from "@/components/ui/icons"
import { usePlan } from "@/lib/plan"
import { UpgradeBanner } from "@/components/premium"

const MARKETS = ["Todos", "1X2", "Over/Under 2.5"]
const TIERS = [
  { value: "",       label: "Todos",   color: "bg-emerald-500/15 text-emerald-400 border-emerald-700" },
  { value: "SAFE",   label: "Premium", color: "bg-emerald-500/15 text-emerald-400 border-emerald-700" },
  { value: "HIGH",   label: "Alto",    color: "bg-amber-500/15 text-amber-400 border-amber-700" },
  { value: "MEDIUM", label: "Valor",   color: "bg-blue-500/15 text-blue-400 border-blue-700" },
]

type ResultType = "WIN" | "LOSS" | "VOID" | "PENDING"

interface YesterdayPick extends Pick {
  result: ResultType
  home_score?: number
  away_score?: number
}

function ResultBadge({ result }: { result: ResultType }) {
  if (result === "WIN")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-700/60">
        ✓ WIN
      </span>
    )
  if (result === "LOSS")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-500/20 text-red-400 border border-red-700/60">
        ✗ LOSS
      </span>
    )
  if (result === "VOID")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-zinc-500/20 text-zinc-400 border border-white/[0.07]">
        — VOID
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-500 border border-amber-800/40">
      ⏳ Pendiente
    </span>
  )
}

/** Generates a short post-match analysis for a pick that was settled */
function generateLossAnalysis(pick: YesterdayPick): string | null {
  if (pick.result !== "LOSS" && pick.result !== "WIN") return null
  const edge = pick.value_edge ?? 0
  const quality = pick.quality_score ?? 0
  const market: string = (pick.market as string) ?? ""

  if (pick.result === "WIN") return null // Only show analysis for losses

  // High quality loss — reasoning was still sound
  if (quality >= 65 || edge >= 6) {
    return `El pick mantenía valor real (edge +${edge.toFixed(1)}%, calidad ${quality}/100). El resultado entra en la varianza normal — el razonamiento estadístico era correcto.`
  }
  // Over/Under
  if (market === "Over/Under 2.5") {
    if (pick.selection?.includes("Over")) {
      return `Los equipos no alcanzaron los 3 goles esperados por el modelo. Es un mercado sensible al ritmo del partido y puede fluctuar con un solo gol extra.`
    }
    return `Se superaron los 2.5 goles; el partido fue más abierto de lo modelado. El mercado Under tiene alta varianza en partidos competidos.`
  }
  // Handicap
  if (market === "Hándicap") {
    return `El hándicap no se cubrió. Es un mercado de alta varianza — pequeñas diferencias de gol cambian el resultado aunque el rendimiento sea el esperado.`
  }
  // 1X2
  if (edge >= 3) {
    return `El mercado tenía menos fe en esta selección que el modelo. Con edge +${edge.toFixed(1)}%, sigue siendo un pick defendible a largo plazo aunque no haya ganado hoy.`
  }
  return `El resultado no acompañó esta vez. Con un edge de +${edge.toFixed(1)}%, el mercado era ajustado — la probabilidad modelada era ligeramente superior a la implícita.`
}

function YesterdayPickCard({ pick, onClick }: { pick: YesterdayPick; onClick?: () => void }) {
  const resultBorder =
    pick.result === "WIN"  ? "border-emerald-700/40 bg-emerald-900/[0.12]" :
    pick.result === "LOSS" ? "border-rose-700/40 bg-rose-900/[0.12]" :
    pick.result === "VOID" ? "border-white/[0.07]" :
    "border-white/[0.07]"

  return (
    <div
      className={`rounded-2xl border p-4 space-y-2.5 cursor-pointer transition-all active:scale-[0.98] ${resultBorder}`}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-zinc-500 font-medium truncate">{pick.league_name}</p>
          <p className="text-sm font-bold text-white truncate mt-0.5">
            {pick.home_team} <span className="text-zinc-500 font-normal">vs</span> {pick.away_team}
          </p>
        </div>
        <ResultBadge result={pick.result} />
      </div>

      {/* Score (if available) */}
      {pick.home_score != null && pick.away_score != null && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-zinc-500">Resultado:</span>
          <span className="text-sm font-black text-white">
            {pick.home_score} – {pick.away_score}
          </span>
        </div>
      )}

      {/* Selection */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-zinc-500">{pick.market}</span>
        <span className="px-2 py-0.5 rounded-[7px] bg-zinc-800/60 border border-white/[0.07] text-xs font-semibold text-zinc-200">
          {pick.selection}
        </span>
        {pick.best_odd && (
          <span className="text-xs text-amber-400 font-bold">@ {pick.best_odd.toFixed(2)}</span>
        )}
      </div>

      {/* Edge */}
      {pick.value_edge != null && (
        <p className="text-xs text-zinc-500">
          Edge <span className="text-blue-400 font-semibold">+{pick.value_edge.toFixed(1)}%</span>
          {" · "}Score{" "}
          <span className="text-zinc-300 font-semibold">{pick.quality_score}/100</span>
        </p>
      )}

      {/* Post-match analysis for losses */}
      {pick.result === "LOSS" && (() => {
        const analysis = generateLossAnalysis(pick)
        return analysis ? (
          <div className="rounded-[10px] bg-zinc-900/80 border border-white/[0.07] px-3 py-2 mt-1">
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              <span className="text-zinc-400 font-semibold">Análisis: </span>{analysis}
            </p>
          </div>
        ) : null
      })()}
      {pick.result === "WIN" && (pick.value_edge ?? 0) >= 5 && (
        <div className="rounded-[10px] bg-emerald-900/20 border border-emerald-800/30 px-3 py-2 mt-1">
          <p className="text-[11px] text-emerald-400/80 leading-relaxed">
            ✓ Pick de alto valor confirmado — edge +{(pick.value_edge ?? 0).toFixed(1)}% materializado.
          </p>
        </div>
      )}
    </div>
  )
}

function YesterdayStats({ picks }: { picks: YesterdayPick[] }) {
  const wins    = picks.filter((p) => p.result === "WIN").length
  const losses  = picks.filter((p) => p.result === "LOSS").length
  const voids   = picks.filter((p) => p.result === "VOID").length
  const pending = picks.filter((p) => p.result === "PENDING").length
  const settled = wins + losses
  const rate    = settled > 0 ? Math.round((wins / settled) * 100) : null

  return (
    <div className="grid grid-cols-4 gap-2 mb-4">
      <Card className="p-3 text-center">
        <p className="text-xl font-black text-emerald-400">{wins}</p>
        <p className="text-[10px] text-zinc-600 mt-0.5">WIN</p>
      </Card>
      <Card className="p-3 text-center">
        <p className="text-xl font-black text-red-400">{losses}</p>
        <p className="text-[10px] text-zinc-600 mt-0.5">LOSS</p>
      </Card>
      <Card className="p-3 text-center">
        <p className="text-xl font-black text-zinc-400">{voids + pending}</p>
        <p className="text-[10px] text-zinc-600 mt-0.5">{pending > 0 ? "Pendiente" : "VOID"}</p>
      </Card>
      <Card className="p-3 text-center">
        <p className="text-xl font-black text-amber-400">{rate != null ? `${rate}%` : "—"}</p>
        <p className="text-[10px] text-zinc-600 mt-0.5">Aciertos</p>
      </Card>
    </div>
  )
}

export default function ValuePage() {
  const { isPremium } = usePlan()

  // ── Hoy ─────────────────────────────────────────────────────────────────────
  const [picks, setPicks]       = useState<Pick[]>([])
  const [filtered, setFiltered] = useState<Pick[]>([])
  const [selected, setSelected] = useState<Pick | null>(null)
  const [loading, setLoading]   = useState(true)
  const [tier, setTier]         = useState("")
  const [market, setMarket]     = useState("Todos")
  const [sortBy, setSortBy]     = useState<"quality" | "edge" | "odd">("quality")
  const [note, setNote]         = useState<string | undefined>(undefined)

  // ── Ayer ─────────────────────────────────────────────────────────────────────
  const [tab, setTab]                         = useState<"hoy" | "ayer">("hoy")
  const [yesterdayPicks, setYesterdayPicks]   = useState<YesterdayPick[]>([])
  const [yesterdayDate, setYesterdayDate]     = useState<string | null>(null)
  const [loadingYesterday, setLoadingYesterday] = useState(false)
  const [selectedYesterday, setSelectedYesterday] = useState<YesterdayPick | null>(null)

  // Guarda los picks de hoy en localStorage al cargarlos
  useEffect(() => {
    getPicks(undefined, { confidence_min: 0, confidence_max: 100 })
      .then((r) => {
        const loadedPicks = r.picks ?? []
        setPicks(loadedPicks)
        setNote(r.note)
        // Persistir en localStorage para poder mostrarlos mañana como "ayer"
        if (loadedPicks.length > 0 && r.date) {
          try {
            localStorage.setItem("sp_picks_today", JSON.stringify({ date: r.date, picks: loadedPicks }))
          } catch { /* quota exceeded — ignorar */ }
        }
      })
      .catch(() => setNote("No se pudieron cargar los picks en este momento."))
      .finally(() => setLoading(false))
  }, [])

  // Carga los picks de ayer desde el store del servidor (+ fallback localStorage + ESPN)
  useEffect(() => {
    if (tab !== "ayer" || yesterdayPicks.length > 0 || loadingYesterday) return
    setLoadingYesterday(true)

    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)

    // 1️⃣ Intentar store del servidor primero (sobrevive cold starts vía /tmp)
    fetch("/api/picks/yesterday")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.picks?.length) {
          setYesterdayPicks(d.picks.map((p: any) => ({ ...p, date: d.date ?? yesterday })))
          setYesterdayDate(d.date ?? yesterday)
          setLoadingYesterday(false)
          return
        }

        // 2️⃣ Fallback: localStorage picks enriquecidos vía ESPN
        try {
          const raw = localStorage.getItem("sp_picks_today")
          if (!raw) { setLoadingYesterday(false); return }
          const saved: { date: string; picks: any[] } = JSON.parse(raw)
          if (saved.date !== yesterday || !saved.picks?.length) { setLoadingYesterday(false); return }

          setYesterdayDate(saved.date)
          // Pedir al servidor que resuelva WIN/LOSS consultando ESPN
          fetch("/api/picks/yesterday", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ date: saved.date, picks: saved.picks }),
          })
            .then((r) => r.json())
            .then((data) => {
              setYesterdayPicks(data.picks ?? [])
              setYesterdayDate(data.date ?? saved.date)
            })
            .catch(() => {
              // Si falla el servidor, mostrar los picks sin resultado
              setYesterdayPicks(saved.picks.map((p: any) => ({ ...p, result: "PENDING" })))
            })
            .finally(() => setLoadingYesterday(false))
        } catch {
          setLoadingYesterday(false)
        }
      })
      .catch(() => {
        setLoadingYesterday(false)
      })
  }, [tab])

  useEffect(() => {
    let result = [...picks]
    if (tier) result = result.filter((p) => p.confidence_tier === tier)
    if (market !== "Todos") result = result.filter((p) => p.market === market)
    result.sort((a, b) => {
      if (sortBy === "quality") return (b.quality_score ?? 0) - (a.quality_score ?? 0)
      if (sortBy === "edge")    return (b.value_edge ?? -1) - (a.value_edge ?? -1)
      if (sortBy === "odd")     return (b.best_odd ?? 0) - (a.best_odd ?? 0)
      return 0
    })
    setFiltered(result)
  }, [picks, tier, market, sortBy])

  const total    = picks.length
  const avgOdd   = total ? (picks.reduce((s, p) => s + (p.best_odd ?? 0), 0) / total).toFixed(2) : "—"
  const bestEdge = total ? Math.max(...picks.map((p) => p.value_edge ?? 0)).toFixed(1) : "—"

  const FREE_PICKS = 3
  const visible = isPremium ? filtered : filtered.slice(0, FREE_PICKS)
  const locked  = isPremium ? [] : filtered.slice(FREE_PICKS)

  return (
    <div className="px-4 py-6 max-w-5xl mx-auto safe-x">
      <PageHeader icon="value" title="Value Picks"
        subtitle="Solo publicamos un pick cuando el modelo supera a la cuota real con respaldo de contexto." />

      {/* ¿Qué es un value pick? */}
      <div className="mb-5 rounded-2xl border border-white/[0.07] bg-zinc-900/60 p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Icon name="value" className="w-4.5 h-4.5 text-emerald-400 shrink-0" strokeWidth={2} />
          <p className="text-sm font-black text-white">¿Qué es un value pick?</p>
        </div>
        <p className="text-sm text-zinc-400 leading-relaxed">
          Un value pick no es un error de cuota ni una apuesta segura. Es una situación donde
          nuestro modelo estima que la probabilidad real de un resultado es <span className="text-white font-semibold">mayor</span> que
          la que refleja la cuota de la casa — lo que genera una ventaja estadística a largo plazo.
        </p>
        <p className="text-sm text-zinc-400 leading-relaxed">
          Pueden incluir resultados con riesgo medio o alto. Un pick puede tener valor aunque el
          favorito no gane ese día. La clave es el <span className="text-white font-semibold">edge acumulado</span>, no el resultado individual.
        </p>
        <div className="flex items-start gap-2 rounded-xl border border-white/[0.08] bg-zinc-800/50 px-3.5 py-2.5">
          <Icon name="shield" className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" strokeWidth={2} />
          <p className="text-xs text-zinc-500 leading-relaxed">
            Recomendamos jugarlos de forma <span className="text-zinc-300 font-semibold">individual</span> con stake bajo.
            Meterlos en combinadas multiplica el riesgo y anula la ventaja estadística.
          </p>
        </div>
      </div>

      {/* Tabs Hoy / Ayer */}
      <div className="flex gap-1 p-1 rounded-xl bg-zinc-900/80 border border-white/[0.07] mb-5">
        {(["hoy", "ayer"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all capitalize tap ${
              tab === t
                ? "bg-white/[0.09] text-white shadow"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t === "hoy" ? "🎯 Hoy" : "📋 Ayer"}
          </button>
        ))}
      </div>

      {/* ══════════════════════ TAB HOY ══════════════════════ */}
      {tab === "hoy" && (
        <>
          {note && (
            <div className="my-4 flex items-start gap-2 rounded-xl border border-amber-700/40 bg-amber-500/[0.08] px-4 py-3">
              <Icon name="shield" className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-200/90 leading-snug">{note}</p>
            </div>
          )}

          {/* Summary */}
          <div className="grid grid-cols-3 gap-2.5 my-4">
            <SummaryCard v={String(total)}   l="Picks hoy"   c="text-emerald-400" />
            <SummaryCard v={`+${bestEdge}%`} l="Mejor edge"  c="text-blue-400" />
            <SummaryCard v={String(avgOdd)}  l="Cuota media" c="text-amber-400" />
          </div>

          {/* Filters */}
          <div className="space-y-2.5 mb-5">
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
              {TIERS.map((t) => (
                <button key={t.value} onClick={() => setTier(t.value)}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold border tracking-wide transition-all tap ${
                    tier === t.value ? t.color : "bg-zinc-900/80 text-zinc-500 border-white/[0.07] hover:text-zinc-300"
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <select value={market} onChange={(e) => setMarket(e.target.value)}
                className="flex-1 bg-zinc-800/40 border border-white/[0.08] text-sm text-zinc-300 rounded-xl px-3 py-2.5 outline-none">
                {MARKETS.map((m) => <option key={m}>{m}</option>)}
              </select>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}
                className="flex-1 bg-zinc-800/40 border border-white/[0.08] text-sm text-zinc-300 rounded-xl px-3 py-2.5 outline-none">
                <option value="quality">Calidad</option>
                <option value="edge">Edge</option>
                <option value="odd">Cuota</option>
              </select>
            </div>
          </div>

          {/* Free plan banner */}
          {!isPremium && !loading && locked.length > 0 && (
            <div className="mb-4">
              <UpgradeBanner text={`Ves ${visible.length} de ${filtered.length} value picks. Desbloquea el análisis completo con Premium ⭐`} />
            </div>
          )}

          {/* Grid */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-44" />)}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState emoji="🎯"
              title={note ? "Sin value picks ahora mismo" : "No hay picks con estos filtros"}
              hint="Preferimos no dar ningún pick antes que dar uno mediocre. Cuando el modelo detecte valor real, aparecerá aquí." />
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 stagger">
                {visible.map((p) => <PickCard key={p.id} pick={p} onClick={setSelected} />)}
                {locked.map((p) => <PickCard key={p.id} pick={p} locked />)}
              </div>
            </div>
          )}
        </>
      )}

      {/* ══════════════════════ TAB AYER ══════════════════════ */}
      {tab === "ayer" && (
        <>
          {yesterdayDate && (
            <p className="text-xs text-zinc-500 mb-3">
              Picks del <span className="text-zinc-300 font-semibold">{yesterdayDate}</span> — resultados verificados a medianoche
            </p>
          )}

          {loadingYesterday ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-36" />)}
            </div>
          ) : yesterdayPicks.length === 0 ? (
            <EmptyState emoji="📋"
              title="Sin picks de ayer"
              hint="Los picks del día anterior con sus resultados aparecerán aquí a partir de medianoche." />
          ) : (
            <>
              <YesterdayStats picks={yesterdayPicks} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {yesterdayPicks.map((p, i) => (
                  <YesterdayPickCard
                    key={p.id ?? i}
                    pick={p}
                    onClick={() => setSelectedYesterday(p)}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {selected && <PickDetail pick={selected} onClose={() => setSelected(null)} />}
      {selectedYesterday && (
        <PickDetail pick={selectedYesterday as any} onClose={() => setSelectedYesterday(null)} />
      )}
    </div>
  )
}

function SummaryCard({ v, l, c }: { v: string; l: string; c: string }) {
  return (
    <Card className="p-3.5 text-center">
      <p className={`text-xl font-black ${c}`}>{v}</p>
      <p className="text-[10px] text-zinc-600 mt-0.5">{l}</p>
    </Card>
  )
}
