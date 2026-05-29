"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { Icon } from "@/components/ui/icons"
import type { WCGroup } from "@/lib/world-cup/types"

// ─── Types (mirrors API route response) ──────────────────────────────────────

interface SearchResult {
  type: "team" | "player" | "referee" | "match"
  id: string
  title: string
  subtitle: string
  meta: Record<string, string | number | null>
}

interface SearchResponse {
  results: SearchResult[]
  query: string
  total: number
  generatedAt: string
}

// ─── Result type styles ───────────────────────────────────────────────────────

const TYPE_STYLE = {
  team:    { icon: "user",   color: "text-emerald-400", bg: "bg-emerald-500/12", border: "border-emerald-700/40" },
  player:  { icon: "user",   color: "text-blue-400",    bg: "bg-blue-500/12",    border: "border-blue-700/40"    },
  referee: { icon: "whistle", color: "text-amber-400",  bg: "bg-amber-500/12",   border: "border-amber-700/40"   },
  match:   { icon: "trophy", color: "text-violet-400",  bg: "bg-violet-500/12",  border: "border-violet-700/40"  },
} as const

// ─── Result card ──────────────────────────────────────────────────────────────

function ResultCard({
  result,
  onSelect,
}: {
  result: SearchResult
  onSelect: (r: SearchResult) => void
}) {
  const s = TYPE_STYLE[result.type]

  return (
    <button
      onClick={() => onSelect(result)}
      className={`w-full text-left rounded-xl border ${s.border} ${s.bg} px-4 py-3 tap hover:brightness-125 transition-all`}
    >
      <div className="flex items-start gap-3">
        <span className={`shrink-0 grid place-items-center w-7 h-7 rounded-lg bg-zinc-900/60 ${s.color}`}>
          <Icon name={s.icon} className="w-3.5 h-3.5" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-white truncate">{result.title}</p>
          <p className="text-[11px] text-zinc-500 truncate mt-0.5">{result.subtitle}</p>
          {/* Inline meta for teams */}
          {result.type === "team" && result.meta.formString && result.meta.formString !== "—" && (
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600">Forma</span>
              <span className="text-[10px] font-black text-zinc-300">{String(result.meta.formString)}</span>
              {result.meta.goalsForAvg !== null && (
                <span className="text-[9px] text-zinc-500">
                  {Number(result.meta.goalsForAvg).toFixed(2)} GF/partido
                </span>
              )}
            </div>
          )}
          {/* Inline meta for referees */}
          {result.type === "referee" && (
            <div className="mt-1.5 flex items-center gap-2">
              <span className={`inline-block text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${
                result.meta.severity === "very-strict" ? "bg-rose-500/15 text-rose-400" :
                result.meta.severity === "strict"      ? "bg-orange-500/15 text-orange-400" :
                result.meta.severity === "lenient"     ? "bg-emerald-500/15 text-emerald-400" :
                "bg-zinc-800 text-zinc-400"
              }`}>
                {String(result.meta.severity)}
              </span>
              <span className="text-[9px] text-zinc-500">
                🟨 {Number(result.meta.yellowPerMatch).toFixed(2)}/partido
              </span>
            </div>
          )}
        </div>
        <Icon name="arrowRight" className="shrink-0 w-4 h-4 text-zinc-600" strokeWidth={2} />
      </div>
    </button>
  )
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function DetailPanel({
  result,
  onClose,
}: {
  result: SearchResult
  onClose: () => void
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-zinc-900/80 backdrop-blur-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-black text-white">{result.title}</p>
        <button onClick={onClose} className="grid place-items-center w-6 h-6 rounded-lg hover:bg-zinc-800 tap">
          <Icon name="close" className="w-3.5 h-3.5 text-zinc-400" strokeWidth={2.5} />
        </button>
      </div>
      <p className="text-[11px] text-zinc-500">{result.subtitle}</p>
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(result.meta).filter(([, v]) => v !== null && v !== "—").map(([k, v]) => (
          <div key={k} className="rounded-lg border border-white/[0.07] bg-zinc-950/60 px-3 py-2">
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mb-0.5">
              {k.replace(/_/g, " ")}
            </p>
            <p className="text-xs font-bold text-zinc-300 truncate">{String(v)}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Group filter pills ───────────────────────────────────────────────────────

const GROUPS: (WCGroup | "")[] = ["", "A","B","C","D","E","F","G","H","I","J","K","L"]

function GroupPills({ selected, onChange }: { selected: WCGroup | ""; onChange: (g: WCGroup | "") => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto scrollbar-none pb-1">
      {GROUPS.map((g) => (
        <button
          key={g || "all"}
          onClick={() => onChange(g)}
          className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-black transition-all tap ${
            selected === g
              ? "bg-amber-500 text-zinc-950"
              : "border border-white/[0.07] text-zinc-500 hover:border-white/[0.14] hover:text-zinc-300"
          }`}
        >
          {g || "Todos"}
        </button>
      ))}
    </div>
  )
}

// ─── Type filter ──────────────────────────────────────────────────────────────

const TYPE_OPTIONS = [
  { value: "all",      label: "Todo" },
  { value: "team",     label: "Equipos" },
  { value: "referee",  label: "Árbitros" },
  { value: "match",    label: "Partidos" },
]

// ─── Main section ─────────────────────────────────────────────────────────────

export function WCSearchSection() {
  const [query, setQuery]           = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [groupFilter, setGroupFilter] = useState<WCGroup | "">("")
  const [results, setResults]       = useState<SearchResult[]>([])
  const [loading, setLoading]       = useState(false)
  const [searched, setSearched]     = useState(false)
  const [selected, setSelected]     = useState<SearchResult | null>(null)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doSearch = useCallback(async (q: string, type: string, group: string) => {
    if (q.length < 2 && !group) { setResults([]); setSearched(false); return }
    setLoading(true)
    try {
      const params = new URLSearchParams({ q, type, ...(group ? { group } : {}) })
      const res = await fetch(`/api/world-cup/search?${params}`)
      if (!res.ok) throw new Error()
      const data: SearchResponse = await res.json()
      setResults(data.results)
      setSearched(true)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounced search
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => doSearch(query, typeFilter, groupFilter), 400)
    return () => { if (debounce.current) clearTimeout(debounce.current) }
  }, [query, typeFilter, groupFilter, doSearch])

  // Show all teams when group filter selected with no query
  useEffect(() => {
    if (groupFilter && !query) doSearch("", typeFilter, groupFilter)
  }, [groupFilter, query, typeFilter, doSearch])

  return (
    <section className="space-y-4">
      {/* Header */}
      <div>
        <span className="section-label">Búsqueda estadística</span>
        <h2 className="text-lg font-black text-white mt-0.5">Explora equipos, árbitros y partidos</h2>
      </div>

      {/* Search input */}
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
          <Icon name="value" className="w-4 h-4 text-zinc-500" strokeWidth={1.8} />
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="España, ARG BRA, Mateu Lahoz…"
          className="input-base pl-9 w-full"
        />
        {loading && (
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2">
            <span className="w-4 h-4 rounded-full border-2 border-zinc-600 border-t-amber-400 animate-spin block" />
          </span>
        )}
      </div>

      {/* Group filter */}
      <GroupPills selected={groupFilter} onChange={setGroupFilter} />

      {/* Type filter */}
      <div className="flex gap-1.5 flex-wrap">
        {TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setTypeFilter(opt.value)}
            className={`px-3 py-1 rounded-full text-[11px] font-black transition-all tap ${
              typeFilter === opt.value
                ? "bg-amber-500/20 border border-amber-500/50 text-amber-300"
                : "border border-white/[0.07] text-zinc-500 hover:text-zinc-300 hover:border-white/[0.14]"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Selected detail panel */}
      {selected && (
        <DetailPanel result={selected} onClose={() => setSelected(null)} />
      )}

      {/* Results */}
      {searched && !loading && (
        <div className="space-y-2">
          {results.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.07] bg-zinc-900/40 p-5 text-center">
              <p className="text-sm font-black text-zinc-400">Sin resultados para "{query}"</p>
              <p className="text-[11px] text-zinc-600 mt-1">Prueba con un código de equipo (ESP, ARG) o nombre completo.</p>
            </div>
          ) : (
            results.map((r) => (
              <ResultCard key={r.id} result={r} onSelect={setSelected} />
            ))
          )}
        </div>
      )}

      {/* Initial state hint */}
      {!searched && !loading && (
        <div className="grid grid-cols-2 gap-2">
          {[
            { q: "España", hint: "Ver selección" },
            { q: "ARG BRA", hint: "H2H clásico" },
            { q: "Mateu", hint: "Árbitro" },
          ].map((s) => (
            <button
              key={s.q}
              onClick={() => setQuery(s.q)}
              className="rounded-xl border border-white/[0.07] bg-zinc-900/40 px-3 py-2.5 text-left tap hover:border-white/[0.14] transition-colors"
            >
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{s.hint}</p>
              <p className="text-xs font-bold text-zinc-300 mt-0.5">{s.q}</p>
            </button>
          ))}
          <button
            onClick={() => setGroupFilter("A")}
            className="rounded-xl border border-white/[0.07] bg-zinc-900/40 px-3 py-2.5 text-left tap hover:border-white/[0.14] transition-colors"
          >
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Grupo A</p>
            <p className="text-xs font-bold text-zinc-300 mt-0.5">MEX · KOR · RSA · CZE</p>
          </button>
        </div>
      )}
    </section>
  )
}
