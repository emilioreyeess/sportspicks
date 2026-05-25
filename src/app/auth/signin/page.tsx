"use client"

import { signIn, getProviders } from "next-auth/react"
import { useEffect, useState } from "react"
import { Icon } from "@/components/ui/icons"

interface Provider {
  id: string
  name: string
}

export default function SignInPage() {
  const [providers, setProviders] = useState<Record<string, Provider> | null>(null)
  const [loading, setLoading] = useState<string | null>(null)

  useEffect(() => {
    getProviders().then(setProviders)
  }, [])

  async function handleSignIn(providerId: string) {
    setLoading(providerId)
    await signIn(providerId, { callbackUrl: "/" })
    setLoading(null)
  }

  return (
    <div className="fixed inset-0 z-[100] bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="grid place-items-center w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-700/50">
            <Icon name="value" className="w-8 h-8 text-emerald-400" strokeWidth={2} />
          </div>
          <h1 className="text-2xl font-black text-white">SportsPicks</h1>
          <p className="text-sm text-zinc-500 mt-1">Análisis deportivo cuantitativo</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-3">
          <h2 className="text-lg font-black text-white text-center mb-4">Accede a la plataforma</h2>

          {/* Google */}
          {providers?.google && (
            <button
              onClick={() => handleSignIn("google")}
              disabled={loading === "google"}
              className="w-full flex items-center justify-center gap-3 py-3.5 px-4 bg-white hover:bg-zinc-100 disabled:opacity-60 text-zinc-900 font-bold rounded-xl text-sm transition-colors tap"
            >
              {loading === "google" ? (
                <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              )}
              {loading === "google" ? "Conectando…" : "Continuar con Google"}
            </button>
          )}

          {/* Apple */}
          {providers?.apple && (
            <button
              onClick={() => handleSignIn("apple")}
              disabled={loading === "apple"}
              className="w-full flex items-center justify-center gap-3 py-3.5 px-4 bg-black hover:bg-zinc-900 disabled:opacity-60 text-white font-bold rounded-xl text-sm border border-zinc-700 transition-colors tap"
            >
              {loading === "apple" ? (
                <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 814 1000" fill="white">
                  <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46.7 790.7 0 663 0 541.8c0-207.5 135.4-317.3 269-317.3 70.1 0 128.4 46.4 172.5 46.4 42.8 0 109.6-49 190.5-49 30.6 0 110.6 2.6 168.3 83.2zm-107.4-133.8c22.7-26.9 38.5-64.3 38.5-101.7 0-5.2-.5-10.4-1.5-15.5-36.4 1.4-79.4 24.3-105.5 54.3-20.1 22.7-38.5 60.2-38.5 98.2 0 5.8.9 11.5 1.4 13.3 2.3.4 6.1.9 9.9.9 32.5 0 73.1-21.8 95.7-49.5z"/>
                </svg>
              )}
              {loading === "apple" ? "Conectando…" : "Continuar con Apple"}
            </button>
          )}

          {!providers && (
            <div className="text-center py-4">
              <div className="inline-block w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"/>
            </div>
          )}

          <p className="text-[11px] text-zinc-600 text-center pt-2 leading-relaxed">
            Al acceder aceptas nuestros{" "}
            <a href="/legal/terms" className="underline hover:text-zinc-400">Términos</a>{" "}
            y{" "}
            <a href="/legal/privacy" className="underline hover:text-zinc-400">Privacidad</a>.
            +18 · Análisis informativo.
          </p>
        </div>
      </div>
    </div>
  )
}
