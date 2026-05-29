"use client"

/**
 * Next.js App Router — fallback global de errores de servidor/cliente.
 * Se monta automáticamente si cualquier page.tsx lanza durante el render.
 * Reporta automáticamente a Sentry en producción.
 */
import { useEffect } from "react"
import * as Sentry from "@sentry/nextjs"

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6 py-12 safe-x">
      <div className="max-w-md w-full rounded-2xl border border-white/[0.07] bg-zinc-900/70 backdrop-blur-sm shadow-xl p-6 text-center">
        <div className="text-5xl mb-3">😕</div>
        <h2 className="text-xl font-black text-white tracking-tight">
          No hemos podido cargar esta página
        </h2>
        <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
          Puede ser que estemos actualizando los datos. Vuelve a intentarlo en unos segundos.
        </p>
        <div className="mt-5 flex flex-col sm:flex-row gap-2">
          <button
            onClick={reset}
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
      </div>
    </div>
  )
}
