"use client"

import { useState } from "react"
import { Icon } from "@/components/ui/icons"
import { useSession } from "next-auth/react"

// ── VIP Code Gate ─────────────────────────────────────────────
function VipCodeGate({ onUnlock }: { onUnlock: () => void }) {
  const [code, setCode]     = useState("")
  const [error, setError]   = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    if (!code.trim()) return
    setLoading(true)
    setError("")
    // Logic wired in next phase
    await new Promise((r) => setTimeout(r, 800))
    if (code.toUpperCase() === "DEMO99") {
      onUnlock()
    } else {
      setError("Código inválido o expirado.")
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
        <input
          value={code}
          onChange={(e) => { setCode(e.target.value.toUpperCase()); setError("") }}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="Código VIP"
          maxLength={12}
          className="w-full text-center text-xl font-black tracking-[0.25em] bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-3.5 text-white placeholder:text-zinc-700 focus:outline-none focus:border-zinc-700 uppercase"
        />
        {error && <p className="text-xs text-rose-400 font-bold">{error}</p>}
        <button
          onClick={handleSubmit}
          disabled={loading || !code.trim()}
          className="w-full py-3.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-30 text-white font-bold text-sm tap transition-all"
        >
          {loading ? "Verificando..." : "Acceder"}
        </button>
      </div>

      <p className="text-[10px] text-zinc-700 mt-8 max-w-xs">
        ¿No tienes código? Contacta con el equipo de SportsPicks para solicitar acceso de tipster verificado.
      </p>
    </div>
  )
}

// ── Bet card for image generator ──────────────────────────────
interface BetPreview {
  title: string
  legs: { match: string; selection: string; odds: number }[]
  combinedOdds: number
  aiProb: number
  edge: number
}

const DEMO_BET: BetPreview = {
  title: "Combinada Premium",
  legs: [
    { match: "Real Madrid vs Barça", selection: "Over 2.5", odds: 1.72 },
    { match: "PSG vs Bayern", selection: "Ambos marcan", odds: 1.55 },
    { match: "Man City vs Arsenal", selection: "Local", odds: 1.60 },
  ],
  combinedOdds: 4.26,
  aiProb: 38.4,
  edge: 12.3,
}

function ImageGenerator() {
  const [bet] = useState<BetPreview>(DEMO_BET)
  const [generating, setGenerating] = useState(false)

  function handleGenerate() {
    setGenerating(true)
    setTimeout(() => setGenerating(false), 1500)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon name="image" className="w-4 h-4 text-violet-400" strokeWidth={2} />
        <span className="text-xs font-black uppercase tracking-widest text-violet-400">Generador de imagen</span>
      </div>

      {/* Preview card */}
      <div className="rounded-2xl border border-violet-700/50 bg-gradient-to-br from-violet-900/30 via-zinc-900 to-zinc-950 overflow-hidden">
        {/* Card header */}
        <div className="px-5 pt-5 pb-4 border-b border-violet-800/30">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-black text-zinc-400">⚡ SportsPicks Analytics</span>
            <span className="ml-auto text-[10px] font-black bg-violet-500/15 border border-violet-700/50 text-violet-400 px-2 py-0.5 rounded-full">
              TIPSTER VIP
            </span>
          </div>
          <h3 className="text-lg font-black text-white">{bet.title}</h3>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-2xl font-black text-emerald-400">@{bet.combinedOdds.toFixed(2)}</span>
            <div className="text-xs text-zinc-500">
              <p>Prob. IA: <span className="text-violet-400 font-bold">{bet.aiProb}%</span></p>
              <p>Edge: <span className="text-emerald-400 font-bold">+{bet.edge}%</span></p>
            </div>
          </div>
        </div>

        {/* Legs */}
        <div className="px-5 py-3 space-y-2.5">
          {bet.legs.map((leg, i) => (
            <div key={i} className="flex items-center justify-between gap-2 py-1.5 border-b border-zinc-800/50 last:border-0">
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">{leg.match}</p>
                <p className="text-[10px] text-zinc-500">{leg.selection}</p>
              </div>
              <span className="text-sm font-black text-emerald-400 shrink-0">@{leg.odds.toFixed(2)}</span>
            </div>
          ))}
        </div>

        {/* Disclaimer */}
        <div className="px-5 py-3 bg-zinc-900/60 border-t border-zinc-800/50">
          <p className="text-[9px] text-zinc-600 leading-relaxed">
            ⚠️ Apuesta con valor matemático detectado. No existen picks seguros, sujeto a varianza deportiva.
          </p>
        </div>
      </div>

      <button
        onClick={handleGenerate}
        disabled={generating}
        className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold text-sm tap transition-all flex items-center justify-center gap-2"
      >
        <Icon name="download" className="w-4 h-4" strokeWidth={2.2} />
        {generating ? "Generando imagen..." : "Descargar imagen para Twitter/X"}
      </button>
      <p className="text-[10px] text-zinc-700 text-center">La generación real de imagen se activa en la siguiente fase.</p>
    </div>
  )
}

// ── Bounty dashboard ─────────────────────────────────────────
const DEMO_BOUNTIES = [
  { id: "1", bet_title: "Combinada 3 legs @4.26", twitter_url: "https://x.com/...", status: "pending",  payout: null,  submitted_at: "Hace 2h" },
  { id: "2", bet_title: "Over 2.5 UCL @1.80",     twitter_url: "https://x.com/...", status: "approved", payout: 15.00, submitted_at: "Hace 1d" },
  { id: "3", bet_title: "Real Madrid Local @1.40", twitter_url: "https://x.com/...", status: "rejected", payout: null,  submitted_at: "Hace 3d" },
]

const BOUNTY_STATUS = {
  pending:  { label: "Pendiente", cls: "text-amber-400 bg-amber-500/10 border-amber-700/40" },
  approved: { label: "Aprobado",  cls: "text-emerald-400 bg-emerald-500/10 border-emerald-700/40" },
  rejected: { label: "Rechazado", cls: "text-rose-400 bg-rose-500/10 border-rose-700/40" },
} as const

function BountyDashboard() {
  const [showSubmit, setShowSubmit] = useState(false)
  const [twitterUrl, setTwitterUrl] = useState("")

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="gift" className="w-4 h-4 text-amber-400" strokeWidth={2} />
          <span className="text-xs font-black uppercase tracking-widest text-amber-400">Sistema de Bounties</span>
        </div>
        <button onClick={() => setShowSubmit(!showSubmit)}
          className="tap px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-700/40 text-amber-400 text-xs font-bold">
          + Reclamar
        </button>
      </div>

      {/* How it works */}
      <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-3.5 space-y-1.5">
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">¿Cómo funciona?</p>
        {[
          "1. Genera la imagen de tu apuesta ganadora",
          "2. Publícala en Twitter/X con el hashtag #SportsPicks",
          "3. Pega la URL del tweet aquí",
          "4. Si la cuota era > 1.50 y ganó, recibes el bounty",
        ].map((s) => (
          <p key={s} className="text-[11px] text-zinc-500">{s}</p>
        ))}
      </div>

      {/* Submit form */}
      {showSubmit && (
        <div className="rounded-xl border border-amber-700/40 bg-amber-500/5 p-4 space-y-3">
          <p className="text-xs font-black text-amber-300">Reclamar bounty</p>
          <input
            value={twitterUrl}
            onChange={(e) => setTwitterUrl(e.target.value)}
            placeholder="https://x.com/tu_tweet..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700"
          />
          <button
            disabled={!twitterUrl.trim()}
            className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-30 text-white font-bold text-sm tap"
          >
            Enviar reclamación
          </button>
        </div>
      )}

      {/* Bounty list */}
      <div className="space-y-2">
        {DEMO_BOUNTIES.map((b) => {
          const s = BOUNTY_STATUS[b.status as keyof typeof BOUNTY_STATUS]
          return (
            <div key={b.id} className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">{b.bet_title}</p>
                  <p className="text-[10px] text-zinc-600 mt-0.5">{b.submitted_at}</p>
                </div>
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-md border shrink-0 ${s.cls}`}>
                  {s.label}
                </span>
              </div>
              {b.payout && (
                <p className="text-sm font-black text-emerald-400 mt-1.5">+{b.payout.toFixed(2)}€ recibido</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Dashboard tabs ────────────────────────────────────────────
type Tab = "generator" | "bounties"

function CreatorsDashboard() {
  const [tab, setTab] = useState<Tab>("generator")

  return (
    <div className="safe-x">
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="section-label">Área VIP</span>
          <span className="text-[10px] font-black bg-violet-500/15 border border-violet-700/50 text-violet-400 px-2 py-0.5 rounded-full">
            TIPSTER
          </span>
        </div>
        <h1 className="text-xl font-black text-white">Hub de Creadores</h1>
      </div>

      {/* Stats row */}
      <div className="px-4 mb-5">
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Bounties",  value: "2",    color: "text-amber-400" },
            { label: "Ganados",   value: "1",    color: "text-emerald-400" },
            { label: "Pagado",    value: "15€",  color: "text-emerald-400" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-3 text-center">
              <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tab switcher */}
      <div className="px-4 mb-5">
        <div className="flex gap-1 p-1 rounded-xl bg-zinc-900 border border-zinc-800">
          {([["generator", "image", "Generador imagen"], ["bounties", "gift", "Mis bounties"]] as const).map(([id, icon, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold tap transition-all ${tab === id ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-400"}`}>
              <Icon name={icon} className="w-3.5 h-3.5" strokeWidth={2} />
              {label}
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

// ── Page ──────────────────────────────────────────────────────
export default function CreatorsPage() {
  const { status } = useSession()
  const [unlocked, setUnlocked] = useState(false)

  if (status === "loading") {
    return <div className="flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 rounded-full border-2 border-violet-500/40 border-t-violet-500 animate-spin" /></div>
  }

  return unlocked ? <CreatorsDashboard /> : <VipCodeGate onUnlock={() => setUnlocked(true)} />
}
