"use client"

import { useState } from "react"
import Link from "next/link"
import { PLANS, PLAN_ORDER, type PlanId } from "@/lib/plans"
import { usePlan } from "@/lib/plan"
import { Icon } from "@/components/ui/icons"
import { Badge } from "@/components/ui/primitives"

/** True si Stripe está configurado (la clave pública existe en el bundle) */
const STRIPE_ENABLED = Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)

const ACCENT: Record<string, {
  text: string; ring: string; bg: string; btn: string; glow: string; badge: string
}> = {
  zinc: {
    text: "text-zinc-300",
    ring: "border-zinc-800",
    bg: "from-zinc-900/0",
    btn: "bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700",
    glow: "",
    badge: "bg-zinc-800 text-zinc-400 border-zinc-700",
  },
  emerald: {
    text: "text-emerald-400",
    ring: "border-emerald-700/60",
    bg: "from-emerald-500/8 to-cyan-500/4",
    btn: "bg-gradient-to-r from-emerald-500 to-cyan-500 hover:opacity-90 text-zinc-950",
    glow: "shadow-[0_8px_60px_-16px_rgba(52,211,153,0.35)]",
    badge: "bg-gradient-to-r from-emerald-500 to-cyan-500 text-zinc-950",
  },
  violet: {
    text: "text-violet-400",
    ring: "border-violet-700/60",
    bg: "from-violet-500/8 to-violet-900/4",
    btn: "bg-violet-500 hover:bg-violet-400 text-white",
    glow: "shadow-[0_8px_60px_-16px_rgba(167,139,250,0.3)]",
    badge: "bg-violet-500 text-white",
  },
}

const FEATURES_TABLE = [
  { label: "Value picks del día",     free: "1 pick",         premium: "Todos",          pro: "Todos" },
  { label: "Análisis completo pick",  free: false,            premium: true,             pro: true },
  { label: "Combinadas",             free: "Solo segura",    premium: "3 modos",        pro: "3 modos" },
  { label: "Bot IA",                 free: "3/día",          premium: "Ilimitado",      pro: "Ilimitado" },
  { label: "Estadísticas avanzadas", free: false,            premium: true,             pro: true },
  { label: "Centro de alertas",      free: false,            premium: true,             pro: true },
  { label: "Todos los retos",        free: false,            premium: true,             pro: true },
  { label: "Acceso API",             free: false,            premium: false,            pro: true },
  { label: "Exportar CSV",           free: false,            premium: false,            pro: true },
  { label: "Webhooks",               free: false,            premium: false,            pro: true },
  { label: "Soporte prioritario",    free: false,            premium: false,            pro: true },
]

const TRUST = [
  { icon: "shield",  t: "Datos reales",          d: "Cuotas DraftKings vía ESPN" },
  { icon: "stats",   t: "Modelo Poisson",         d: "Ajustado por rival y motivación" },
  { icon: "check",   t: "Cero invención",         d: "Sin estadísticas fabricadas" },
  { icon: "bell",    t: "Sin permanencia",        d: "Cancela cuando quieras" },
]

type BillingCycle = "monthly" | "annual"

function annualPrice(monthly: number) {
  return (monthly * 12 * 0.80).toFixed(0)
}

export default function PricingPage() {
  const { plan, setPlan } = usePlan()
  const [billing, setBilling] = useState<BillingCycle>("monthly")
  const [justSet, setJustSet] = useState<PlanId | null>(null)
  const [showTable, setShowTable] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState<PlanId | null>(null)
  const [emailInput, setEmailInput] = useState("")
  const [emailFor, setEmailFor] = useState<PlanId | null>(null)

  async function choose(id: PlanId) {
    // Free: cambiar directo sin Stripe
    if (id === "free") {
      setPlan("free")
      setJustSet("free")
      setTimeout(() => setJustSet(null), 2400)
      return
    }

    // Si Stripe no está configurado → modo demo (simula activación)
    if (!STRIPE_ENABLED) {
      setPlan(id)
      setJustSet(id)
      setTimeout(() => setJustSet(null), 2400)
      window.scrollTo({ top: 0, behavior: "smooth" })
      return
    }

    // Con Stripe: pedir email si no lo tiene
    if (!emailInput.trim()) {
      setEmailFor(id)
      return
    }

    setCheckoutLoading(id)
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: id, email: emailInput.trim() }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        alert("Error al crear sesión de pago: " + (data.error ?? "Error desconocido"))
      }
    } catch (e: any) {
      alert("Error de red: " + e.message)
    } finally {
      setCheckoutLoading(null)
    }
  }

  function displayPrice(p: typeof PLANS[PlanId]) {
    if (p.price === 0) return "0€"
    return billing === "annual"
      ? `${(p.price * 0.80).toFixed(2)}€`
      : `${p.price}€`
  }

  return (
    <div className="px-4 py-8 max-w-5xl mx-auto safe-x">

      {/* Hero */}
      <div className="text-center mb-8">
        <Badge tone="emerald" className="mb-4">Planes y precios</Badge>
        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
          El motor cuantitativo,<br />
          <span className="gradient-text">a tu nivel</span>
        </h1>
        <p className="text-sm text-zinc-500 mt-3 max-w-md mx-auto leading-relaxed">
          Todos los planes usan los mismos datos reales y el mismo modelo Poisson.
          El plan decide cuánto desbloqueas.
        </p>
      </div>

      {/* Billing toggle */}
      <div className="flex items-center justify-center gap-3 mb-8">
        <button
          onClick={() => setBilling("monthly")}
          className={`text-sm font-bold transition-colors ${billing === "monthly" ? "text-white" : "text-zinc-500 hover:text-zinc-300"}`}
        >
          Mensual
        </button>
        <button
          role="switch"
          aria-checked={billing === "annual"}
          onClick={() => setBilling(b => b === "monthly" ? "annual" : "monthly")}
          className={`relative w-12 h-6 rounded-full transition-colors ${billing === "annual" ? "bg-emerald-500" : "bg-zinc-700"}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all shadow-sm ${billing === "annual" ? "left-[26px]" : "left-0.5"}`} />
        </button>
        <button
          onClick={() => setBilling("annual")}
          className={`text-sm font-bold transition-colors flex items-center gap-1.5 ${billing === "annual" ? "text-white" : "text-zinc-500 hover:text-zinc-300"}`}
        >
          Anual
          <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-700/50 px-1.5 py-0.5 rounded-full">
            −20%
          </span>
        </button>
      </div>

      {/* Demo / Live notice */}
      {!STRIPE_ENABLED && (
        <div className="mb-7 flex items-start gap-2.5 rounded-xl border border-amber-800/50 bg-amber-500/8 px-4 py-3 max-w-2xl mx-auto">
          <Icon name="shield" className="w-4.5 h-4.5 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-200/90 leading-relaxed">
            <strong className="text-amber-300">Modo demo.</strong> El pago con Stripe se conecta añadiendo las claves en .env.local.
            Por ahora puedes activar cualquier plan para probar la experiencia completa.
          </p>
        </div>
      )}

      {/* Email modal (when Stripe is active and user clicks paid plan) */}
      {emailFor && STRIPE_ENABLED && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setEmailFor(null)}>
          <div onClick={e => e.stopPropagation()}
            className="w-full sm:w-[400px] bg-zinc-900 border border-zinc-700 rounded-t-3xl sm:rounded-2xl p-6 animate-slide-up sm:animate-scale-in safe-bottom">
            <h3 className="text-lg font-black text-white mb-1">¿A qué email enviamos el recibo?</h3>
            <p className="text-xs text-zinc-400 mb-4 leading-snug">
              Lo usará Stripe para enviarte la confirmación y gestionar tu suscripción.
            </p>
            <input
              type="email"
              autoFocus
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && emailFor) { setEmailFor(null); choose(emailFor) }}}
              placeholder="tu@email.com"
              className="w-full bg-zinc-800 border border-zinc-700 focus:border-emerald-600 rounded-xl px-4 py-3 text-sm text-white outline-none transition-colors mb-4"
            />
            <div className="flex gap-2">
              <button onClick={() => setEmailFor(null)}
                className="flex-1 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sm text-zinc-300 font-medium tap transition-colors">
                Cancelar
              </button>
              <button
                onClick={() => { const id = emailFor; setEmailFor(null); choose(id!) }}
                disabled={!emailInput.includes("@")}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-zinc-950 font-bold text-sm tap disabled:opacity-40">
                Continuar al pago
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plan cards */}
      <div className="grid gap-5 md:grid-cols-3 items-end">
        {PLAN_ORDER.map((id) => {
          const p = PLANS[id]
          const a = ACCENT[p.accent]
          const current = plan === id

          return (
            <div key={id}
              className={`relative rounded-2xl border bg-gradient-to-b bg-zinc-900 p-5 flex flex-col transition-all ${a.bg} ${
                p.highlighted
                  ? `${a.ring} md:-translate-y-3 ${a.glow}`
                  : "border-zinc-800"
              }`}>

              {/* Badge */}
              {p.badge && (
                <span className={`absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-0.5 text-[10px] font-black uppercase tracking-wide ${a.badge}`}>
                  {p.badge}
                </span>
              )}

              {/* Plan name & tagline */}
              <div className="mb-4">
                <p className={`text-sm font-black uppercase tracking-widest ${a.text}`}>{p.name}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{p.tagline}</p>
              </div>

              {/* Price */}
              <div className="flex items-end gap-1 mb-1">
                <span className="text-4xl font-black text-white leading-none">{displayPrice(p)}</span>
                {p.price > 0 && (
                  <span className="text-xs text-zinc-500 mb-1">{billing === "annual" ? "/mes · facturado anual" : "/mes"}</span>
                )}
              </div>
              {p.price > 0 && billing === "annual" && (
                <p className="text-[11px] text-emerald-400 font-bold mb-4">
                  {annualPrice(p.price)}€/año · ahorras {Math.round(p.price * 12 * 0.20)}€
                </p>
              )}
              {(p.price === 0 || billing === "monthly") && <div className="mb-4" />}

              {/* CTA button */}
              <button
                onClick={() => choose(id)}
                disabled={current || checkoutLoading === id}
                className={`w-full py-3 rounded-xl text-sm font-bold tap transition-all inline-flex items-center justify-center gap-2 ${
                  current ? "bg-zinc-800 text-zinc-500 cursor-default" : a.btn
                }`}
              >
                {checkoutLoading === id ? (
                  <><Icon name="settings" className="w-4 h-4 animate-spin" /> Redirigiendo…</>
                ) : current ? "✓ Plan actual"
                  : justSet === id ? "✓ Activado"
                  : id === "free" ? "Empezar gratis"
                  : STRIPE_ENABLED ? `Suscribirse — ${displayPrice(p)}${p.period}`
                  : `Activar ${p.name}`
                }
              </button>

              {/* Divider */}
              <div className="mt-5 pt-4 border-t border-zinc-800/80">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-3">Incluye</p>
                <ul className="space-y-2.5">
                  {p.perks.map((perk) => (
                    <li key={perk} className="flex items-start gap-2 text-sm text-zinc-300">
                      <Icon name="check" className={`w-4 h-4 mt-0.5 shrink-0 ${a.text}`} strokeWidth={2.5} />
                      <span className="leading-snug">{perk}</span>
                    </li>
                  ))}
                  {p.notIncluded.map((n) => (
                    <li key={n} className="flex items-start gap-2 text-sm text-zinc-600">
                      <Icon name="close" className="w-4 h-4 mt-0.5 shrink-0" strokeWidth={2} />
                      <span className="leading-snug line-through decoration-zinc-700">{n}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )
        })}
      </div>

      {/* Feature comparison table toggle */}
      <div className="mt-10 text-center">
        <button
          onClick={() => setShowTable(!showTable)}
          className="inline-flex items-center gap-2 text-sm font-bold text-zinc-400 hover:text-white transition-colors tap"
        >
          <Icon name={showTable ? "arrowRight" : "arrowRight"} className={`w-4 h-4 transition-transform ${showTable ? "rotate-90" : "rotate-0"}`} strokeWidth={2.4} />
          {showTable ? "Ocultar" : "Ver"} comparativa completa
        </button>
      </div>

      {/* Comparison table */}
      {showTable && (
        <div className="mt-6 rounded-2xl border border-zinc-800 overflow-hidden animate-fade-in">
          <div className="grid grid-cols-4 text-[11px] font-bold uppercase tracking-wider">
            <div className="p-4 border-b border-zinc-800 text-zinc-500">Función</div>
            <div className="p-4 border-b border-l border-zinc-800 text-zinc-400 text-center">Free</div>
            <div className="p-4 border-b border-l border-zinc-800 text-emerald-400 text-center">Premium</div>
            <div className="p-4 border-b border-l border-zinc-800 text-violet-400 text-center">Pro</div>
          </div>
          {FEATURES_TABLE.map((f, i) => (
            <div key={f.label} className={`grid grid-cols-4 text-sm ${i % 2 === 0 ? "bg-zinc-900/40" : ""}`}>
              <div className="px-4 py-3 text-zinc-300 flex items-center">{f.label}</div>
              <TableCell val={f.free} />
              <TableCell val={f.premium} accent="emerald" />
              <TableCell val={f.pro} accent="violet" />
            </div>
          ))}
        </div>
      )}

      {/* Trust badges */}
      <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {TRUST.map((x) => (
          <div key={x.t} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5 card-glow">
            <Icon name={x.icon} className="w-5 h-5 text-emerald-400 mb-2" />
            <p className="text-xs font-bold text-white">{x.t}</p>
            <p className="text-[11px] text-zinc-500 mt-0.5 leading-snug">{x.d}</p>
          </div>
        ))}
      </div>

      {/* FAQ teaser */}
      <div className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 text-center">
        <Icon name="shield" className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
        <p className="text-base font-black text-white">¿Alguna duda?</p>
        <p className="text-sm text-zinc-400 mt-1 max-w-sm mx-auto leading-relaxed">
          SportsPicks es una plataforma de análisis estadístico informativo. No es una casa de apuestas.
          Cancela en cualquier momento sin compromiso.
        </p>
        <Link href="/legal/contact"
          className="inline-flex items-center gap-1.5 mt-4 text-sm font-bold text-emerald-400 hover:text-emerald-300 transition-colors">
          Contactar <Icon name="arrowRight" className="w-4 h-4" strokeWidth={2.4} />
        </Link>
      </div>

      <p className="text-[11px] text-zinc-700 text-center mt-8 max-w-xl mx-auto leading-relaxed">
        SportsPicks Analytics · análisis estadístico informativo · +18 · Juego responsable
      </p>
    </div>
  )
}

function TableCell({ val, accent }: { val: string | boolean; accent?: "emerald" | "violet" }) {
  const color = accent === "emerald" ? "text-emerald-400" : accent === "violet" ? "text-violet-400" : "text-zinc-400"
  return (
    <div className={`px-4 py-3 border-l border-zinc-800 text-center flex items-center justify-center ${color}`}>
      {val === true ? (
        <Icon name="check" className="w-4 h-4" strokeWidth={2.5} />
      ) : val === false ? (
        <span className="text-zinc-700">—</span>
      ) : (
        <span className="text-xs font-semibold">{val}</span>
      )}
    </div>
  )
}
