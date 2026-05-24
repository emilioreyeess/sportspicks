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

  const FREE_PICKS = 3
  const visible = isPremium ? filtered : filtered.slice(0, FREE_PICKS)
  const locked  = isPremium ? [] : filtered.slice(FREE_PICKS)

  return (
    <div className="px-4 py-6 max-w-5xl mx-auto safe-x">
      <PageHeader icon="value" title="Value Picks"
        subtitle="Solo publicamos un pick cuando el modelo supera a la cuota real con respaldo de contexto." />

      {/* ¿Qué es un value pick? */}
      <div className="mb-5 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 sm:p-5 space-y-3">
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
        <div className="flex items-start gap-2 rounded-xl border border-zinc-700/60 bg-zinc-800/50 px-3.5 py-2.5">
          <Icon name="shield" className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" strokeWidth={2} />
          <p className="text-xs text-zinc-500 leading-relaxed">
            Recomendamos jugarlos de forma <span className="text-zinc-300 font-semibold">individual</span> con stake bajo.
            Meterlos en combinadas multiplica el riesgo y anula la ventaja estadística.
          </p>
        </div>
      </div>


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
