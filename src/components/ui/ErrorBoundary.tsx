"use client"

import { Component, type ReactNode } from "react"

interface State {
  error: Error | null
}

/**
 * ErrorBoundary global — captura excepciones de renderizado del árbol
 * y muestra un fallback amigable en lugar de una pantalla blanca.
 *
 * Next.js App Router también soporta `error.tsx`, pero éste cubre componentes
 * cliente que rompan fuera del flujo del router (timers, listeners, etc.).
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error): void {
    // En producción, aquí enviarías a Sentry/Datadog. Solo silencioso para no
    // contaminar stdout en serverless (Vercel cobra por logs).
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("[ErrorBoundary]", error)
    }
  }

  reset = () => this.setState({ error: null })

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="min-h-[60vh] flex items-center justify-center px-6 py-12 safe-x">
        <div className="max-w-md w-full rounded-2xl border border-white/[0.07] bg-zinc-900/70 backdrop-blur-sm shadow-xl p-6 text-center">
          <div className="text-5xl mb-3">⚠️</div>
          <h2 className="text-xl font-black text-white tracking-tight">
            Algo ha fallado al cargar esta vista
          </h2>
          <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
            Es probable que sea temporal. Estamos al tanto y vamos a revisarlo —
            mientras tanto puedes recargar o volver al inicio.
          </p>
          <div className="mt-5 flex flex-col sm:flex-row gap-2">
            <button
              onClick={this.reset}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-zinc-950 font-black text-sm tap shadow-lg shadow-emerald-900/30"
            >
              Reintentar
            </button>
            <a
              href="/"
              className="flex-1 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-sm tap text-center"
            >
              Ir al inicio
            </a>
          </div>
          <p className="text-[11px] text-zinc-600 mt-4">SportsPicks Analytics</p>
        </div>
      </div>
    )
  }
}
