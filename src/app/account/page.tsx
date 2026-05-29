"use client"

import Link from "next/link"
import { useEffect, useState, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { usePlan } from "@/lib/plan"
import { PLANS } from "@/lib/plans"
import { Icon } from "@/components/ui/icons"
import { PageHeader, Card } from "@/components/ui/primitives"
import { PremiumBadge } from "@/components/premium"

interface StoredSub {
  plan: string
  customerId: string | null
  email: string | null
  activatedAt: string
}

function readStoredSub(): StoredSub | null {
  try {
    const raw = localStorage.getItem("sp_subscription")
    if (raw) return JSON.parse(raw)
  } catch {}
  return null
}

function clearStoredSub() {
  try {
    localStorage.removeItem("sp_subscription")
    localStorage.setItem("sp_plan", "free")
  } catch {}
}

export default function AccountPage() {
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const { plan, setPlan, isPremium, isPro } = usePlan()
  const planDef = PLANS[plan]

  const [name, setName] = useState("")
  const [nameSaving, setNameSaving] = useState(false)
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [prefs, setPrefs] = useState({ valueAlerts: true, dailyDigest: false, product: true })
  const [picksTotal, setPicksTotal] = useState<number | null>(null)
  const [sub, setSub] = useState<StoredSub | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  const [profileId, setProfileId] = useState<number | null>(null)
  const [profileLinkCopied, setProfileLinkCopied] = useState(false)

  // Change password
  const [showPwdForm, setShowPwdForm] = useState(false)
  const [currentPwd, setCurrentPwd] = useState("")
  const [newPwd, setNewPwd] = useState("")
  const [confirmPwd, setConfirmPwd] = useState("")
  const [pwdSaving, setPwdSaving] = useState(false)
  const [pwdMsg, setPwdMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const [portalLoading, setPortalLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [verifyMsg, setVerifyMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [cancelPending, setCancelPending] = useState(false)

  useEffect(() => {
    try {
      const p = localStorage.getItem("sp_prefs")
      if (p) setPrefs(JSON.parse(p))
      setSub(readStoredSub())
    } catch {}

    // Load name from DB (source of truth)
    fetch("/api/account/profile")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.name) {
          setName(d.name)
          try { localStorage.setItem("sp_name", d.name) } catch {}
        } else {
          // Fallback to localStorage
          try { setName(localStorage.getItem("sp_name") ?? "") } catch {}
        }
        if (d?.id) setProfileId(d.id)
      })
      .catch(() => {
        try { setName(localStorage.getItem("sp_name") ?? "") } catch {}
      })

    fetch("/api/picks")
      .then(r => r.json())
      .then(d => setPicksTotal(d.total ?? null))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (searchParams.get("from") === "portal") {
      const stored = readStoredSub()
      if (stored?.customerId) verifySubscription(stored.customerId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function saveName(v: string) {
    setName(v)
    try { localStorage.setItem("sp_name", v) } catch {}
  }

  async function persistName() {
    if (!name.trim()) return
    setNameSaving(true); setNameMsg(null)
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      })
      const d = await res.json()
      if (res.ok) {
        setNameMsg({ ok: true, text: "Nombre guardado correctamente." })
        try { localStorage.setItem("sp_name", name.trim()) } catch {}
      } else {
        setNameMsg({ ok: false, text: d.error ?? "Error al guardar" })
      }
    } catch {
      setNameMsg({ ok: false, text: "Error de conexión" })
    } finally { setNameSaving(false) }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwdMsg(null)
    if (newPwd !== confirmPwd) { setPwdMsg({ ok: false, text: "Las contraseñas no coinciden." }); return }
    if (newPwd.length < 8) { setPwdMsg({ ok: false, text: "La nueva contraseña debe tener al menos 8 caracteres." }); return }
    setPwdSaving(true)
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd }),
      })
      const d = await res.json()
      if (res.ok) {
        setPwdMsg({ ok: true, text: "Contraseña actualizada correctamente." })
        setCurrentPwd(""); setNewPwd(""); setConfirmPwd("")
        setShowPwdForm(false)
      } else {
        setPwdMsg({ ok: false, text: d.error ?? "Error al cambiar la contraseña" })
      }
    } catch {
      setPwdMsg({ ok: false, text: "Error de conexión" })
    } finally { setPwdSaving(false) }
  }

  function toggle(key: keyof typeof prefs) {
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)
    try { localStorage.setItem("sp_prefs", JSON.stringify(next)) } catch {}
  }

  const openPortal = useCallback(async () => {
    const customerId = sub?.customerId
    if (!customerId) return
    setPortalLoading(true)
    try {
      const res = await fetch("/api/checkout/portal", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: customerId }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else alert("No se pudo abrir el portal: " + (data.error ?? "Error"))
    } catch (e: any) {
      alert("Error de red: " + e.message)
    } finally {
      setPortalLoading(false)
    }
  }, [sub])

  const verifySubscription = useCallback(async (customerId?: string) => {
    const cid = customerId ?? sub?.customerId
    if (!cid) {
      setVerifyMsg({ ok: false, text: "No hay suscripción guardada. Completa el pago primero." })
      return
    }
    setVerifying(true); setVerifyMsg(null)
    try {
      const res = await fetch(`/api/checkout/status?customer_id=${cid}`)
      const data = await res.json()
      if (data.error) { setVerifyMsg({ ok: false, text: "Error al verificar: " + data.error }); return }
      const activePlan = data.plan as string
      setPlan(activePlan as any)
      setSub((prev) => prev ? { ...prev, plan: activePlan } : prev)
      try { localStorage.setItem("sp_plan", activePlan) } catch {}

      const periodEnd = data.period_end
        ? new Date(data.period_end * 1000).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })
        : null

      if (activePlan === "free" && !data.period_end) {
        clearStoredSub(); setSub(null)
        setVerifyMsg({ ok: false, text: "Tu suscripción ha expirado. Plan revertido a Free." })
        setCancelPending(false)
      } else if (data.cancel_at_period_end || !data.active) {
        setVerifyMsg({ ok: true, text: `Plan ${activePlan} activo hasta el ${periodEnd ?? "fin del período"}. Después pasará a Free.` })
        setCancelPending(true)
      } else {
        setVerifyMsg({ ok: true, text: `Plan ${activePlan} activo${periodEnd ? ` · próxima renovación el ${periodEnd}` : ""}.` })
        setCancelPending(false)
      }
    } catch {
      setVerifyMsg({ ok: false, text: "Error de red al verificar." })
    } finally {
      setVerifying(false)
    }
  }, [sub, setPlan])

  async function handleSignOut() {
    setSigningOut(true)
    await signOut({ callbackUrl: "/" })
  }

  // Displayed email: session > stored sub > nothing
  const displayEmail = session?.user?.email ?? sub?.email ?? null
  const displayName  = name || session?.user?.name || "Usuario"
  const initial      = displayName.charAt(0).toUpperCase()
  const planColor    = plan === "pro" ? "text-violet-400" : plan === "premium" ? "text-emerald-400" : "text-zinc-400"
  const isLoggedIn   = !!session

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto safe-x space-y-5">
      <PageHeader icon="user" title="Mi cuenta" subtitle="Perfil, suscripción y preferencias" />

      {/* ── Profile ─────────────────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        {/* Banner */}
        <div className={`h-16 ${
          isPro      ? "bg-gradient-to-br from-violet-600/25 to-violet-900/10" :
          isPremium  ? "bg-gradient-to-br from-emerald-600/20 to-cyan-900/10"  :
                       "bg-gradient-to-br from-zinc-800/60 to-zinc-900/40"
        }`} />

        <div className="px-5 pb-5 -mt-8">
          <div className="flex items-end justify-between mb-4">
            <div className={`grid place-items-center w-16 h-16 rounded-2xl border-2 text-xl font-black shadow-lg ${
              isPro      ? "bg-zinc-900 border-violet-700/60 text-violet-400"  :
              isPremium  ? "bg-zinc-900 border-emerald-700/60 text-emerald-400":
                           "bg-zinc-900 border-white/[0.10] text-zinc-300"
            }`}>{initial}</div>
            <PremiumBadge plan={plan} />
          </div>

          <p className="text-lg font-black text-white">{displayName}</p>
          {displayEmail && <p className="text-xs text-zinc-500 mt-0.5">{displayEmail}</p>}

          <div className="mt-4">
            <span className="section-label block mb-1.5">Nombre para mostrar</span>
            <div className="flex gap-2">
              <input value={name} onChange={(e) => saveName(e.target.value)} placeholder="Tu nombre"
                className="input-base flex-1"
                onKeyDown={(e) => e.key === "Enter" && persistName()}
              />
              <button
                type="button"
                onClick={persistName}
                disabled={nameSaving || !name.trim()}
                className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-zinc-950 text-xs font-bold transition-colors"
              >
                {nameSaving ? "…" : "Guardar"}
              </button>
            </div>
            {nameMsg && (
              <p className={`text-xs mt-1.5 ${nameMsg.ok ? "text-emerald-400" : "text-red-400"}`}>{nameMsg.text}</p>
            )}
          </div>

          {/* Public profile link */}
          {profileId && (
            <div className="mt-4 pt-4 border-t border-white/[0.07]">
              <span className="section-label block mb-1.5">Tu perfil público</span>
              <div className="flex items-center gap-2">
                <Link
                  href={`/profile/${profileId}`}
                  className="flex-1 truncate text-xs text-zinc-400 hover:text-white bg-zinc-800/60 border border-white/[0.07] rounded-xl px-3 py-2 transition"
                >
                  sportspicks.app/profile/{profileId}
                </Link>
                <button
                  onClick={() => {
                    const url = `${window.location.origin}/profile/${profileId}`
                    navigator.clipboard.writeText(url).then(() => {
                      setProfileLinkCopied(true)
                      setTimeout(() => setProfileLinkCopied(false), 2000)
                    })
                  }}
                  className="shrink-0 px-3 py-2 rounded-xl bg-zinc-800/60 hover:bg-zinc-700/60 border border-white/[0.07] text-xs font-bold text-zinc-300 tap transition"
                >
                  {profileLinkCopied ? "✓ Copiado" : "Copiar"}
                </button>
              </div>
              <p className="text-[10px] text-zinc-600 mt-1.5">Comparte tu historial y estadísticas. No muestra tu email.</p>
            </div>
          )}
        </div>
      </Card>

      {/* ── Suscripción ──────────────────────────────────────────────────── */}
      <Card className="p-5">
        <SectionTitle icon="crown" title="Suscripción" />

        <div className={`rounded-xl border p-4 mb-4 ${
          isPremium ? "border-emerald-700/40 bg-emerald-500/[0.05]" : "border-white/[0.07] bg-zinc-950/60"
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="section-label mb-1">Plan actual</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-xl font-black ${planColor}`}>{planDef.name}</span>
                {plan === "free" && <span className="text-[10px] text-zinc-600 font-medium">— Gratis</span>}
              </div>
            </div>
            {isPremium ? (
              <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${
                isPro ? "bg-violet-500/15 text-violet-300 border-violet-700/50"
                      : "bg-emerald-500/15 text-emerald-300 border-emerald-700/50"
              }`}>{planDef.priceMonthly}€/mes</span>
            ) : (
              <Link href="/pricing" className="flex items-center gap-1 text-xs font-bold text-emerald-400 tap">
                Mejorar <Icon name="arrowRight" className="w-3.5 h-3.5" strokeWidth={2.4} />
              </Link>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-2 leading-snug">{planDef.tagline}</p>
          {cancelPending && (
            <p className="text-xs text-amber-400 mt-2">⚠ Cancelación programada al final del período.</p>
          )}
        </div>

        {/* Usage stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <UsageStat label="Picks hoy"
            value={picksTotal !== null ? (isPremium ? String(picksTotal) : `3/${picksTotal}`) : "—"}
            color={isPremium ? "text-emerald-400" : "text-zinc-400"} />
          <UsageStat label="Bot IA"
            value={isPro ? "∞/día" : isPremium ? "15/día" : "3/día"}
            color={isPremium ? "text-emerald-400" : "text-zinc-400"} />
          <UsageStat label="Combinadas"
            value={isPremium ? "∞ modos" : "2/día"}
            color={isPremium ? "text-emerald-400" : "text-zinc-400"} />
        </div>

        {/* CTA */}
        {isPremium && sub?.customerId ? (
          <div className="space-y-2">
            <button onClick={openPortal} disabled={portalLoading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-zinc-800/60 border border-white/[0.07] hover:bg-zinc-700/60 disabled:opacity-50 text-white font-semibold text-sm tap transition-colors">
              {portalLoading
                ? <><Icon name="settings" className="w-4 h-4 animate-spin" /> Abriendo portal…</>
                : <><Icon name="settings" className="w-4 h-4" strokeWidth={2} /> Gestionar suscripción / Cancelar</>}
            </button>
            <p className="text-[11px] text-zinc-600 text-center">
              Gestiona pagos, cambia de plan o cancela desde el portal seguro de Stripe.
            </p>
          </div>
        ) : isPremium ? (
          <Link href="/pricing"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-white/[0.07] text-zinc-300 font-semibold text-sm tap hover:bg-zinc-800/60 transition-colors">
            Ver planes y gestionar
          </Link>
        ) : (
          <Link href="/pricing"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-zinc-950 font-bold text-sm tap">
            <Icon name="crown" className="w-4 h-4" strokeWidth={2.2} />
            Mejorar a Premium · desde 9.99€/mes
          </Link>
        )}

        <button onClick={() => verifySubscription()} disabled={verifying}
          className="mt-2 w-full py-2 text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-40 transition-colors tap">
          {verifying ? "Verificando con Stripe…" : "Verificar estado de suscripción"}
        </button>

        {verifyMsg && (
          <div className={`mt-2 flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-xs leading-snug ${
            verifyMsg.ok
              ? "bg-emerald-500/10 border border-emerald-700/40 text-emerald-300"
              : "bg-amber-500/10 border border-amber-700/40 text-amber-300"
          }`}>
            <Icon name={verifyMsg.ok ? "check" : "shield"} className="w-3.5 h-3.5 shrink-0 mt-0.5" strokeWidth={2.5} />
            {verifyMsg.text}
          </div>
        )}
      </Card>

      {/* ── Notificaciones ───────────────────────────────────────────────── */}
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

      {/* ── Privacidad ───────────────────────────────────────────────────── */}
      <Card className="p-5">
        <SectionTitle icon="shield" title="Privacidad y seguridad" />
        <div className="space-y-0.5">
          {[
            { label: "Términos de servicio",  href: "/legal/terms"              },
            { label: "Política de privacidad",href: "/legal/privacy"            },
            { label: "Gestión de cookies",    href: "/legal/cookies"            },
            { label: "Tus derechos (GDPR)",   href: "/legal/gdpr"              },
            { label: "Juego responsable",     href: "/legal/responsible-gaming" },
          ].map((l) => (
            <Link key={l.href} href={l.href}
              className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-zinc-800/60 transition-colors tap">
              <span className="text-sm text-zinc-300">{l.label}</span>
              <Icon name="arrowRight" className="w-4 h-4 text-zinc-600" strokeWidth={2} />
            </Link>
          ))}
        </div>
      </Card>

      {/* ── Cambiar contraseña ───────────────────────────────────────────── */}
      {isLoggedIn && (
        <Card className="p-5">
          <SectionTitle icon="shield" title="Seguridad" />
          {!showPwdForm ? (
            <button
              onClick={() => { setShowPwdForm(true); setPwdMsg(null) }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-white/[0.07] bg-zinc-900/60 hover:bg-zinc-800/60 text-zinc-300 font-semibold text-sm tap transition-all"
            >
              <Icon name="shield" className="w-4 h-4" strokeWidth={2} />
              Cambiar contraseña
            </button>
          ) : (
            <form onSubmit={handleChangePassword} className="space-y-3">
              <input
                type="password"
                placeholder="Contraseña actual"
                value={currentPwd}
                onChange={e => setCurrentPwd(e.target.value)}
                required
                className="w-full h-11 px-3.5 rounded-xl bg-zinc-800/40 border border-white/[0.08] text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white/[0.16] transition-colors"
              />
              <input
                type="password"
                placeholder="Nueva contraseña (mín. 8 caracteres)"
                value={newPwd}
                onChange={e => setNewPwd(e.target.value)}
                required
                minLength={8}
                className="w-full h-11 px-3.5 rounded-xl bg-zinc-800/40 border border-white/[0.08] text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white/[0.16] transition-colors"
              />
              <input
                type="password"
                placeholder="Repetir nueva contraseña"
                value={confirmPwd}
                onChange={e => setConfirmPwd(e.target.value)}
                required
                className="w-full h-11 px-3.5 rounded-xl bg-zinc-800/40 border border-white/[0.08] text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white/[0.16] transition-colors"
              />
              {pwdMsg && (
                <p className={`text-xs ${pwdMsg.ok ? "text-emerald-400" : "text-red-400"}`}>{pwdMsg.text}</p>
              )}
              <div className="flex gap-2">
                <button type="button" onClick={() => { setShowPwdForm(false); setPwdMsg(null) }}
                  className="flex-1 py-2.5 rounded-xl bg-zinc-800/60 border border-white/[0.07] hover:bg-zinc-700/60 text-sm text-zinc-300 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={pwdSaving}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-zinc-950 font-bold text-sm transition-colors">
                  {pwdSaving ? "Guardando…" : "Actualizar"}
                </button>
              </div>
            </form>
          )}
        </Card>
      )}

      {/* ── Sesión ───────────────────────────────────────────────────────── */}
      {isLoggedIn && (
        <Card className="p-5">
          <SectionTitle icon="user" title="Sesión" />
          {displayEmail && (
            <p className="text-sm text-zinc-400 mb-4">
              Conectado como <span className="text-zinc-200 font-medium">{displayEmail}</span>
            </p>
          )}
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-rose-800/60 bg-rose-500/[0.08] hover:bg-rose-500/[0.15] text-rose-400 font-bold text-sm tap transition-all disabled:opacity-50"
          >
            {signingOut ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25"/>
                  <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                </svg>
                Cerrando sesión…
              </>
            ) : (
              <>
                <Icon name="logout" className="w-4 h-4" strokeWidth={2} />
                Cerrar sesión
              </>
            )}
          </button>
        </Card>
      )}

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
      <h2 className="apple-eyebrow text-white/70">{title}</h2>
    </div>
  )
}

function ToggleRow({ label, hint, on, onChange }: { label: string; hint: string; on: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange}
      className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl hover:bg-zinc-800/50 transition-colors text-left tap">
      <div className="min-w-0">
        <p className="text-sm text-zinc-200 font-medium">{label}</p>
        <p className="text-[11px] text-zinc-500 leading-snug">{hint}</p>
      </div>
      <span className={`relative w-11 h-6 rounded-full shrink-0 transition-colors duration-200 ${on ? "bg-emerald-500" : "bg-zinc-700"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all duration-200 shadow-sm ${on ? "left-[22px]" : "left-0.5"}`} />
      </span>
    </button>
  )
}

function UsageStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-zinc-900/60 p-3 text-center">
      <p className={`text-sm font-black ${color}`}>{value}</p>
      <p className="text-[10px] text-zinc-600 mt-0.5">{label}</p>
    </div>
  )
}
