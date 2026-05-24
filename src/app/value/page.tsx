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
import { LockedSection, UpgradeBanner } from "@/components/premium"

const MARKETS = ["Todos", "1X2", "Over/Under 2.5"]
const TIERS = [
  { value: "",       label: "Todos",   color: "bg-emerald-500/15 text-emerald-400 border-emerald-700" },
  { value: "SAFE",   label: "Premium", color: "bg-emerald-500/15 text-emerald-400 border-emerald-700" },
  { value: "HIGH",   label: "Alto",    color: "bg-amber-500/15 text-amber-400 border-amber-700" },
  { value: "MEDIUM", label: "Valor",   color: "bg-blue-500/15 text-blue-400 border-blue-700" },
]

export default function ValuePage() {
  const { isPremium } = usePlan()
  const [picks, setPicks] = useState<Pick[]>([])
  const [filtered, setFiltered] = useState<Pick[]>([])
  const [selected, setSelected] = useState<Pick | null>(null)
  const [loading, setLoading] = useState(true)
  const [tier, setTier] = useState("")
  const [market, setMarket] = useState("Todos")
  const [sortBy, setSortBy] = useState<"quality" | "edge" | "odd">("quality")
  const [note, setNote] = useState<string | undefined>(undefined)

  useEffect(() => {
    getPicks(undefined, { confidence_min: 0, confidence_max: 100 })
      .then((r) => { setPicks(r.picks ?? []); setNote(r.note) })
      .catch(() => setNote("No se pudieron cargar los picks en este momento."))
      .finally(() => setLoading(false))
  }, [])

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

  const visible = isPremium ? filtered : filtered.slice(0, 1)
  const locked  = isPremium ? [] : filtered.slice(1)

  return (
    <div className="px-4 py-6 max-w-5xl mx-auto safe-x">
      <PageHeader icon="value" title="Value Picks"
        subtitle="Solo publicamos un pick cuando el modelo supera a la cuota real con respaldo de contexto." />

      {/* Disclaimer GRANDE — Value ≠ Safe */}
      <div className="mb-5 rounded-2xl border-2 border-amber-700/70 bg-gradient-to-br from-amber-500/15 to-amber-900/10 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid place-items-center w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-500/25 text-amber-300 shrink-0 text-xl sm:text-2xl">⚠️</span>
          <div className="min-w-0">
            <p className="text-sm sm:text-base font-black uppercase tracking-wide text-amber-300 leading-tight">
              Value Picks = oportunidades de valor, NO apuestas seguras
            </p>
            <div className="mt-2 text-xs sm:text-sm text-amber-100/95 leading-relaxed space-y-1.5">
              <p>
                Buscamos <strong>discrepancias</strong> entre la probabilidad real del modelo y la cuota implícita de la casa.
                Pueden incluir picks de mayor riesgo si existe valor estadístico.
              </p>
              <p>
                <strong>NO recomendamos meter Value Picks en combinadas</strong> — están pensados para
                oportunidades <strong>individuales</strong> con gestión adecuada del riesgo (stake bajo, bankroll controlado).
              </p>
              <p className="text-amber-300/90">
                Cada pick lleva un badge de riesgo: <span className="font-bold">🟢 Conservador · 🟡 Medio · 🔴 Alto</span>.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* How it works */}
      <Card className="p-3.5 mb-4">
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          <span className="text-zinc-300 font-semibold">Motor:</span> cuotas reales DraftKings ·
          modelo Poisson ajustado por rival · regresión a la media · motor de motivación con
          clasificación real · score de calidad. Si un día no hay valor, no inventamos picks.
        </p>
      </Card>

      <DisclaimerBanner variant="picks" />

      {note && (
        <div className="my-4 flex items-start gap-2 rounded-xl border border-amber-800/50 bg-amber-500/8 px-4 py-3">
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
                tier === t.value ? t.color : "bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-zinc-300"
              }`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <select value={market} onChange={(e) => setMarket(e.target.value)}
            className="flex-1 bg-zinc-900 border border-zinc-800 text-sm text-zinc-300 rounded-xl px-3 py-2.5 outline-none">
            {MARKETS.map((m) => <option key={m}>{m}</option>)}
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}
            className="flex-1 bg-zinc-900 border border-zinc-800 text-sm text-zinc-300 rounded-xl px-3 py-2.5 outline-none">
            <option value="quality">Calidad</option>
            <option value="edge">Edge</option>
            <option value="odd">Cuota</option>
          </select>
        </div>
      </div>

      {/* Free plan banner — solo si hay picks bloqueados */}
      {!isPremium && !loading && locked.length > 0 && (
        <div className="mb-4">
          <UpgradeBanner text={`Ves 1 de ${filtered.length} value picks. Desbloquea todos con Premium.`} />
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
          </div>
          {locked.length > 0 && (
            <LockedSection feature="value_picks_all"
              title={`+${locked.length} value pick${locked.length === 1 ? "" : "s"} Premium`}
              hint="Desbloquea todos los picks del día con edge real y análisis completo.">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {locked.slice(0, 4).map((p) => <PickCard key={p.id} pick={p} />)}
              </div>
            </LockedSection>
          )}
        </div>
      )}

      {selected && <PickDetail pick={selected} onClose={() => setSelected(null)} />}
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
