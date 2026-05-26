"use client"

import { signIn, getProviders } from "next-auth/react"
import { useEffect, useState } from "react"
import { Icon } from "@/components/ui/icons"

interface Provider { id: string; name: string }

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

function AppleIcon() {
  return (
    <svg className="w-4.5 h-4.5 shrink-0" viewBox="0 0 814 1000" fill="white">
      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46.7 790.7 0 663 0 541.8c0-207.5 135.4-317.3 269-317.3 70.1 0 128.4 46.4 172.5 46.4 42.8 0 109.6-49 190.5-49 30.6 0 110.6 2.6 168.3 83.2zm-107.4-133.8c22.7-26.9 38.5-64.3 38.5-101.7 0-5.2-.5-10.4-1.5-15.5-36.4 1.4-79.4 24.3-105.5 54.3-20.1 22.7-38.5 60.2-38.5 98.2 0 5.8.9 11.5 1.4 13.3 2.3.4 6.1.9 9.9.9 32.5 0 73.1-21.8 95.7-49.5z"/>
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

export default function SignInPage() {
  const [providers, setProviders] = useState<Record<string, Provider> | null>(null)
  const [loading, setLoading] = useState<string | null>(null)

  useEffect(() => { getProviders().then(setProviders) }, [])

  async function handleSignIn(providerId: string) {
    setLoading(providerId)
    await signIn(providerId, { callbackUrl: "/" })
    setLoading(null)
  }

  const features = [
    { icon: "value",   label: "Value Picks diarios con modelo Poisson" },
    { icon: "bot",     label: "Bot IA que analiza tu boleto con fotos" },
    { icon: "combinadas", label: "Combinadas generadas con cuotas reales" },
    { icon: "stats",   label: "Estadísticas avanzadas de ESPN" },
  ]

  return (
    <div className="fixed inset-0 z-[100] flex">
      {/* ─── Left panel (decorative, desktop only) ──────────────────────── */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[48%] relative overflow-hidden bg-zinc-950 flex-col justify-between p-12">

        {/* Ambient gradients */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 -right-32 w-80 h-80 bg-cyan-500/8 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 left-1/4 w-72 h-72 bg-violet-500/8 rounded-full blur-3xl" />
          {/* Subtle grid pattern */}
          <div className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />
        </div>

        {/* Brand */}
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

        {/* Feature list */}
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

        {/* Footer */}
        <div className="relative">
          <div className="h-px bg-zinc-800/80 mb-5" />
          <p className="text-[11px] text-zinc-600">
            +18 · Solo información. Juega con responsabilidad.
          </p>
        </div>
      </div>

      {/* ─── Right panel — auth form ─────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-5 py-8 relative overflow-y-auto"
        style={{ background: "#09090b" }}>

        {/* Ambient for mobile */}
        <div className="pointer-events-none absolute inset-0 lg:hidden">
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-500/8 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-64 h-64 bg-violet-500/6 rounded-full blur-3xl" />
        </div>

        <div className="relative w-full max-w-[360px] animate-fade-in">

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
            {/* Card header */}
            <div className="px-6 pt-6 pb-5 border-b border-zinc-800/70">
              <h2 className="text-lg font-black text-white">Accede a la plataforma</h2>
              <p className="text-sm text-zinc-500 mt-1">Inicia sesión para continuar</p>
            </div>

            {/* Providers */}
            <div className="px-6 py-5 space-y-3">
              {/* Loading skeleton */}
              {!providers && (
                <>
                  <div className="h-12 rounded-xl skeleton" />
                  <div className="h-12 rounded-xl skeleton" style={{ animationDelay: "0.1s" }} />
                </>
              )}

              {/* Google */}
              {providers?.google && (
                <button
                  onClick={() => handleSignIn("google")}
                  disabled={!!loading}
                  className="group w-full flex items-center justify-center gap-3 h-12 px-4 rounded-xl text-sm font-bold transition-all tap disabled:opacity-60 hover:scale-[1.01]"
                  style={{
                    background: loading === "google" ? "#e5e7eb" : "#ffffff",
                    color: "#111827",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                  }}
                >
                  {loading === "google" ? <Spinner /> : <GoogleIcon />}
                  <span>{loading === "google" ? "Conectando…" : "Continuar con Google"}</span>
                </button>
              )}

              {/* Apple */}
              {providers?.apple && (
                <button
                  onClick={() => handleSignIn("apple")}
                  disabled={!!loading}
                  className="group w-full flex items-center justify-center gap-3 h-12 px-4 rounded-xl border border-zinc-700/80 bg-black hover:bg-zinc-900 text-sm font-bold text-white transition-all tap disabled:opacity-60 hover:scale-[1.01]"
                >
                  {loading === "apple" ? <Spinner /> : <AppleIcon />}
                  <span>{loading === "apple" ? "Conectando…" : "Continuar con Apple"}</span>
                </button>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 pb-5">
              {/* Trust signals */}
              <div className="flex items-center justify-center gap-4 mb-4">
                {[
                  { icon: "🔒", label: "Sin contraseña" },
                  { icon: "⚡", label: "Acceso inmediato" },
                  { icon: "🛡️", label: "Privado" },
                ].map((t) => (
                  <div key={t.label} className="flex flex-col items-center gap-0.5">
                    <span className="text-base">{t.icon}</span>
                    <span className="text-[10px] text-zinc-600 font-medium">{t.label}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-zinc-600 text-center leading-relaxed">
                Al acceder aceptas nuestros{" "}
                <a href="/legal/terms" className="text-zinc-400 hover:text-white underline underline-offset-2 transition-colors">Términos</a>{" "}
                y{" "}
                <a href="/legal/privacy" className="text-zinc-400 hover:text-white underline underline-offset-2 transition-colors">Privacidad</a>.
                <br />+18 · Análisis informativo, no asesoramiento financiero.
              </p>
            </div>
          </div>

          {/* Social proof (mobile + desktop right panel) */}
          <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-zinc-600">
            <span className="flex -space-x-1.5">
              {["🟢","🔵","🟣"].map((c, i) => (
                <span key={i}
                  className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700/60 text-[9px]">
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
