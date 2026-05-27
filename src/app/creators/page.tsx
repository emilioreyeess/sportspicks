"use client"

import { useRef, useState, useEffect } from "react"
import { Icon } from "@/components/ui/icons"
import { useSession } from "next-auth/react"

// ── Canvas image generator ────────────────────────────────────
interface BetLeg { match: string; selection: string; odds: number }
interface BetData {
  title: string
  legs: BetLeg[]
  combinedOdds: number
  aiProb: number
  edge: number
}

async function generateBetImage(bet: BetData): Promise<Blob> {
  const W    = 600
  const LEGS = bet.legs.length
  const H    = 140 + LEGS * 70 + 180
  const canvas = document.createElement("canvas")
  canvas.width  = W * 2
  canvas.height = H * 2
  const ctx = canvas.getContext("2d")!
  ctx.scale(2, 2)

  // Pure black background
  ctx.fillStyle = "#000000"
  ctx.fillRect(0, 0, W, H)

  // Subtle green border
  ctx.strokeStyle = "rgba(34,197,94,0.35)"
  ctx.lineWidth = 1.5
  ctx.strokeRect(0.75, 0.75, W - 1.5, H - 1.5)

  // Top accent line
  ctx.fillStyle = "#22c55e"
  ctx.fillRect(0, 0, W, 3)

  // ── Logo (top-left corner) ─────────────────────────────────
  // Circle icon
  ctx.fillStyle = "#22c55e"
  ctx.beginPath(); ctx.arc(28, 28, 14, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = "#000000"
  ctx.font = "bold 14px system-ui, sans-serif"
  ctx.textAlign = "center"
  ctx.fillText("SP", 28, 33)
  ctx.textAlign = "left"
  // Brand name
  ctx.fillStyle = "#ffffff"
  ctx.font = "bold 14px system-ui, sans-serif"
  ctx.fillText("SportsPicks", 50, 25)
  ctx.fillStyle = "#4ade80"
  ctx.font = "10px system-ui, sans-serif"
  ctx.fillText("Analytics Engine", 50, 39)

  // VIP badge (top-right)
  ctx.fillStyle = "rgba(139,92,246,0.2)"
  ctx.roundRect(W - 106, 14, 90, 24, 12)
  ctx.fill()
  ctx.strokeStyle = "rgba(139,92,246,0.5)"
  ctx.lineWidth = 1
  ctx.roundRect(W - 106, 14, 90, 24, 12)
  ctx.stroke()
  ctx.fillStyle = "#a78bfa"
  ctx.font = "bold 10px system-ui, sans-serif"
  ctx.textAlign = "center"
  ctx.fillText("TIPSTER VIP", W - 61, 30)
  ctx.textAlign = "left"

  // Divider after header
  ctx.strokeStyle = "rgba(34,197,94,0.15)"
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(20, 56); ctx.lineTo(W - 20, 56); ctx.stroke()

  // Title
  ctx.fillStyle = "#ffffff"
  ctx.font = "bold 22px system-ui, sans-serif"
  ctx.fillText(bet.title, 24, 88)

  // Divider after title
  ctx.strokeStyle = "rgba(255,255,255,0.07)"
  ctx.beginPath(); ctx.moveTo(24, 100); ctx.lineTo(W - 24, 100); ctx.stroke()

  // ── Legs ──────────────────────────────────────────────────
  let y = 124
  for (let i = 0; i < LEGS; i++) {
    const leg = bet.legs[i]
    // Alternating row background
    ctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.015)"
    ctx.fillRect(16, y - 20, W - 32, 58)

    ctx.fillStyle = "#f4f4f5"
    ctx.font = "600 13px system-ui, sans-serif"
    ctx.fillText(leg.match, 28, y)

    ctx.fillStyle = "#71717a"
    ctx.font = "12px system-ui, sans-serif"
    ctx.fillText(leg.selection, 28, y + 18)

    // Odds pill (right)
    ctx.fillStyle = "rgba(34,197,94,0.12)"
    ctx.roundRect(W - 80, y - 14, 64, 26, 8)
    ctx.fill()
    ctx.fillStyle = "#4ade80"
    ctx.font = "bold 14px system-ui, sans-serif"
    ctx.textAlign = "center"
    ctx.fillText(`@${leg.odds.toFixed(2)}`, W - 48, y + 4)
    ctx.textAlign = "left"

    y += 70
  }

  // ── Combined odds block ────────────────────────────────────
  const blockY = y + 10
  ctx.fillStyle = "rgba(34,197,94,0.08)"
  ctx.fillRect(16, blockY, W - 32, 80)
  ctx.strokeStyle = "rgba(34,197,94,0.3)"
  ctx.lineWidth = 1
  ctx.strokeRect(16, blockY, W - 32, 80)

  // Combined odds
  ctx.fillStyle = "#4ade80"
  ctx.font = "bold 38px system-ui, sans-serif"
  ctx.fillText(`@${bet.combinedOdds.toFixed(2)}`, 28, blockY + 52)

  // Prob + Ventaja (right side)
  ctx.fillStyle = "#a1a1aa"
  ctx.font = "11px system-ui, sans-serif"
  ctx.textAlign = "right"
  ctx.fillText(`Probabilidad IA: ${bet.aiProb}%`, W - 24, blockY + 32)
  ctx.fillStyle = "#4ade80"
  ctx.font = "bold 13px system-ui, sans-serif"
  ctx.fillText(`Ventaja: +${bet.edge}%`, W - 24, blockY + 52)
  ctx.textAlign = "left"

  // ── Disclaimer ─────────────────────────────────────────────
  const discY = blockY + 100
  ctx.fillStyle = "rgba(255,200,0,0.06)"
  ctx.fillRect(16, discY, W - 32, 52)
  ctx.strokeStyle = "rgba(255,200,0,0.2)"
  ctx.lineWidth = 1
  ctx.strokeRect(16, discY, W - 32, 52)

  ctx.fillStyle = "#d4d4d8"  // much more readable: light gray
  ctx.font = "12px system-ui, sans-serif"
  const disc = "⚠️  Apuesta con valor matemático detectado. No existen picks seguros, sujeto a varianza deportiva."
  const words = disc.split(" ")
  let line = ""; let lineY = discY + 20
  for (const w of words) {
    const test = line + w + " "
    if (ctx.measureText(test).width > W - 56 && line) {
      ctx.fillText(line.trim(), 28, lineY)
      line = w + " "; lineY += 18
    } else { line = test }
  }
  ctx.fillText(line.trim(), 28, lineY)

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), "image/png", 1))
}

async function shareOrDownload(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: "image/png" })
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: "SportsPicks — Boleto IA" })
  } else {
    const url = URL.createObjectURL(blob)
    const a   = document.createElement("a")
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }
}

// ── VIP Gate ──────────────────────────────────────────────────
function VipCodeGate({ onUnlock }: { onUnlock: () => void }) {
  const [code, setCode]     = useState("")
  const [error, setError]   = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    if (!code.trim()) return
    setLoading(true); setError("")
    try {
      const res = await fetch("/api/tipster/validate-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      })
      if (res.ok) { onUnlock() }
      else { const d = await res.json(); setError(d.error ?? "Código inválido o expirado.") }
    } catch {
      setError("Error de conexión. Inténtalo de nuevo.")
    }
    setLoading(false)
  }

  return (
    <div className="safe-x flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 grid place-items-center mb-5">
        <Icon name="lock" className="w-8 h-8 text-zinc-500" strokeWidth={1.5} />
      </div>
      <h1 className="text-xl font-black text-white mb-1">Área de Tipsters VIP</h1>
      <p className="text-sm text-zinc-500 max-w-xs mb-8 leading-relaxed">
        Esta sección es exclusiva para tipsters verificados. Introduce tu código de acceso.
      </p>
      <div className="w-full max-w-xs space-y-3">
        <input value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setError("") }}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="Código VIP" maxLength={12}
          className="w-full text-center text-xl font-black tracking-[0.25em] bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-3.5 text-white placeholder:text-zinc-700 focus:outline-none focus:border-zinc-700 uppercase" />
        {error && <p className="text-xs text-rose-400 font-bold">{error}</p>}
        <button onClick={handleSubmit} disabled={loading || !code.trim()}
          className="w-full py-3.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-30 text-white font-bold text-sm tap transition-all">
          {loading ? "Verificando..." : "Acceder"}
        </button>
      </div>
      <p className="text-[10px] text-zinc-700 mt-8 max-w-xs">
        ¿No tienes código? Contacta con el equipo de SportsPicks para solicitar acceso de tipster verificado.
      </p>
    </div>
  )
}

// ── Image Generator ───────────────────────────────────────────
const EMPTY_LEG: BetLeg = { match: "", selection: "", odds: 1.5 }

function calcCombinedOdds(legs: BetLeg[]) {
  return legs.reduce((acc, l) => acc * (l.odds || 1), 1)
}

function ImageGenerator() {
  const [title, setTitle]         = useState("Mi Combinada")
  const [legs, setLegs]           = useState<BetLeg[]>([
    { match: "", selection: "", odds: 1.5 },
    { match: "", selection: "", odds: 1.5 },
  ])
  const [aiProb, setAiProb]       = useState(35)
  const [ventaja, setVentaja]     = useState(10)
  const [generating, setGenerating] = useState(false)
  const [done, setDone]           = useState(false)
  const [showForm, setShowForm]   = useState(true)
  const [scanning, setScanning]   = useState(false)
  const [scanError, setScanError] = useState("")
  const fileRef                   = useRef<HTMLInputElement>(null)

  async function compressToBase64(file: File, maxPx = 1200, quality = 0.82): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const c = document.createElement("canvas")
        c.width = w; c.height = h
        c.getContext("2d")!.drawImage(img, 0, 0, w, h)
        URL.revokeObjectURL(url)
        resolve(c.toDataURL("image/jpeg", quality).split(",")[1])
      }
      img.onerror = reject
      img.src = url
    })
  }

  async function handleScan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setScanError(""); setScanning(true)
    try {
      const base64 = await compressToBase64(file)
      const res = await fetch("/api/tipster/extract-bet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType: "image/jpeg" }),
      })
      const data = await res.json()
      if (!res.ok || !data.bet) throw new Error(data.error ?? "Error")
      const bet = data.bet
      if (bet.title)       setTitle(bet.title)
      if (bet.legs?.length) setLegs(bet.legs.map((l: any) => ({
        match: l.match ?? "", selection: l.selection ?? "", odds: parseFloat(l.odds) || 1.5,
      })))
      setShowForm(true)
    } catch {
      setScanError("No se pudo leer el boleto. Intenta con una captura más clara.")
    } finally {
      setScanning(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const combinedOdds = calcCombinedOdds(legs)

  function updateLeg(i: number, field: keyof BetLeg, value: string | number) {
    setLegs(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l))
    setDone(false)
  }
  function addLeg()    { if (legs.length < 8) setLegs(prev => [...prev, { ...EMPTY_LEG }]) }
  function removeLeg(i: number) { if (legs.length > 1) setLegs(prev => prev.filter((_, idx) => idx !== i)) }

  const bet: BetData = { title, legs, combinedOdds, aiProb, edge: ventaja }
  const isValid = legs.every(l => l.match.trim() && l.selection.trim() && l.odds >= 1.01)

  async function handleGenerate() {
    if (!isValid) return
    setGenerating(true); setDone(false)
    try {
      const blob = await generateBetImage(bet)
      await shareOrDownload(blob, `sportspicks-boleto-${Date.now()}.png`)
      setDone(true)
    } catch (e) {
      console.error(e)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="image" className="w-4 h-4 text-violet-400" strokeWidth={2} />
          <span className="text-xs font-black uppercase tracking-widest text-violet-400">Generador de imagen</span>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          className="text-[11px] text-zinc-500 hover:text-zinc-300 tap font-bold">
          {showForm ? "Ocultar" : "Editar datos"}
        </button>
      </div>

      {/* Scan button */}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleScan} />
      <button onClick={() => fileRef.current?.click()} disabled={scanning}
        className="w-full py-3 rounded-xl border-2 border-dashed border-violet-700/50 hover:border-violet-500/70 bg-violet-500/5 hover:bg-violet-500/10 text-violet-400 font-bold text-sm tap transition-all flex items-center justify-center gap-2 disabled:opacity-50">
        {scanning
          ? <><span className="w-4 h-4 rounded-full border-2 border-violet-400/30 border-t-violet-400 animate-spin" /> Leyendo boleto...</>
          : <><Icon name="download" className="w-4 h-4 rotate-180" strokeWidth={2.2} /> Subir captura del boleto</>
        }
      </button>
      {scanError && <p className="text-xs text-rose-400 text-center font-bold">{scanError}</p>}
      {!scanError && !scanning && (
        <p className="text-[10px] text-zinc-600 text-center -mt-2">
          Sube una captura de tu boleto y el sistema rellena los datos automáticamente
        </p>
      )}

      {/* Editable form */}
      {showForm && (
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 space-y-3">
          {/* Title */}
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Nombre de la combinada"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-600" />

          {/* Legs */}
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Selecciones ({legs.length})</p>
            {legs.map((leg, i) => (
              <div key={i} className="rounded-lg border border-zinc-700/50 bg-zinc-800/50 p-2.5 space-y-2">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-black text-zinc-500">#{i + 1}</span>
                  {legs.length > 1 && (
                    <button onClick={() => removeLeg(i)} className="tap text-zinc-600 hover:text-rose-400">
                      <Icon name="trash" className="w-3.5 h-3.5" strokeWidth={2} />
                    </button>
                  )}
                </div>
                <input value={leg.match} onChange={e => updateLeg(i, "match", e.target.value)}
                  placeholder="Partido (ej: Real Madrid vs Barça)"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-600" />
                <div className="flex gap-2">
                  <input value={leg.selection} onChange={e => updateLeg(i, "selection", e.target.value)}
                    placeholder="Selección (ej: Over 2.5)"
                    className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-600" />
                  <input type="number" value={leg.odds} min={1.01} max={99} step={0.01}
                    onChange={e => updateLeg(i, "odds", parseFloat(e.target.value) || 1.01)}
                    className="w-20 bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-emerald-400 font-bold focus:outline-none focus:border-violet-600" />
                </div>
              </div>
            ))}
            {legs.length < 8 && (
              <button onClick={addLeg}
                className="w-full py-2 rounded-lg border border-dashed border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 text-xs font-bold tap transition-colors">
                + Añadir selección
              </button>
            )}
          </div>

          {/* Prob + Ventaja */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] text-zinc-500 mb-1">Prob. IA (%)</p>
              <input type="number" value={aiProb} min={1} max={99}
                onChange={e => setAiProb(Number(e.target.value))}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-violet-400 font-bold focus:outline-none focus:border-violet-600" />
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 mb-1">Ventaja (%)</p>
              <input type="number" value={ventaja} min={0} max={99}
                onChange={e => setVentaja(Number(e.target.value))}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-emerald-400 font-bold focus:outline-none focus:border-violet-600" />
            </div>
          </div>
        </div>
      )}

      {/* Preview */}
      <div className="rounded-2xl border border-violet-700/50 bg-gradient-to-br from-violet-900/30 via-zinc-900 to-zinc-950 overflow-hidden">
        <div className="px-5 pt-5 pb-4 border-b border-violet-800/30">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-black text-zinc-400">⚡ SportsPicks Analytics</span>
            <span className="ml-auto text-[10px] font-black bg-violet-500/15 border border-violet-700/50 text-violet-400 px-2 py-0.5 rounded-full">TIPSTER VIP</span>
          </div>
          <h3 className="text-lg font-black text-white">{title || "Mi Combinada"}</h3>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-2xl font-black text-emerald-400">@{combinedOdds.toFixed(2)}</span>
            <div className="text-xs text-zinc-500">
              <p>Prob. IA: <span className="text-violet-400 font-bold">{aiProb}%</span></p>
              <p>Ventaja: <span className="text-emerald-400 font-bold">+{ventaja}%</span></p>
            </div>
          </div>
        </div>
        <div className="px-5 py-3 space-y-2">
          {legs.map((leg, i) => (
            <div key={i} className="flex items-center justify-between gap-2 py-1 border-b border-zinc-800/50 last:border-0">
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">{leg.match || `Partido ${i + 1}`}</p>
                <p className="text-[10px] text-zinc-500">{leg.selection || "—"}</p>
              </div>
              <span className="text-sm font-black text-emerald-400 shrink-0">@{(leg.odds || 1.5).toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div className="px-5 py-3 bg-zinc-900/60 border-t border-zinc-800/50">
          <p className="text-[9px] text-zinc-500 leading-relaxed">
            ⚠️ Apuesta con valor matemático detectado. No existen picks seguros, sujeto a varianza deportiva.
          </p>
        </div>
      </div>

      <button onClick={handleGenerate} disabled={generating || !isValid}
        className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-bold text-sm tap transition-all flex items-center justify-center gap-2">
        <Icon name={done ? "check" : "download"} className="w-4 h-4" strokeWidth={2.2} />
        {generating ? "Generando imagen..." : done ? "¡Guardada en galería!" : "Guardar imagen en galería"}
      </button>
      {!isValid && <p className="text-[10px] text-zinc-600 text-center">Rellena todos los campos para generar la imagen.</p>}
      {done && <p className="text-[11px] text-emerald-400 text-center font-bold">✓ Imagen guardada. Compártela en Twitter/X y reclama tu bounty.</p>}
    </div>
  )
}

// ── Bounty dashboard ──────────────────────────────────────────
const BOUNTY_STATUS = {
  pending:  { label: "Pendiente", cls: "text-amber-400 bg-amber-500/10 border-amber-700/40"   },
  approved: { label: "Aprobado",  cls: "text-emerald-400 bg-emerald-500/10 border-emerald-700/40" },
  rejected: { label: "Rechazado", cls: "text-rose-400 bg-rose-500/10 border-rose-700/40"     },
} as const

function BountyDashboard() {
  const [showSubmit, setShowSubmit] = useState(false)
  const [twitterUrl, setTwitterUrl] = useState("")
  const [sending, setSending]       = useState(false)
  const [sent, setSent]             = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [bounties, setBounties]     = useState<any[]>([])

  useEffect(() => {
    fetch("/api/tipster/claim-bounty")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.bounties) setBounties(d.bounties) })
      .catch(() => {})
  }, [sent])

  async function handleClaim() {
    if (!twitterUrl.trim()) return
    setSending(true); setSubmitError("")
    try {
      const res = await fetch("/api/tipster/claim-bounty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ twitter_url: twitterUrl.trim() }),
      })
      if (res.ok) {
        setSent(true); setShowSubmit(false); setTwitterUrl("")
      } else {
        const d = await res.json()
        setSubmitError(d.error ?? "Error al enviar.")
      }
    } catch {
      setSubmitError("Error de conexión. Inténtalo de nuevo.")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="gift" className="w-4 h-4 text-amber-400" strokeWidth={2} />
          <span className="text-xs font-black uppercase tracking-widest text-amber-400">Sistema de Bounties</span>
        </div>
        <button onClick={() => { setShowSubmit(v => !v); setSent(false) }}
          className="tap px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-700/40 text-amber-400 text-xs font-bold">
          + Reclamar
        </button>
      </div>

      {sent && (
        <div className="rounded-xl border border-emerald-700/40 bg-emerald-500/8 p-3.5 flex items-center gap-2">
          <Icon name="check" className="w-4 h-4 text-emerald-400 shrink-0" strokeWidth={2.5} />
          <p className="text-xs font-bold text-emerald-300">Reclamación enviada. La revisaremos en 24–48h.</p>
        </div>
      )}

      <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-3.5 space-y-1.5">
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">¿Cómo funciona?</p>
        {[
          "1. Genera la imagen de tu apuesta ganadora",
          "2. Publícala en Twitter/X con #SportsPicks",
          "3. Pega la URL del tweet aquí",
          "4. Si la cuota era > 3.00 y ganó → cobras el bounty",
        ].map((s) => <p key={s} className="text-[11px] text-zinc-500">{s}</p>)}
      </div>

      {showSubmit && (
        <div className="rounded-xl border border-amber-700/40 bg-amber-500/5 p-4 space-y-3">
          <p className="text-xs font-black text-amber-300">Reclamar bounty</p>
          <p className="text-[10px] text-zinc-500">Cuota mínima requerida: <span className="text-amber-400 font-bold">@3.00</span></p>
          <input value={twitterUrl} onChange={(e) => setTwitterUrl(e.target.value)}
            placeholder="https://x.com/tu_tweet..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-600" />
          {submitError && <p className="text-xs text-rose-400">{submitError}</p>}
          <button onClick={handleClaim} disabled={sending || !twitterUrl.trim()}
            className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-30 text-white font-bold text-sm tap transition-all flex items-center justify-center gap-2">
            {sending && <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
            {sending ? "Enviando..." : "Enviar reclamación"}
          </button>
        </div>
      )}

      {bounties.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <Icon name="gift" className="w-10 h-10 text-zinc-700 mb-3" strokeWidth={1.5} />
          <p className="text-sm font-black text-zinc-400">Sin bounties aún</p>
          <p className="text-[11px] text-zinc-600 mt-1">Genera una imagen, publícala y reclama tu recompensa.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {bounties.map((b: any) => {
            const s = BOUNTY_STATUS[b.status as keyof typeof BOUNTY_STATUS]
            return (
              <div key={b.id} className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-bold text-white truncate flex-1">{b.bet_title}</p>
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-md border shrink-0 ${s.cls}`}>{s.label}</span>
                </div>
                {b.payout && <p className="text-sm font-black text-emerald-400 mt-1.5">+{b.payout.toFixed(2)}€ recibido</p>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────
type Tab = "generator" | "bounties"

function CreatorsDashboard() {
  const [tab, setTab] = useState<Tab>("generator")

  return (
    <div className="safe-x">
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="section-label">Área VIP</span>
          <span className="text-[10px] font-black bg-violet-500/15 border border-violet-700/50 text-violet-400 px-2 py-0.5 rounded-full">TIPSTER</span>
        </div>
        <h1 className="text-xl font-black text-white">Hub de Creadores</h1>
      </div>

      <div className="px-4 mb-5">
        <div className="flex gap-1 p-1 rounded-xl bg-zinc-900 border border-zinc-800">
          {([["generator", "image", "Generador imagen"], ["bounties", "gift", "Mis bounties"]] as const).map(([id, icon, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold tap transition-all ${tab === id ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-400"}`}>
              <Icon name={icon} className="w-3.5 h-3.5" strokeWidth={2} />{label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pb-10">
        {tab === "generator" ? <ImageGenerator /> : <BountyDashboard />}
      </div>
    </div>
  )
}

const VIP_KEY = "sp_vip_unlocked"

// ── Page ──────────────────────────────────────────────────────
export default function CreatorsPage() {
  const { status } = useSession()
  const [unlocked, setUnlocked] = useState(() => {
    if (typeof window === "undefined") return false
    return localStorage.getItem(VIP_KEY) === "1"
  })

  function handleUnlock() {
    localStorage.setItem(VIP_KEY, "1")
    setUnlocked(true)
  }

  if (status === "loading") {
    return <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 rounded-full border-2 border-violet-500/40 border-t-violet-500 animate-spin" />
    </div>
  }

  return unlocked ? <CreatorsDashboard /> : <VipCodeGate onUnlock={handleUnlock} />
}

