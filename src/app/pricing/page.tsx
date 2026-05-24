"use client"

import { useState } from "react"
import Link from "next/link"
import { PLANS, PLAN_ORDER, type PlanId } from "@/lib/plans"
import { usePlan } from "@/lib/plan"
import { Icon } from "@/components/ui/icons"

const STRIPE_ENABLED = Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)

// Tabla de comparativa
const TABLE_ROWS = [
  { label: "Value picks diarios",        free: "2–3",        premium: "Todos",       pro: "Todos" },
  { label: "Análisis completo del pick", free: false,        premium: true,          pro: true },
  { label: "Combinada Segura",           free: true,         premium: true,          pro: true },
  { label: "Combinada Balanceada",       free: true,         premium: true,          pro: true },
  { label: "Combinada Soñadora",         free: false,        premium: true,          pro: true },
  { label: "Combinada IA por prompt",    free: false,        premium: true,          pro: true },
  { label: "Combinadas al día",          free: "2",          premium: "Ilimitadas",  pro: "Ilimitadas" },
  { label: "Bot IA",                     free: "3/día",      premium: "15/día",      pro: "Sin límite" },
  { label: "Estadísticas avanzadas",     free: false,        premium: true,          pro: true },
  { label: "Búsquedas de equipos/día",   free: "2",          premium: "Ilimitadas",  pro: "Ilimitadas" },
  { label: "Retos comunitarios",         free: "Pago suelto",premium: "1/mes",       pro: "Todos" },
  { label: "Retos personalizados",       free: false,        premium: false,         pro: true },
  { label: "Alertas inteligentes",       free: false,        premium: true,          pro: true },
  { label: "Watchlist equipos/ligas",    free: false,        premium: false,         pro: true },
  { label: "Modo Trader",                free: false,        premium: false,         pro: true },
  { label: "Analista IA Personal",       free: false,        premium: false,         pro: true },
]

type Billing = "monthly" | "annual"

function monthlyPrice(plan: PlanId, billing: Billing): string {
  const p = PLANS[plan]
  if (p.priceMonthly === 0) return "0€"
  if (billing === "annual") return `${(p.priceAnnual / 12).toFixed(2)}€`
  return `${p.priceMonthly}€`
}

function annualSaving(plan: PlanId): number {
  const p = PLANS[plan]
  return Math.round(p.priceMonthly * 12 - p.priceAnnual)
}

export default function PricingPage() {
  const { plan, setPlan } = usePlan()
  const [billing, setBilling] = useState<Billing>("monthly")
  const [justSet, setJustSet] = useState<PlanId | null>(null)
  const [checkoutLoading, setCheckoutLoading] = useState<PlanId | null>(null)
  const [emailFor, setEmailFor] = useState<PlanId | null>(null)
  const [emailInput, setEmailInput] = useState("")
  const [showTable, setShowTable] = useState(false)

  // Read stored customer_id for portal redirect
  function storedCustomerId(): string | null {
    try {
      const raw = localStorage.getItem("sp_subscription")
      if (raw) return JSON.parse(raw)?.customerId ?? null
    } catch {}
    return null
  }

  async function openPortalForManage() {
    const cid = storedCustomerId()
    if (!cid) { window.location.href = "/account"; return }
    try {
      const res = await fetch("/api/checkout/portal", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: cid }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else window.location.href = "/account"
    } catch { window.location.href = "/account" }
  }

  async function choose(id: PlanId) {
    // Free plan: if paid, redirect to portal to cancel. If already free, nothing to do.
    if (id === "free") {
      if (plan !== "free") {
        await openPortalForManage()
      }
      return
    }

    // Same plan: redirect to portal to manage
    if (id === plan) {
      await openPortalForManage()
      return
    }

    // No Stripe configured (dev/local without keys): demo mode
    if (!STRIPE_ENABLED) {
      setPlan(id); setJustSet(id)
      setTimeout(() => setJustSet(null), 2400)
      window.scrollTo({ top: 0, behavior: "smooth" })
      return
    }

    // Go to Stripe checkout
    if (!emailInput.trim()) { setEmailFor(id); return }
    setCheckoutLoading(id)
    try {
      const res = await fetch("/api/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: id, email: emailInput.trim(), billing }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else alert("Error al crear sesión de pago: " + (data.error ?? "Error"))
    } catch (e: any) { alert("Error de red: " + e.message) }
    finally { setCheckoutLoading(null) }
  }

  return (
    <div className="px-4 py-8 max-w-5xl mx-auto safe-x">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="text-center mb-8">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-emerald-400 border border-emerald-800/60 bg-emerald-500/8 px-3 py-1 rounded-full mb-4">
          <Icon name="value" className="w-3.5 h-3.5" /> Planes y precios
        </span>
        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
          Elige tu nivel.<br />
          <span className="gradient-text">El motor es el mismo para todos.</span>
        </h1>
        <p className="text-sm text-zinc-500 mt-3 max-w-lg mx-auto leading-relaxed">
          Datos reales de ESPN, modelo Poisson, cero invención. El plan decide cuánto desbloqueas.
        </p>
      </div>

      {/* ── Billing toggle ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-3 mb-8">
        <button onClick={() => setBilling("monthly")}
          className={`text-sm font-bold transition-colors ${billing === "monthly" ? "text-white" : "text-zinc-500 hover:text-zinc-300"}`}>
          Mensual
        </button>
        <button role="switch" aria-checked={billing === "annual"}
          onClick={() => setBilling(b => b === "monthly" ? "annual" : "monthly")}
          className={`relative w-12 h-6 rounded-full transition-colors ${billing === "annual" ? "bg-emerald-500" : "bg-zinc-700"}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${billing === "annual" ? "left-[26px]" : "left-0.5"}`} />
        </button>
        <button onClick={() => setBilling("annual")}
          className={`text-sm font-bold transition-colors flex items-center gap-1.5 ${billing === "annual" ? "text-white" : "text-zinc-500 hover:text-zinc-300"}`}>
          Anual
          <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-700/50 px-1.5 py-0.5 rounded-full">
            −25%
          </span>
        </button>
      </div>

      {/* Demo notice */}
      {!STRIPE_ENABLED && (
        <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-amber-800/50 bg-amber-500/8 px-4 py-3 max-w-2xl mx-auto">
          <Icon name="shield" className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-200/90 leading-relaxed">
            <strong className="text-amber-300">Modo demo.</strong> Activa cualquier plan para explorar la experiencia completa. El pago con Stripe se conecta añadiendo las claves en .env.local.
          </p>
        </div>
      )}

      {/* Email modal */}
      {emailFor && STRIPE_ENABLED && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setEmailFor(null)}>
          <div onClick={e => e.stopPropagation()}
            className="w-full sm:w-[400px] bg-zinc-900 border border-zinc-700 rounded-t-3xl sm:rounded-2xl p-6 animate-slide-up sm:animate-scale-in safe-bottom">
            <h3 className="text-lg font-black text-white mb-1">¿A qué email enviamos el recibo?</h3>
            <p className="text-xs text-zinc-400 mb-4 leading-snug">Stripe lo usará para confirmar tu suscripción.</p>
            <input type="email" autoFocus value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && emailFor) { const id = emailFor; setEmailFor(null); choose(id) } }}
              placeholder="tu@email.com"
              className="w-full bg-zinc-800 border border-zinc-700 focus:border-emerald-600 rounded-xl px-4 py-3 text-sm text-white outline-none transition-colors mb-4" />
            <div className="flex gap-2">
              <button onClick={() => setEmailFor(null)}
                className="flex-1 py-3 rounded-xl bg-zinc-800 text-sm text-zinc-300 font-medium tap">Cancelar</button>
              <button onClick={() => { const id = emailFor; setEmailFor(null); choose(id!) }}
                disabled={!emailInput.includes("@")}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-zinc-950 font-bold text-sm tap disabled:opacity-40">
                Continuar al pago
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Plan cards ─────────────────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-3 items-end">

        {/* FREE */}
        <PlanCard
          planId="free" billing={billing} currentPlan={plan}
          justSet={justSet} checkoutLoading={checkoutLoading}
          onChoose={choose}
        />

        {/* PREMIUM — hero, elevated */}
        <div className="md:-translate-y-4">
          <PlanCard
            planId="premium" billing={billing} currentPlan={plan}
            justSet={justSet} checkoutLoading={checkoutLoading}
            onChoose={choose}
          />
        </div>

        {/* PRO */}
        <PlanCard
          planId="pro" billing={billing} currentPlan={plan}
          justSet={justSet} checkoutLoading={checkoutLoading}
          onChoose={choose}
        />
      </div>

      {/* ── Comparativa ────────────────────────────────────────────────────── */}
      <div className="mt-10 text-center">
        <button onClick={() => setShowTable(!showTable)}
          className="inline-flex items-center gap-2 text-sm font-bold text-zinc-400 hover:text-white transition-colors tap">
          <Icon name="arrowRight"
            className={`w-4 h-4 transition-transform ${showTable ? "rotate-90" : ""}`}
            strokeWidth={2.4} />
          {showTable ? "Ocultar" : "Ver"} comparativa completa
        </button>
      </div>

      {showTable && (
        <div className="mt-5 rounded-2xl border border-zinc-800 overflow-hidden animate-fade-in">
          <div className="grid grid-cols-4 text-[11px] font-bold uppercase tracking-wider border-b border-zinc-800">
            <div className="p-4 text-zinc-500">Función</div>
            <div className="p-4 border-l border-zinc-800 text-zinc-400 text-center">Free</div>
            <div className="p-4 border-l border-zinc-800 text-emerald-400 text-center">Premium ⭐</div>
            <div className="p-4 border-l border-zinc-800 text-violet-400 text-center">Pro 👑</div>
          </div>
          {TABLE_ROWS.map((row, i) => (
            <div key={row.label} className={`grid grid-cols-4 text-sm ${i % 2 === 0 ? "bg-zinc-900/40" : ""}`}>
              <div className="px-4 py-3 text-zinc-300 flex items-center">{row.label}</div>
              <TableCell val={row.free} />
              <TableCell val={row.premium} accent="emerald" />
              <TableCell val={row.pro} accent="violet" />
            </div>
          ))}
        </div>
      )}

      {/* ── Trust signals ──────────────────────────────────────────────────── */}
      <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: "shield",  t: "Datos reales",     d: "Cuotas DraftKings vía ESPN" },
          { icon: "stats",   t: "Modelo Poisson",   d: "Ajustado por rival y motivación" },
          { icon: "check",   t: "Cero invención",   d: "Sin estadísticas fabricadas" },
          { icon: "bell",    t: "Sin permanencia",  d: "Cancela cuando quieras" },
        ].map((x) => (
          <div key={x.t} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5 card-glow">
            <Icon name={x.icon} className="w-5 h-5 text-emerald-400 mb-2" />
            <p className="text-xs font-bold text-white">{x.t}</p>
            <p className="text-[11px] text-zinc-500 mt-0.5 leading-snug">{x.d}</p>
          </div>
        ))}
      </div>

      {/* ── FAQ ────────────────────────────────────────────────────────────── */}
      <div className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 text-center">
        <Icon name="shield" className="w-7 h-7 text-emerald-400 mx-auto mb-3" />
        <p className="text-base font-black text-white">¿Alguna duda?</p>
        <p className="text-sm text-zinc-400 mt-1 max-w-md mx-auto leading-relaxed">
          SportsPicks es una plataforma de análisis estadístico informativo. No es una casa de apuestas ni te aconsejamos qué apostar. Cancela en cualquier momento.
        </p>
        <Link href="/legal/contact"
          className="inline-flex items-center gap-1.5 mt-4 text-sm font-bold text-emerald-400 hover:text-emerald-300 transition-colors">
          Contactar <Icon name="arrowRight" className="w-4 h-4" strokeWidth={2.4} />
        </Link>
      </div>

      <p className="text-[11px] text-zinc-700 text-center mt-8 leading-relaxed">
        SportsPicks Analytics · análisis estadístico informativo · +18 · Juego responsable
      </p>
    </div>
  )
}

// ─── Tarjeta de plan ────────────────────────────────────────────────────────

type Billing = "monthly" | "annual"

function PlanCard({ planId, billing, currentPlan, justSet, checkoutLoading, onChoose }: {
  planId: PlanId; billing: Billing; currentPlan: PlanId
  justSet: PlanId | null; checkoutLoading: PlanId | null
  onChoose: (id: PlanId) => void
}) {
  const p = PLANS[planId]
  const isCurrent = currentPlan === planId
  const loading = checkoutLoading === planId
  const done = justSet === planId

  // For paid plans that are active, keep button enabled so user can open portal
  const isPaidCurrent = isCurrent && planId !== "free"

  const styles = {
    free: {
      wrapper: "border-zinc-800 bg-zinc-900",
      name: "text-zinc-400",
      price: "text-white",
      badge: "bg-zinc-800 text-zinc-400 border-zinc-700",
      btn: isCurrent ? "bg-zinc-800 text-zinc-500 cursor-default" : "bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700",
      check: "text-zinc-500",
    },
    premium: {
      wrapper: "border-emerald-700/60 bg-gradient-to-b from-emerald-500/8 to-zinc-900 shadow-[0_8px_60px_-16px_rgba(52,211,153,0.35)]",
      name: "text-emerald-400",
      price: "gradient-text",
      badge: "bg-gradient-to-r from-emerald-500 to-cyan-500 text-zinc-950",
      btn: isPaidCurrent ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700" : isCurrent ? "bg-zinc-800 text-zinc-500 cursor-default" : "bg-gradient-to-r from-emerald-500 to-cyan-500 hover:opacity-90 text-zinc-950",
      check: "text-emerald-400",
    },
    pro: {
      wrapper: "border-violet-700/50 bg-gradient-to-b from-violet-500/8 to-zinc-900 shadow-[0_8px_40px_-16px_rgba(167,139,250,0.25)]",
      name: "text-violet-400",
      price: "text-white",
      badge: "bg-violet-500 text-white",
      btn: isPaidCurrent ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700" : isCurrent ? "bg-zinc-800 text-zinc-500 cursor-default" : "bg-violet-500 hover:bg-violet-400 text-white",
      check: "text-violet-400",
    },
  }[planId]

  const monthly = monthlyPrice(planId, billing)
  const saving = p.priceMonthly > 0 ? annualSaving(planId) : 0

  return (
    <div className={`relative rounded-2xl border p-5 flex flex-col ${styles.wrapper}`}>

      {/* Badge */}
      {p.badge && (
        <span className={`absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-0.5 text-[10px] font-black uppercase tracking-wide border border-transparent ${styles.badge}`}>
          {p.badge}
        </span>
      )}

      {/* Plan name */}
      <div className="mb-3">
        <p className={`text-sm font-black uppercase tracking-widest ${styles.name}`}>
          {p.emoji} {p.name}
        </p>
        <p className="text-xs text-zinc-500 mt-0.5 leading-snug">{p.tagline}</p>
      </div>

      {/* Price */}
      <div className="mb-1">
        <div className="flex items-end gap-1">
          <span className={`text-4xl font-black leading-none ${styles.price}`}>{monthly}</span>
          {p.priceMonthly > 0 && (
            <span className="text-xs text-zinc-500 mb-1">/mes</span>
          )}
        </div>
        {p.priceMonthly > 0 && billing === "annual" && (
          <p className="text-[11px] text-emerald-400 font-bold mt-1">
            {p.priceAnnual}€/año · ahorras {saving}€
          </p>
        )}
        {(p.priceMonthly === 0 || billing === "monthly") && <div className="h-4" />}
      </div>

      {/* CTA */}
      <button onClick={() => onChoose(planId)} disabled={(isCurrent && planId === "free") || loading}
        className={`w-full py-3 rounded-xl text-sm font-bold tap transition-all inline-flex items-center justify-center gap-2 mb-5 ${styles.btn}`}>
        {loading ? (
          <><Icon name="settings" className="w-4 h-4 animate-spin" /> Redirigiendo…</>
        ) : isPaidCurrent ? (
          <><Icon name="settings" className="w-4 h-4" /> Gestionar suscripción</>
        ) : isCurrent ? "✓ Plan actual"
          : done ? "✓ Activado"
          : planId === "free" ? "Empezar gratis"
          : STRIPE_ENABLED ? `Suscribirse — ${monthly}/mes`
          : `Activar ${p.name}`}
      </button>

      {/* Perks */}
      <div className="border-t border-zinc-800/80 pt-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-3">
          {planId === "free" ? "Incluye" : planId === "premium" ? "Todo lo que desbloqueas" : "Todo Premium +"}
        </p>
        <ul className="space-y-2.5">
          {p.perks.map((perk) => (
            <li key={perk} className="flex items-start gap-2 text-sm text-zinc-300">
              <Icon name="check" className={`w-4 h-4 mt-0.5 shrink-0 ${styles.check}`} strokeWidth={2.5} />
              <span className="leading-snug">{perk}</span>
            </li>
          ))}
        </ul>

        {/* PRO exclusive block */}
        {p.proFeatures && p.proFeatures.length > 0 && (
          <div className="mt-4 rounded-xl border border-violet-800/50 bg-violet-500/5 p-3.5 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-violet-400 mb-2">Funciones exclusivas 👑</p>
            {p.proFeatures.map((f) => (
              <div key={f} className="flex items-start gap-2">
                <Icon name="spark" className="w-3.5 h-3.5 text-violet-400 shrink-0 mt-0.5" strokeWidth={2} />
                <span className="text-xs text-zinc-300 leading-snug">{f}</span>
              </div>
            ))}
          </div>
        )}

        {/* Free — lo que NO incluye */}
        {planId === "free" && (
          <div className="mt-3 pt-3 border-t border-zinc-800">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-700 mb-2">No incluye</p>
            <ul className="space-y-1.5">
              {["Análisis completo de picks", "Combinada Soñadora", "Combinada IA por prompt", "Estadísticas avanzadas", "Alertas de valor"].map((n) => (
                <li key={n} className="flex items-start gap-2 text-xs text-zinc-700">
                  <Icon name="close" className="w-3.5 h-3.5 mt-0.5 shrink-0" strokeWidth={2} />
                  <span className="line-through decoration-zinc-800">{n}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

function TableCell({ val, accent }: { val: string | boolean; accent?: "emerald" | "violet" }) {
  const color = accent === "emerald" ? "text-emerald-400" : accent === "violet" ? "text-violet-400" : "text-zinc-500"
  return (
    <div className={`px-4 py-3 border-l border-zinc-800 text-center flex items-center justify-center ${color}`}>
      {val === true
        ? <Icon name="check" className="w-4 h-4" strokeWidth={2.5} />
        : val === false
        ? <span className="text-zinc-800">—</span>
        : <span className="text-xs font-semibold">{val}</span>}
    </div>
  )
}
