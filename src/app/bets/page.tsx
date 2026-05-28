"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"

interface BetLeg { id: string; match: string; selection: string; odds: number; status: string }
interface Bet {
  id: string; title: string; stake: number; combined_odds: number; status: string
  sport: string; notes?: string; created_at: string; settled_at?: string
  bet_legs?: BetLeg[]
}
interface Stats { total: number; settled: number; won: number; winrate: number; yield: number; profit: number }

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  won:     "bg-green-500/20  text-green-300  border-green-500/30",
  lost:    "bg-red-500/20    text-red-300    border-red-500/30",
  void:    "bg-zinc-500/20   text-zinc-300   border-zinc-500/30",
}
const STATUS_LABEL: Record<string, string> = { pending: "Pendiente", won: "Ganada", lost: "Perdida", void: "Anulada" }

const emptyForm = () => ({
  title: "", stake: "", combined_odds: "", sport: "football",
  legs: [{ match: "", selection: "", odds: "" }],
  imageUrl: "",
})

export default function BetsPage() {
  const { status } = useSession()
  const router = useRouter()
  const [bets, setBets] = useState<Bet[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [filter, setFilter] = useState<"all" | "pending" | "won" | "lost">("all")

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/bets")
      if (!res.ok) return
      const d = await res.json()
      setBets(d.bets ?? [])
      setStats(d.stats ?? null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/"); return }
    if (status === "authenticated") load()
  }, [status, load, router])

  const addLeg = () => setForm(f => ({ ...f, legs: [...f.legs, { match: "", selection: "", odds: "" }] }))
  const removeLeg = (i: number) => setForm(f => ({ ...f, legs: f.legs.filter((_, idx) => idx !== i) }))
  const updateLeg = (i: number, k: string, v: string) =>
    setForm(f => ({ ...f, legs: f.legs.map((l, idx) => idx === i ? { ...l, [k]: v } : l) }))

  const calcCombo = () => {
    const product = form.legs.reduce((p, l) => {
      const o = parseFloat(l.odds)
      return isNaN(o) ? p : p * o
    }, 1)
    return product === 1 ? "" : product.toFixed(2)
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || uploadingImage) return
    if (!file.type.startsWith("image/")) return
    if (file.size > 5 * 1024 * 1024) { alert("La imagen no puede superar 5 MB"); return }
    setUploadingImage(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/bets/upload", { method: "POST", body: fd })
      if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error ?? "Error al subir"); return }
      const { url } = await res.json()
      setForm(f => ({ ...f, imageUrl: url }))
    } catch { alert("Error de conexión al subir la imagen") }
    finally { setUploadingImage(false); e.target.value = "" }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setSaveError(null)
    const combo = parseFloat(form.combined_odds || calcCombo() || "1")
    const legs = form.legs
      .filter(l => l.match && l.selection)
      .map(l => ({ match: l.match, selection: l.selection, odds: parseFloat(l.odds) || 1 }))
    if (!legs.length) { setSaveError("Añade al menos una selección."); setSaving(false); return }
    const title = form.title || legs.map(l => l.selection).join(" + ")
    try {
      const res = await fetch("/api/bets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          stake: parseFloat(form.stake) || 0,
          combined_odds: isNaN(combo) || combo < 1 ? 1 : combo,
          sport: form.sport,
          legs,
          image_url: form.imageUrl || undefined,
        }),
      })
      if (res.ok) { setShowForm(false); setForm(emptyForm()); load() }
      else {
        const d = await res.json().catch(() => ({}))
        setSaveError(d.error ?? "Error al guardar la apuesta")
      }
    } catch (err: any) {
      setSaveError("Error de conexión: " + err.message)
    } finally {
      setSaving(false)
    }
  }

  const settle = async (id: string, status: "won" | "lost" | "void") => {
    await fetch(`/api/bets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    load()
  }

  const filtered = bets.filter(b => filter === "all" || b.status === filter)

  // Bets created yesterday or before that are still pending — prompt user to settle them
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0]
  const pendingToSettle = bets.filter(b => {
    if (b.status !== "pending") return false
    const betDate = b.created_at?.slice(0, 10)
    return betDate && betDate <= yesterday
  })

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-green-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-zinc-950/90 backdrop-blur border-b border-white/5 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">Mis Apuestas</h1>
          <p className="text-xs text-zinc-500">Historial y seguimiento</p>
        </div>
        <button
          onClick={() => setShowForm(s => !s)}
          className="bg-green-600 hover:bg-green-500 text-white text-sm font-semibold px-4 py-2 rounded-xl transition"
        >
          + Nueva
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        {/* Stats bar */}
        {stats && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Winrate", value: `${stats.winrate}%`, color: stats.winrate >= 50 ? "text-green-400" : "text-red-400" },
              { label: "Yield", value: `${stats.yield > 0 ? "+" : ""}${stats.yield}%`, color: stats.yield >= 0 ? "text-green-400" : "text-red-400" },
              { label: "Beneficio", value: `${stats.profit >= 0 ? "+" : ""}${stats.profit}€`, color: stats.profit >= 0 ? "text-green-400" : "text-red-400" },
            ].map(s => (
              <div key={s.label} className="bg-zinc-900 rounded-xl p-3 text-center border border-white/5">
                <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-zinc-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Pending bets to settle prompt */}
        {pendingToSettle.length > 0 && (
          <div className="rounded-2xl border border-amber-700/40 bg-amber-500/8 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">⏰</span>
              <div>
                <p className="text-sm font-black text-amber-300">¿Cómo fue?</p>
                <p className="text-xs text-zinc-500">{pendingToSettle.length} apuesta{pendingToSettle.length > 1 ? "s" : ""} de ayer sin resultado</p>
              </div>
            </div>
            {pendingToSettle.slice(0, 3).map(b => (
              <div key={b.id} className="bg-zinc-900/80 rounded-xl p-3 space-y-2">
                <p className="text-xs font-bold text-white truncate">{b.title}</p>
                <p className="text-[11px] text-zinc-500">
                  {b.stake}€ @ {b.combined_odds} · {new Date(b.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                </p>
                <div className="flex gap-2">
                  <button onClick={() => settle(b.id, "won")}
                    className="flex-1 py-2 rounded-xl bg-green-600/20 hover:bg-green-600/30 text-green-400 text-xs font-bold border border-green-700/40 transition-all">
                    ✓ Ganada
                  </button>
                  <button onClick={() => settle(b.id, "lost")}
                    className="flex-1 py-2 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-400 text-xs font-bold border border-red-700/40 transition-all">
                    ✗ Perdida
                  </button>
                  <button onClick={() => settle(b.id, "void")}
                    className="w-16 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-500 text-xs font-bold transition-all">
                    Anulada
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add bet form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="bg-zinc-900 rounded-2xl border border-white/10 p-4 space-y-3">
            <h2 className="font-semibold text-sm text-zinc-300">Nueva apuesta</h2>
            <input
              className="w-full bg-zinc-800 rounded-xl px-3 py-2 text-sm placeholder-zinc-500 outline-none focus:ring-1 ring-green-500"
              placeholder="Título (opcional)"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            />
            <div className="flex gap-2">
              <input
                className="flex-1 bg-zinc-800 rounded-xl px-3 py-2 text-sm placeholder-zinc-500 outline-none focus:ring-1 ring-green-500"
                placeholder="Stake (€)"
                type="number" step="0.01" min="0"
                value={form.stake}
                onChange={e => setForm(f => ({ ...f, stake: e.target.value }))}
              />
              <input
                className="flex-1 bg-zinc-800 rounded-xl px-3 py-2 text-sm placeholder-zinc-500 outline-none focus:ring-1 ring-green-500"
                placeholder={`Cuota total (${calcCombo() || "auto"})`}
                type="number" step="0.01" min="1"
                value={form.combined_odds}
                onChange={e => setForm(f => ({ ...f, combined_odds: e.target.value }))}
              />
            </div>

            {/* Legs */}
            <div className="space-y-2">
              <div className="text-xs text-zinc-500 font-medium">Selecciones</div>
              {form.legs.map((leg, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <div className="flex-1 space-y-1">
                    <input
                      className="w-full bg-zinc-800 rounded-lg px-2.5 py-1.5 text-xs placeholder-zinc-600 outline-none"
                      placeholder="Partido (ej: Real Madrid vs Barça)"
                      value={leg.match}
                      onChange={e => updateLeg(i, "match", e.target.value)}
                    />
                    <div className="flex gap-1">
                      <input
                        className="flex-1 bg-zinc-800 rounded-lg px-2.5 py-1.5 text-xs placeholder-zinc-600 outline-none"
                        placeholder="Selección"
                        value={leg.selection}
                        onChange={e => updateLeg(i, "selection", e.target.value)}
                      />
                      <input
                        className="w-16 bg-zinc-800 rounded-lg px-2 py-1.5 text-xs placeholder-zinc-600 outline-none text-center"
                        placeholder="Cuota"
                        type="number" step="0.01"
                        value={leg.odds}
                        onChange={e => updateLeg(i, "odds", e.target.value)}
                      />
                    </div>
                  </div>
                  {form.legs.length > 1 && (
                    <button type="button" onClick={() => removeLeg(i)} className="text-zinc-600 hover:text-red-400 text-lg mt-1">×</button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addLeg} className="text-xs text-green-400 hover:text-green-300">+ Añadir selección</button>
            </div>

            {/* Image upload */}
            <div className="flex items-center gap-2 pt-1">
              <label className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-700 bg-zinc-800 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 cursor-pointer transition ${uploadingImage ? "opacity-40 pointer-events-none" : ""}`}>
                <input type="file" accept="image/*" className="sr-only" onChange={handleImageUpload} disabled={uploadingImage} />
                {uploadingImage
                  ? <span className="w-3 h-3 rounded-full border-2 border-zinc-500 border-t-transparent animate-spin" />
                  : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                }
                {form.imageUrl ? "Foto adjunta ✓" : "Adjuntar foto"}
              </label>
              {form.imageUrl && (
                <button type="button" onClick={() => setForm(f => ({ ...f, imageUrl: "" }))} className="text-xs text-red-400 hover:text-red-300">✕ Quitar</button>
              )}
            </div>

            {saveError && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{saveError}</p>
            )}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => { setShowForm(false); setSaveError(null) }} className="flex-1 bg-zinc-800 hover:bg-zinc-700 rounded-xl py-2 text-sm transition">Cancelar</button>
              <button type="submit" disabled={saving} className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-xl py-2 text-sm font-semibold transition">
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </form>
        )}

        {/* Filter tabs */}
        <div className="flex gap-1 bg-zinc-900 p-1 rounded-xl border border-white/5">
          {(["all", "pending", "won", "lost"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition ${filter === f ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              {f === "all" ? "Todas" : STATUS_LABEL[f]}
            </button>
          ))}
        </div>

        {/* Bet list */}
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-zinc-600">
            <div className="text-4xl mb-3">🎯</div>
            <p className="text-sm">No hay apuestas aquí</p>
            <p className="text-xs mt-1">Pulsa "+ Nueva" para registrar una</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(bet => (
              <div key={bet.id} className="bg-zinc-900 rounded-2xl border border-white/5 overflow-hidden">
                {/* Bet header */}
                <div
                  className="p-4 cursor-pointer hover:bg-white/[0.02] transition"
                  onClick={() => setExpanded(e => e === bet.id ? null : bet.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{bet.title}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[bet.status]}`}>
                          {STATUS_LABEL[bet.status]}
                        </span>
                        <span className="text-xs text-zinc-500">{bet.stake}€ × {bet.combined_odds}</span>
                        {bet.status === "won" && (
                          <span className="text-xs text-green-400 font-semibold">
                            +{((bet.combined_odds - 1) * bet.stake).toFixed(2)}€
                          </span>
                        )}
                        {bet.status === "lost" && (
                          <span className="text-xs text-red-400 font-semibold">-{bet.stake}€</span>
                        )}
                      </div>
                    </div>
                    <div className="text-zinc-600 text-sm">{expanded === bet.id ? "▲" : "▼"}</div>
                  </div>
                </div>

                {/* Expanded details */}
                {expanded === bet.id && (
                  <div className="border-t border-white/5 px-4 pb-4 pt-3 space-y-3">
                    {bet.bet_legs?.map((leg, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <div className="flex-1">
                          <div className="text-zinc-400">{leg.match}</div>
                          <div className="font-medium">{leg.selection}</div>
                        </div>
                        <div className="text-zinc-400 font-mono">{leg.odds}</div>
                      </div>
                    ))}

                    {bet.status === "pending" && (
                      <div className="flex gap-2 pt-1">
                        <button onClick={() => settle(bet.id, "won")}  className="flex-1 bg-green-600/20 hover:bg-green-600/40 text-green-300 text-xs py-2 rounded-xl transition">✓ Ganada</button>
                        <button onClick={() => settle(bet.id, "lost")} className="flex-1 bg-red-600/20  hover:bg-red-600/40  text-red-300   text-xs py-2 rounded-xl transition">✗ Perdida</button>
                        <button onClick={() => settle(bet.id, "void")} className="flex-1 bg-zinc-700   hover:bg-zinc-600   text-zinc-300   text-xs py-2 rounded-xl transition">— Anulada</button>
                      </div>
                    )}

                    <div className="text-xs text-zinc-600">
                      {new Date(bet.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
