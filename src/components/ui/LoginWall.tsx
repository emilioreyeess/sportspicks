"use client"

import { useSession, signIn } from "next-auth/react"
import { useState } from "react"
import { Icon } from "@/components/ui/icons"

function GoogleIcon() {
  return (
    <svg className="w-4.5 h-4.5 shrink-0" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin shrink-0" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export function LoginWall({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()

  const [loading, setLoading]     = useState<string | null>(null)
  const [mode, setMode]           = useState<"login" | "register">("login")
  const [email, setEmail]         = useState("")
  const [password, setPassword]   = useState("")
  const [name, setName]           = useState("")
  const [tyc, setTyc]             = useState(false)
  const [cookies, setCookies]     = useState(false)
  const [formError, setFormError] = useState("")

  if (status === "loading") {
    return (
      <div className="fixed inset-0 bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (session) return <>{children}</>

  async function handleSignIn(providerId: string) {
    setLoading(providerId)
    await signIn(providerId, { callbackUrl: "/" })
    setLoading(null)
  }

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault()
    setFormError("")

    if (mode === "register" && (!tyc || !cookies)) {
      setFormError("Debes aceptar los Términos y la Política de Cookies para continuar.")
      return
    }
    if (password.length < 8) {
      setFormError("La contraseña debe tener al menos 8 caracteres.")
      return
    }

    setLoading("credentials")
    const result = await signIn("credentials", {
      redirect: false,
      email,
      password,
      name: mode === "register" ? name : "",
      mode,
    })
    setLoading(null)

    if (result?.error) {
      if (result.error.includes("EMAIL_TAKEN")) {
        setFormError("Este email ya está registrado. Inicia sesión.")
      } else {
        setFormError(mode === "login" ? "Email o contraseña incorrectos." : "Error al crear la cuenta. Inténtalo de nuevo.")
      }
    } else {
      window.location.href = "/"
    }
  }

  const canSubmit = mode === "login"
    ? email && password
    : email && password && name && tyc && cookies

  const features = [
    { icon: "value",      label: "Value Picks diarios con modelo Poisson" },
    { icon: "bot",        label: "Bot IA que analiza tu boleto con fotos" },
    { icon: "combinadas", label: "Combinadas generadas con cuotas reales" },
    { icon: "stats",      label: "Estadísticas avanzadas de ESPN" },
  ]

  return (
    <div className="fixed inset-0 z-[100] flex">
      {/* Left decorative panel (desktop only) */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[48%] relative overflow-hidden bg-zinc-950 flex-col justify-between p-12">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 -right-32 w-80 h-80 bg-cyan-500/8 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 left-1/4 w-72 h-72 bg-violet-500/8 rounded-full blur-3xl" />
        </div>

        <div className="relative">
          <div className="flex items-center gap-3 mb-16">
            <span className="grid place-items-center w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500/30 to-cyan-500/20 border border-emerald-600/40 text-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.2)]">
              <Icon name="value" className="w-6 h-6" strokeWidth={2} />
            </span>
            <div>
              <p className="text-base font-black text-white tracking-tight">SportsPicks</p>
              <p className="text-[11px] text-emerald-400/80 font-bold tracking-wide">Analytics Engine</p>
            </div>
          </div>
          <h1 className="text-4xl xl:text-5xl font-black text-white tracking-tight leading-[1.08] mb-5">
            Análisis deportivo<br />
            <span className="gradient-text-static">cuantitativo</span>
          </h1>
          <p className="text-zinc-400 text-lg leading-relaxed max-w-xs">
            Picks con edge real. Cuotas verificadas. Cero datos inventados.
          </p>
        </div>

        <div className="relative space-y-3">
          <p className="text-[11px] font-black uppercase tracking-widest text-zinc-600 mb-4">Incluido en tu cuenta</p>
          {features.map((f) => (
            <div key={f.label} className="flex items-center gap-3">
              <span className="grid place-items-center w-7 h-7 rounded-lg bg-emerald-500/12 border border-emerald-700/40 text-emerald-400 shrink-0">
                <Icon name={f.icon} className="w-3.5 h-3.5" strokeWidth={2} />
              </span>
              <span className="text-sm text-zinc-300">{f.label}</span>
            </div>
          ))}
        </div>

        <div className="relative">
          <div className="h-px bg-zinc-800/80 mb-5" />
          <p className="text-[11px] text-zinc-600">+18 · Solo información. Juega con responsabilidad.</p>
        </div>
      </div>

      {/* Right panel — auth form */}
      <div
        className="flex-1 flex items-center justify-center px-5 py-8 relative overflow-y-auto"
        style={{ background: "#09090b" }}
      >
        <div className="pointer-events-none absolute inset-0 lg:hidden">
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-500/8 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-64 h-64 bg-violet-500/6 rounded-full blur-3xl" />
        </div>

        <div className="relative w-full max-w-[380px]">

          {/* Mobile-only logo */}
          <div className="lg:hidden text-center mb-8">
            <span className="inline-grid place-items-center w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/25 to-cyan-500/20 border border-emerald-600/40 text-emerald-400 shadow-[0_0_24px_rgba(52,211,153,0.2)] mb-4">
              <Icon name="value" className="w-7 h-7" strokeWidth={2} />
            </span>
            <h1 className="text-2xl font-black text-white tracking-tight">SportsPicks</h1>
            <p className="text-sm text-zinc-500 mt-1">Análisis deportivo cuantitativo</p>
          </div>

          {/* Card */}
          <div
            className="rounded-2xl border border-zinc-800/80 overflow-hidden"
            style={{
              background: "rgba(24,24,27,0.75)",
              backdropFilter: "blur(20px) saturate(160%)",
              boxShadow: "0 8px 40px -4px rgba(0,0,0,0.6), 0 4px 16px -4px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
          >
            {/* Header + mode toggle */}
            <div className="px-6 pt-6 pb-4 border-b border-zinc-800/70">
              <h2 className="text-lg font-black text-white">
                {mode === "login" ? "Accede a la plataforma" : "Crear cuenta"}
              </h2>
              <p className="text-sm text-zinc-500 mt-0.5">
                {mode === "login" ? "¿No tienes cuenta?" : "¿Ya tienes cuenta?"}
                {" "}
                <button
                  type="button"
                  onClick={() => { setMode(m => m === "login" ? "register" : "login"); setFormError("") }}
                  className="text-emerald-400 hover:text-emerald-300 font-bold transition-colors"
                >
                  {mode === "login" ? "Regístrate" : "Inicia sesión"}
                </button>
              </p>
            </div>

            <div className="px-6 py-5 space-y-3">
              {/* Email/password form */}
              <form onSubmit={handleCredentials} className="space-y-2.5">
                {mode === "register" && (
                  <input
                    type="text"
                    placeholder="Tu nombre"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    className="w-full h-11 px-3.5 rounded-xl bg-zinc-900 border border-zinc-700/60 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-600/60 transition-colors"
                  />
                )}
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full h-11 px-3.5 rounded-xl bg-zinc-900 border border-zinc-700/60 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-600/60 transition-colors"
                />
                <input
                  type="password"
                  placeholder="Contraseña (mín. 8 caracteres)"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                  className="w-full h-11 px-3.5 rounded-xl bg-zinc-900 border border-zinc-700/60 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-600/60 transition-colors"
                />

                {/* TyC + Cookies checkboxes (register only) */}
                {mode === "register" && (
                  <div className="space-y-2 pt-1">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={tyc}
                        onChange={e => setTyc(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded accent-emerald-500 shrink-0 cursor-pointer"
                      />
                      <span className="text-[11px] text-zinc-400 leading-relaxed">
                        He leído y acepto los{" "}
                        <a href="/legal/terms" target="_blank" className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2">
                          Términos y Condiciones
                        </a>{" "}
                        de uso. <span className="text-red-400">*</span>
                      </span>
                    </label>
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={cookies}
                        onChange={e => setCookies(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded accent-emerald-500 shrink-0 cursor-pointer"
                      />
                      <span className="text-[11px] text-zinc-400 leading-relaxed">
                        Acepto la{" "}
                        <a href="/legal/privacy" target="_blank" className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2">
                          Política de Privacidad y Cookies
                        </a>
                        . <span className="text-red-400">*</span>
                      </span>
                    </label>
                  </div>
                )}

                {formError && (
                  <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {formError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={!canSubmit || !!loading}
                  className="w-full h-11 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white transition-all flex items-center justify-center gap-2"
                >
                  {loading === "credentials"
                    ? <><Spinner /><span>Procesando…</span></>
                    : (mode === "login" ? "Iniciar sesión" : "Crear cuenta")}
                </button>
              </form>

              {/* Divider + Google */}
              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-zinc-800" />
                <span className="text-[11px] text-zinc-600 font-medium">o continúa con</span>
                <div className="flex-1 h-px bg-zinc-800" />
              </div>

              <button
                onClick={() => handleSignIn("google")}
                disabled={!!loading}
                className="w-full flex items-center justify-center gap-3 h-11 px-4 rounded-xl text-sm font-bold transition-all disabled:opacity-60 hover:scale-[1.01]"
                style={{
                  background: loading === "google" ? "#e5e7eb" : "#ffffff",
                  color: "#111827",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                }}
              >
                {loading === "google" ? <Spinner /> : <GoogleIcon />}
                <span>{loading === "google" ? "Conectando…" : "Continuar con Google"}</span>
              </button>
            </div>

            <div className="px-6 pb-5">
              <p className="text-[11px] text-zinc-600 text-center leading-relaxed">
                +18 · Análisis informativo, no asesoramiento financiero.
              </p>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-zinc-600">
            <span className="flex -space-x-1.5">
              {["🟢","🔵","🟣"].map((c, i) => (
                <span key={i} className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700/60 text-[9px]">
                  {c}
                </span>
              ))}
            </span>
            <span>Más de 400 usuarios activos</span>
          </div>
        </div>
      </div>
    </div>
  )
}
