"use client"

/**
 * TrustpilotReviewToast — toast no intrusivo (esquina inferior) de recolección
 * de reseñas. Solo aparece tras un hito de valor (ver trustpilot-trigger).
 * Nunca bloquea contenido ni condiciona acceso a datos.
 */

import { useEffect, useState } from "react"
import {
  shouldShowReview, recordSession, dismissReview, markReviewed, TRUSTPILOT_URL,
} from "@/lib/reviews/trustpilot-trigger"

export function TrustpilotReviewToast() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    // Cuenta la sesión y evalúa el trigger tras un breve margen (no molestar al
    // entrar; dejar que el usuario haga algo primero).
    recordSession()
    const t = setTimeout(() => {
      if (shouldShowReview()) setOpen(true)
    }, 4000)
    return () => clearTimeout(t)
  }, [])

  if (!open) return null

  const close = () => setOpen(false)
  const onDismiss = () => { dismissReview(); close() }
  const onReview = () => { markReviewed(); close() }

  return (
    <div
      role="dialog"
      aria-label="Valorar en Trustpilot"
      className="fixed bottom-4 right-4 z-50 w-[320px] max-w-[calc(100vw-2rem)] rounded-2xl border border-white/[0.08] bg-zinc-900/95 backdrop-blur-xl shadow-[0_16px_48px_-16px_rgba(0,0,0,0.6)] p-4 animate-slide-up"
    >
      <div className="flex items-start gap-2 mb-2">
        <span className="text-emerald-400 text-lg leading-none mt-0.5 shrink-0">★</span>
        <p className="text-[13px] font-bold text-white leading-snug">
          ¿Nos dejas tu valoración técnica?
        </p>
        <button onClick={close} aria-label="Cerrar"
          className="ml-auto -mt-0.5 -mr-1 p-1 text-zinc-600 hover:text-zinc-300 transition-colors">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </div>

      <p className="text-[12.5px] text-zinc-400 leading-relaxed mb-3.5">
        Vemos que estás sacando partido a nuestros modelos. ¿Te importaría dejar una
        reseña honesta sobre nuestra precisión técnica en Trustpilot?
      </p>

      <div className="flex items-center gap-2">
        <a
          href={TRUSTPILOT_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onReview}
          className="flex-1 text-center rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-[12.5px] font-bold py-2 transition-colors"
        >
          Valorar en Trustpilot
        </a>
        <button
          onClick={onDismiss}
          className="rounded-xl border border-white/[0.08] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03] text-[12.5px] font-medium px-3 py-2 transition-colors"
        >
          Ahora no
        </button>
      </div>
    </div>
  )
}
