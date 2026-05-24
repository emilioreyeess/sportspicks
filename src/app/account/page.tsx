"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { usePlan } from "@/lib/plan"
import { PLANS, PLAN_ORDER } from "@/lib/plans"
import { Icon } from "@/components/ui/icons"
import { PageHeader, Card, Badge } from "@/components/ui/primitives"
import { PremiumBadge } from "@/components/premium"

export default function AccountPage() {
  const { plan, setPlan, isPremium, isPro } = usePlan()
  const planDef = PLANS[plan]

  const [name, setName] = useState("")
  const [prefs, setPrefs] = useState({ valueAlerts: true, dailyDigest: false, product: true })
  const [picksTotal, setPicksTotal] = useState<number | null>(null)

  useEffect(() => {
    try {
      setName(localStorage.getItem("sp_name") ?? "")
      const p = localStorage.getItem("sp_prefs")
      if (p) setPrefs(JSON.parse(p))
    } catch {}

    fetch("/api/picks")
      .then(r => r.json())
      .then(d => setPicksTotal(d.total ?? null))
      .catch(() => {})
  }, [])

  function saveName(v: string) {
    setName(v)
    try { localStorage.setItem("sp_name", v) } catch {}
  }
  function toggle(key: keyof typeof prefs) {
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)
    try { localStorage.setItem("sp_prefs", JSON.stringify(next)) } catch {}
  }

  const initial = (name || "U").charAt(0).toUpperCase()
  const planColor = plan === "pro" ? "text-violet-400" : plan === "premium" ? "text-emerald-400" : "text-zinc-400"

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto safe-x space-y-5">
      <PageHeader icon="user" title="Mi cuenta" subtitle="Perfil, suscripción y preferencias" />

      {/* Profile + Plan hero */}
      <Card className="overflow-hidden">
        {/* Gradient header */}
        <div className={`h-20 relative ${
          isPro ? "bg-gradient-to-br from-violet-600/25 to-violet-900/10" :
          isPremium ? "bg-gradient-to-br from-emerald-600/20 to-cyan-900/10" :
          "bg-gradient-to-br from-zinc-800/60 to-zinc-900/40"
        }`}>
          <div className="absolute inset-0 opacity-30"
            style={{ backgroundImage: "radial-gradient(circle at 80% 50%, rgba(255,255,255,0.04) 0%, transparent 60%)" }} />
        </div>

        <div className="px-5 pb-5 -mt-8">
          <div className="flex items-end justify-between mb-4">
            <div className={`grid place-items-center w-16 h-16 rounded-2xl border-2 text-xl font-black shadow-lg ${
              isPro ? "bg-zinc-900 border-violet-700/60 text-violet-400" :
              isPremium ? "bg-zinc-900 border-emerald-700/60 text-emerald-400" :
              "bg-zinc-900 border-zinc-700 text-zinc-300"
            }`}>
              {initial}
            </div>
            <PremiumBadge plan={plan} />
          </div>

          <p className="text-lg font-black text-white">{name || "Usuario"}</p>
          <p className="text-xs text-zinc-500 mt-0.5">Perfil local · sin cuenta vinculada todavía</p>

          <label className="block mt-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Nombre para mostrar</span>
            <input
              value={name}
              onChange={(e) => saveName(e.target.value)}
              placeholder="Tu nombre"
              className="mt-1.5 w-full bg-zinc-800 border border-zinc-700 focus:border-emerald-600 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none transition-colors"
            />
          </label>
          <p className="text-[11px] text-zinc-600 mt-2">
            El registro con cuenta (email / SSO) se habilitará en producción.
          </p>
        </div>
      </Card>

      {/* Subscription */}
      <Card className="p-5">
        <SectionTitle icon="crown" title="Suscripción" />

        <div className={`rounded-xl border p-4 mb-4 ${
          isPremium ? "border-emerald-800/50 bg-emerald-500/5" : "border-zinc-800 bg-zinc-950/60"
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Plan actual</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xl font-black ${planColor}`}>{planDef.name}</span>
                {plan === "free" && (
                  <span className="text-[10px] text-zinc-600 font-medium">— Gratis</span>
                )}
              </div>
            </div>
            {isPremium ? (
              <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${
                isPro
                  ? "bg-violet-500/15 text-violet-300 border-violet-700/50"
                  : "bg-emerald-500/15 text-emerald-300 border-emerald-700/50"
              }`}>
                {planDef.priceMonthly}€/mes
              </span>
            ) : (
              <Link href="/pricing"
                className="flex items-center gap-1 text-xs font-bold text-emerald-400 tap">
                Mejorar <Icon name="arrowRight" className="w-3.5 h-3.5" strokeWidth={2.4} />
              </Link>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-2 leading-snug">{planDef.tagline}</p>
        </div>

        {/* Usage quick stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <UsageStat
            label="Picks hoy"
            value={picksTotal !== null ? (isPremium ? `${picksTotal}` : `3/${picksTotal}`) : "—"}
            color={isPremium ? "text-emerald-400" : "text-zinc-400"}
          />
          <UsageStat
            label="Bot IA"
            value={isPro ? "∞/día" : isPremium ? "15/día" : "3/día"}
            color={isPremium ? "text-emerald-400" : "text-zinc-400"}
          />
          <UsageStat
            label="Combinadas"
            value={isPremium ? "∞ modos" : "2/día"}
            color={isPremium ? "text-emerald-400" : "text-zinc-400"}
          />
        </div>

        {!isPremium && (
          <Link href="/pricing"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-zinc-950 font-bold text-sm tap mb-4">
            <Icon name="crown" className="w-4 h-4" strokeWidth={2.2} />
            Mejorar a Premium · desde 9.99€/mes
          </Link>
        )}

        <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-2">
          Cambiar de plan (demo)
        </p>
        <div className="grid grid-cols-3 gap-2">
          {PLAN_ORDER.map((id) => {
            const active = plan === id
            return (
              <button key={id} onClick={() => setPlan(id)}
                className={`py-2.5 rounded-xl text-xs font-bold tap transition-all border ${
                  active
                    ? id === "pro"
                      ? "bg-violet-500/15 border-violet-700 text-violet-400"
                      : id === "premium"
                        ? "bg-emerald-500/15 border-emerald-700 text-emerald-400"
                        : "bg-zinc-800 border-zinc-600 text-zinc-300"
                    : "bg-zinc-800/60 border-zinc-700 text-zinc-400 hover:text-white"
                }`}>
                {PLANS[id].name}
              </button>
            )
          })}
        </div>
        <p className="text-[11px] text-zinc-600 mt-2">
          Sin Stripe todavía: este selector simula el plan para que pruebes la experiencia premium.
        </p>
      </Card>

      {/* Notifications */}
      <Card className="p-5">
        <SectionTitle icon="bell" title="Notificaciones" />
        <div className="space-y-1">
          <ToggleRow label="Alertas de value picks" hint="Aviso cuando el modelo detecta valor real"
            on={prefs.valueAlerts} onChange={() => toggle("valueAlerts")} />
          <ToggleRow label="Resumen diario" hint="Un resumen de los picks del día"
            on={prefs.dailyDigest} onChange={() => toggle("dailyDigest")} />
          <ToggleRow label="Novedades del producto" hint="Nuevas funciones y mejoras"
            on={prefs.product} onChange={() => toggle("product")} />
        </div>
        <p className="text-[11px] text-zinc-600 mt-3">
          Las notificaciones push se activarán al instalar la app (PWA). Tus preferencias quedan guardadas.
        </p>
      </Card>

      {/* Privacy */}
      <Card className="p-5">
        <SectionTitle icon="shield" title="Privacidad y seguridad" />
        <div className="space-y-0.5">
          {[
            { label: "Términos de servicio", href: "/legal/terms" },
            { label: "Política de privacidad", href: "/legal/privacy" },
            { label: "Gestión de cookies", href: "/legal/cookies" },
            { label: "Tus derechos (GDPR)", href: "/legal/gdpr" },
            { label: "Juego responsable", href: "/legal/responsible-gaming" },
          ].map((l) => (
            <Link key={l.href} href={l.href}
              className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-zinc-800/60 transition-colors tap">
              <span className="text-sm text-zinc-300">{l.label}</span>
              <Icon name="arrowRight" className="w-4 h-4 text-zinc-600" strokeWidth={2} />
            </Link>
          ))}
        </div>
      </Card>

      <p className="text-[11px] text-zinc-700 text-center pb-2">
        SportsPicks Analytics · análisis estadístico informativo · +18
      </p>
    </div>
  )
}

function SectionTitle({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon name={icon} className="w-4.5 h-4.5 text-emerald-400" />
      <h2 className="text-sm font-black text-white uppercase tracking-wide">{title}</h2>
    </div>
  )
}

function ToggleRow({ label, hint, on, onChange }: {
  label: string; hint: string; on: boolean; onChange: () => void
}) {
  return (
    <button onClick={onChange}
      className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl hover:bg-zinc-800/50 transition-colors text-left tap">
      <div className="min-w-0">
        <p className="text-sm text-zinc-200 font-medium">{label}</p>
        <p className="text-[11px] text-zinc-500 leading-snug">{hint}</p>
      </div>
      <span className={`relative w-11 h-6 rounded-full shrink-0 transition-colors ${on ? "bg-emerald-500" : "bg-zinc-700"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all shadow-sm ${on ? "left-[22px]" : "left-0.5"}`} />
      </span>
    </button>
  )
}

function UsageStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 text-center">
      <p className={`text-sm font-black ${color}`}>{value}</p>
      <p className="text-[10px] text-zinc-600 mt-0.5">{label}</p>
    </div>
  )
}
