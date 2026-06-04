"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { usePlan } from "@/lib/plan"
import { TeamCrest } from "@/components/teams/TeamCrest"
import { ReviewEditor } from "@/components/bets/ReviewEditor"

interface BetLeg { id: string; match: string; selection: string; odds: number; status: string }
interface Bet {
  id: string; title: string; stake: number | null; combined_odds: number | null; status: string
  sport: string; notes?: string; image_url?: string; created_at: string; settled_at?: string
  needs_review?: boolean; is_published?: boolean
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
  const [scanningImage, setScanningImage] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  // ── Bloque E: pipeline OCR end-to-end (POST /api/bets/auto-extract) ────────
  // Flujo premium: el usuario sube UNA imagen, el backend la procesa con
  // Claude Vision y devuelve el bet creado (201) — sin tocar el form manual.
  const [isExtracting, setIsExtracting] = useState(false)
  const [extractError, setExtractError] = useState<string | null>(null)
  const autoExtractInputRef = useRef<HTMLInputElement>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [filter, setFilter] = useState<"all" | "pending" | "won" | "lost">("all")
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [analysisText, setAnalysisText] = useState("")
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const analysisRef = useRef<HTMLDivElement>(null)
  const { plan } = usePlan()

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

  /** Compress image to base64 JPEG (max 1200px, q=0.82) for Claude Vision */
  const compressToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        const scale = Math.min(1, 1200 / Math.max(img.width, img.height))
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const c = document.createElement("canvas")
        c.width = w; c.height = h
        c.getContext("2d")!.drawImage(img, 0, 0, w, h)
        URL.revokeObjectURL(url)
        resolve(c.toDataURL("image/jpeg", 0.82).split(",")[1])
      }
      img.onerror = reject
      img.src = url
    })

  /**
   * ── Bloque E: Auto-extracción OCR end-to-end ───────────────────────────────
   * Sube la imagen a /api/bets/auto-extract (multipart/form-data, campo "file").
   * El endpoint guarda la imagen en Storage, llama a Claude Vision, inserta
   * `bets`+`bet_legs` y devuelve `{ ok, bet, review }` con status 201.
   * Aquí hacemos optimistic insert: el bet aparece al instante en la lista.
   * Si `needs_review: true`, el ReviewEditor del Bloque D se monta solo.
   */
  const handleAutoExtract = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // limpia cualquier error previo apenas el usuario elige un archivo nuevo
    setExtractError(null)
    if (!file) return
    if (isExtracting) return
    if (!file.type.startsWith("image/")) {
      setExtractError("El archivo debe ser una imagen (JPG/PNG/WebP).")
      e.target.value = ""
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setExtractError("La imagen no puede superar 5 MB.")
      e.target.value = ""
      return
    }

    setIsExtracting(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/bets/auto-extract", { method: "POST", body: fd })
      const payload: {
        ok?: boolean
        bet?: {
          id: string
          title: string
          stake: number | null
          combined_odds: number
          legs?: Array<{ match: string; market?: string | null; selection: string; odds: number }>
          image_url: string
          needs_review: boolean
          ai_confidence?: number
          bookmaker?: string | null
        }
        error?: string
      } = await res.json().catch(() => ({}))

      if (!res.ok || !payload.bet) {
        setExtractError(
          payload.error ??
          "No se pudo procesar la imagen, inténtalo de nuevo o súbela manualmente."
        )
        return
      }

      // Optimistic insert — mapea la respuesta del endpoint a la interfaz Bet
      // del cliente. El endpoint NO devuelve `status` ni `created_at`, así que
      // los sintetizamos: status=pending (lo fija el insert del backend) y
      // created_at=ahora. Próximo `load()` los confirmará desde el servidor.
      const nowIso = new Date().toISOString()
      const newBet: Bet = {
        id: payload.bet.id,
        title: payload.bet.title,
        stake: payload.bet.stake,
        combined_odds: payload.bet.combined_odds,
        status: "pending",
        sport: "football",
        image_url: payload.bet.image_url,
        created_at: nowIso,
        needs_review: payload.bet.needs_review,
        is_published: false,
        bet_legs: (payload.bet.legs ?? []).map((l, i) => ({
          id: `tmp-${payload.bet!.id}-${i}`,
          match: l.match,
          selection: l.selection,
          odds: l.odds,
          status: "pending",
        })),
      }
      setBets(prev => [newBet, ...prev])
    } catch {
      setExtractError("Error de conexión. Comprueba tu red e inténtalo de nuevo.")
    } finally {
      setIsExtracting(false)
      e.target.value = ""
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || uploadingImage || scanningImage) return
    if (!file.type.startsWith("image/")) return
    if (file.size > 5 * 1024 * 1024) { setScanError("La imagen no puede superar 5 MB"); return }
    setScanError(null)
    setUploadingImage(true)
    setScanningImage(true)
    try {
      // Run upload + scan in parallel
      const [base64, uploadRes] = await Promise.all([
        compressToBase64(file),
        fetch("/api/bets/upload", { method: "POST", body: (() => { const fd = new FormData(); fd.append("file", file); return fd })() }),
      ])
      // Save image URL
      let imageUrl = ""
      if (uploadRes.ok) {
        const { url } = await uploadRes.json()
        imageUrl = url
      }
      setForm(f => ({ ...f, imageUrl }))

      // Scan with Claude Vision
      const scanRes = await fetch("/api/tipster/extract-bet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType: "image/jpeg" }),
      })
      if (scanRes.ok) {
        const { bet } = await scanRes.json()
        if (bet) {
          setForm(f => ({
            ...f,
            imageUrl,
            title: bet.title || f.title,
            combined_odds: String(bet.combinedOdds || f.combined_odds),
            stake: bet.totalStake ? String(bet.totalStake) : f.stake,
            legs: bet.legs?.length
              ? bet.legs.map((l: any) => ({ match: l.match ?? "", selection: l.selection ?? "", odds: String(l.odds ?? 1.5) }))
              : f.legs,
          }))
        }
      } else {
        setScanError("No se pudo leer el boleto. Rellena los campos manualmente.")
      }
    } catch {
      setScanError("Error de conexión al procesar la imagen.")
    } finally {
      setUploadingImage(false); setScanningImage(false); e.target.value = ""
    }
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

  const runAnalysis = async () => {
    if (analysisLoading) return
    setAnalysisLoading(true)
    setAnalysisText("")
    setAnalysisError(null)
    setShowAnalysis(true)
    setTimeout(() => analysisRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100)
    try {
      const res = await fetch("/api/bets/analysis", { method: "POST" })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setAnalysisError(d.error ?? "Error al generar análisis")
        setAnalysisLoading(false)
        return
      }
      const reader = res.body?.getReader()
      if (!reader) { setAnalysisError("Sin respuesta"); setAnalysisLoading(false); return }
      const dec = new TextDecoder()
      let buf = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const lines = buf.split("\n")
        buf = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          const raw = line.slice(6)
          if (raw === "[DONE]") break
          try { const { text } = JSON.parse(raw); if (text) setAnalysisText(t => t + text) } catch { }
        }
      }
    } catch (e: any) {
      setAnalysisError("Error de conexión: " + (e?.message ?? "desconocido"))
    } finally {
      setAnalysisLoading(false)
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
      <div className="sticky top-0 z-10 bg-zinc-950/90 backdrop-blur-xl border-b border-white/[0.07] px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">Mis Apuestas</h1>
          <p className="text-xs text-zinc-500">Historial y seguimiento</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Botón premium: escaneo OCR end-to-end vía /api/bets/auto-extract */}
          <button
            type="button"
            onClick={() => autoExtractInputRef.current?.click()}
            disabled={isExtracting}
            className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 disabled:cursor-wait text-zinc-950 text-sm font-semibold px-4 py-2 rounded-xl transition shadow-[0_0_0_1px_rgba(34,211,238,0.25)]"
          >
            {isExtracting ? (
              <>
                <span className="w-3.5 h-3.5 rounded-full border-2 border-zinc-950 border-t-transparent animate-spin" />
                Analizando boleto…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h2l2-2h6l2 2h2a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <circle cx="12" cy="13" r="3.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Escanear boleto
              </>
            )}
          </button>
          {/* Fallback manual — pidió el usuario en todo.md D4 */}
          <button
            type="button"
            onClick={() => setShowForm(s => !s)}
            className="bg-zinc-800/70 border border-white/[0.07] hover:border-white/[0.16] text-zinc-300 text-sm font-semibold px-3 py-2 rounded-xl transition"
          >
            Manual
          </button>
          {/* Input oculto reutilizado por el botón cyan */}
          <input
            ref={autoExtractInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={handleAutoExtract}
            disabled={isExtracting}
          />
        </div>
      </div>

      {/* Banner de error del auto-extract — visible justo bajo el header */}
      {extractError && (
        <div className="max-w-2xl mx-auto px-4 pt-3">
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-xs px-3 py-2.5 flex items-start gap-2">
            <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <div className="flex-1">
              <p className="font-medium">{extractError}</p>
              <button
                type="button"
                onClick={() => { setExtractError(null); setShowForm(true) }}
                className="mt-1 text-[11px] underline underline-offset-2 text-red-200 hover:text-white"
              >
                Subir manualmente
              </button>
            </div>
            <button
              type="button"
              onClick={() => setExtractError(null)}
              className="text-red-300/70 hover:text-red-100 text-base leading-none"
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        {/* Stats bar */}
        {stats && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Winrate", value: `${stats.winrate}%`, color: stats.winrate >= 50 ? "text-green-400" : "text-red-400" },
              { label: "Yield", value: `${stats.yield > 0 ? "+" : ""}${stats.yield}%`, color: stats.yield >= 0 ? "text-green-400" : "text-red-400" },
              { label: "Beneficio", value: `${stats.profit >= 0 ? "+" : ""}${stats.profit}€`, color: stats.profit >= 0 ? "text-green-400" : "text-red-400" },
            ].map(s => (
              <div key={s.label} className="bg-zinc-900/60 rounded-xl p-3 text-center border border-white/[0.07]">
                <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-zinc-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* PRO/PREMIUM AI Analysis */}
        {(plan === "premium" || plan === "pro") && stats && stats.settled >= 3 && (
          <div>
            <button
              onClick={runAnalysis}
              disabled={analysisLoading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-purple-700/40 bg-purple-500/[0.08] hover:bg-purple-500/[0.15] text-purple-300 text-sm font-bold transition-all tap"
            >
              {analysisLoading
                ? <><span className="w-3.5 h-3.5 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />Analizando historial…</>
                : <>🧠 Analizar mi historial con IA</>
              }
            </button>

            {showAnalysis && (
              <div ref={analysisRef} className="mt-3 rounded-2xl border border-purple-800/40 bg-zinc-900/60 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-purple-400">🧠 Análisis personalizado · {plan.toUpperCase()}</p>
                  <button onClick={() => setShowAnalysis(false)} className="text-zinc-600 hover:text-zinc-400 text-lg leading-none">×</button>
                </div>
                {analysisError ? (
                  <p className="text-sm text-amber-400">{analysisError}</p>
                ) : (
                  <div className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
                    {analysisText || <span className="text-zinc-500 animate-pulse">Generando análisis…</span>}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Pending bets to settle prompt */}
        {pendingToSettle.length > 0 && (
          <div className="rounded-2xl border border-amber-700/40 bg-amber-500/[0.08] p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">⏰</span>
              <div>
                <p className="text-sm font-black text-amber-300">¿Cómo fue?</p>
                <p className="text-xs text-zinc-500">{pendingToSettle.length} apuesta{pendingToSettle.length > 1 ? "s" : ""} de ayer sin resultado</p>
              </div>
            </div>
            {pendingToSettle.slice(0, 3).map(b => (
              <div key={b.id} className="bg-zinc-900/60 border border-white/[0.07] rounded-xl p-3 space-y-2">
                <p className="text-xs font-bold text-white truncate">{b.title}</p>
                <p className="text-[11px] text-zinc-500">
                  {b.stake}€ @ {b.combined_odds} · {new Date(b.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                </p>
                <div className="flex gap-2">
                  <button onClick={() => settle(b.id, "won")}
                    className="flex-1 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 text-xs font-bold border border-emerald-700/40 transition-all">
                    ✓ Ganada
                  </button>
                  <button onClick={() => settle(b.id, "lost")}
                    className="flex-1 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 text-xs font-bold border border-rose-700/40 transition-all">
                    ✗ Perdida
                  </button>
                  <button onClick={() => settle(b.id, "void")}
                    className="w-16 py-2 rounded-xl bg-zinc-800/60 border border-white/[0.07] hover:bg-zinc-700/60 text-zinc-500 text-xs font-bold transition-all">
                    Anulada
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add bet form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="bg-zinc-900/60 rounded-2xl border border-white/[0.07] p-4 space-y-3">
            <h2 className="font-semibold text-sm text-zinc-300">Nueva apuesta</h2>
            <input
              className="w-full bg-zinc-800/60 border border-white/[0.07] rounded-xl px-3 py-2 text-sm placeholder-zinc-500 outline-none focus:border-white/[0.16]"
              placeholder="Título (opcional)"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            />
            <div className="flex gap-2">
              <input
                className="flex-1 bg-zinc-800/60 border border-white/[0.07] rounded-xl px-3 py-2 text-sm placeholder-zinc-500 outline-none focus:border-white/[0.16]"
                placeholder="Stake (€)"
                type="number" step="0.01" min="0"
                value={form.stake}
                onChange={e => setForm(f => ({ ...f, stake: e.target.value }))}
              />
              <input
                className="flex-1 bg-zinc-800/60 border border-white/[0.07] rounded-xl px-3 py-2 text-sm placeholder-zinc-500 outline-none focus:border-white/[0.16]"
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
                      className="w-full bg-zinc-800/60 border border-white/[0.06] rounded-[9px] px-2.5 py-1.5 text-xs placeholder-zinc-600 outline-none"
                      placeholder="Partido (ej: Real Madrid vs Barça)"
                      value={leg.match}
                      onChange={e => updateLeg(i, "match", e.target.value)}
                    />
                    <div className="flex gap-1">
                      <input
                        className="flex-1 bg-zinc-800/60 border border-white/[0.06] rounded-[9px] px-2.5 py-1.5 text-xs placeholder-zinc-600 outline-none"
                        placeholder="Selección"
                        value={leg.selection}
                        onChange={e => updateLeg(i, "selection", e.target.value)}
                      />
                      <input
                        className="w-16 bg-zinc-800/60 border border-white/[0.06] rounded-[9px] px-2 py-1.5 text-xs placeholder-zinc-600 outline-none text-center"
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

            {/* Image upload + scan */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-2">
                <label className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/[0.07] bg-zinc-800/60 text-xs text-zinc-400 hover:text-zinc-200 hover:border-white/[0.12] cursor-pointer transition ${(uploadingImage || scanningImage) ? "opacity-40 pointer-events-none" : ""}`}>
                  <input type="file" accept="image/*" className="sr-only" onChange={handleImageUpload} disabled={uploadingImage || scanningImage} />
                  {scanningImage
                    ? <span className="w-3 h-3 rounded-full border-2 border-green-500 border-t-transparent animate-spin" />
                    : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  }
                  {scanningImage ? "Leyendo boleto con IA…" : form.imageUrl ? "Boleto escaneado ✓" : "📷 Subir boleto (auto-rellena)"}
                </label>
                {form.imageUrl && (
                  <button type="button" onClick={() => { setForm(f => ({ ...f, imageUrl: "" })); setScanError(null) }} className="text-xs text-red-400 hover:text-red-300">✕ Quitar</button>
                )}
              </div>
              {scanError && <p className="text-xs text-amber-400">{scanError}</p>}
              {form.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.imageUrl} alt="Boleto" className="w-full max-h-48 object-contain rounded-xl border border-white/[0.07] bg-zinc-900/60" />
              )}
            </div>

            {saveError && (
              <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-700/30 rounded-[9px] px-3 py-2">{saveError}</p>
            )}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => { setShowForm(false); setSaveError(null) }} className="flex-1 bg-zinc-800/60 border border-white/[0.07] hover:bg-zinc-700/60 rounded-xl py-2 text-sm transition">Cancelar</button>
              <button type="submit" disabled={saving} className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 disabled:opacity-50 rounded-xl py-2 text-sm font-semibold transition">
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </form>
        )}

        {/* Filter tabs */}
        <div className="flex gap-1 bg-zinc-900/80 p-1 rounded-xl border border-white/[0.07]">
          {(["all", "pending", "won", "lost"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition ${filter === f ? "bg-white/[0.09] text-white" : "text-zinc-500 hover:text-zinc-300"}`}
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
              <div key={bet.id} className="bg-zinc-900/60 rounded-2xl border border-white/[0.07] overflow-hidden">
                {/* Bet header */}
                <div
                  className="p-4 cursor-pointer hover:bg-white/[0.02] transition"
                  onClick={() => setExpanded(e => e === bet.id ? null : bet.id)}
                >
                  <div className="flex items-start gap-3 justify-between">
                    {bet.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={bet.image_url}
                        alt=""
                        className="w-12 h-12 rounded-lg object-cover border border-white/[0.07] shrink-0 bg-zinc-900"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{bet.title}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[bet.status]}`}>
                          {STATUS_LABEL[bet.status]}
                        </span>
                        {bet.stake != null
                          ? <span className="text-xs text-zinc-500">{bet.stake}€ × {bet.combined_odds ?? "—"}</span>
                          : <span className="text-xs text-amber-400/80 font-medium">Stake pendiente</span>
                        }
                        {bet.needs_review && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25">
                            Revisar
                          </span>
                        )}
                        {bet.status === "won" && bet.stake != null && bet.combined_odds != null && (
                          <span className="text-xs text-green-400 font-semibold">
                            +{((bet.combined_odds - 1) * bet.stake).toFixed(2)}€
                          </span>
                        )}
                        {bet.status === "lost" && bet.stake != null && (
                          <span className="text-xs text-red-400 font-semibold">-{bet.stake}€</span>
                        )}
                      </div>
                    </div>
                    <div className="text-zinc-600 text-sm shrink-0">{expanded === bet.id ? "▲" : "▼"}</div>
                  </div>
                </div>

                {/* Expanded details */}
                {expanded === bet.id && (
                  <div className="border-t border-white/[0.07] px-4 pb-4 pt-3 space-y-3">
                    {/* Legs */}
                    {bet.bet_legs && bet.bet_legs.length > 0 ? (
                      <div className="space-y-2">
                        {bet.bet_legs.map((leg, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs bg-zinc-800/50 border border-white/[0.06] rounded-[9px] px-3 py-2">
                            <TeamCrest teamName={leg.match} size="sm" />
                            <div className="flex-1 min-w-0">
                              <div className="text-zinc-400 truncate">{leg.match}</div>
                              <div className="font-semibold text-white">{leg.selection}</div>
                            </div>
                            <div className="text-green-400 font-mono font-bold shrink-0">@{Number(leg.odds).toFixed(2)}</div>
                            {leg.status !== "pending" && (
                              <span className={`text-[10px] font-bold shrink-0 ${leg.status === "won" ? "text-green-400" : leg.status === "lost" ? "text-red-400" : "text-zinc-500"}`}>
                                {leg.status === "won" ? "✓" : leg.status === "lost" ? "✗" : "—"}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-600">Sin selecciones registradas</p>
                    )}

                    {/* Attached image */}
                    {bet.image_url && (
                      <div className="rounded-xl overflow-hidden border border-white/[0.07]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={bet.image_url} alt="Boleto" className="w-full max-h-64 object-contain bg-zinc-900" />
                      </div>
                    )}

                    {bet.status === "pending" && (
                      <div className="flex gap-2 pt-1">
                        <button onClick={() => settle(bet.id, "won")}  className="flex-1 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-xs py-2 rounded-xl border border-emerald-700/40 transition">✓ Ganada</button>
                        <button onClick={() => settle(bet.id, "lost")} className="flex-1 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs py-2 rounded-xl border border-rose-700/40 transition">✗ Perdida</button>
                        <button onClick={() => settle(bet.id, "void")} className="flex-1 bg-zinc-800/60 border border-white/[0.07] hover:bg-zinc-700/60 text-zinc-400 text-xs py-2 rounded-xl transition">— Anulada</button>
                      </div>
                    )}

                    <div className="text-xs text-zinc-600">
                      {new Date(bet.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
                    </div>
                  </div>
                )}

                {/* ReviewEditor — visible siempre que needs_review=true, fuera del toggle */}
                {bet.needs_review && (
                  <ReviewEditor
                    bet={{ id: bet.id, stake: bet.stake, combined_odds: bet.combined_odds }}
                    onSaved={(patch) =>
                      setBets(prev => prev.map(b => b.id === bet.id ? { ...b, ...patch } : b))
                    }
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
