"use client"

/**
 * PremiumGate — feature gating brutalista.
 *
 * Si el usuario es Premium/Pro → renderiza `children` (contenido avanzado).
 * Si es Free → renderiza un bloque bloqueado de alto contraste con CTA de
 * upgrade que lleva a `/pricing` (flujo de checkout de Stripe del proyecto).
 *
 * Estética: bordes duros 1px, sin gradientes suaves ni sombras difuminadas,
 * fuente mono para etiquetas, alto contraste.
 *
 * Reutilizable en cualquier superficie:
 *   <PremiumGate feature="Análisis cuantitativo">
 *     <AdvancedAnalysis ... />
 *   </PremiumGate>
 */

import Link from "next/link"
import type { ReactNode } from "react"
import { usePlan } from "@/lib/plan"

interface PremiumGateProps {
  /** Nombre de la feature gateada — se muestra en el estado bloqueado. */
  feature?: string
  /** Texto opcional bajo el título del bloqueo. */
  hint?: string
  /** Contenido premium que se revela a usuarios Premium/Pro. */
  children: ReactNode
}

export function PremiumGate({ feature = "Contenido premium", hint, children }: PremiumGateProps) {
  const { isPremium } = usePlan()

  if (isPremium) return <>{children}</>

  return (
    <div className="border border-zinc-700 bg-zinc-950">
      {/* Barra superior de etiqueta */}
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 py-2">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
          {feature}
        </span>
        <span className="inline-block bg-emerald-400 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-black">
          Premium
        </span>
      </div>

      {/* Cuerpo bloqueado */}
      <div className="px-6 py-10 text-center">
        <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-600">
          // contenido bloqueado
        </p>
        <h3 className="mb-2 text-[18px] font-black uppercase tracking-tight text-white">
          Desbloquea {feature}
        </h3>
        <p className="mx-auto mb-4 max-w-sm text-[13px] leading-relaxed text-zinc-500">
          {hint ?? "Este análisis está disponible con el plan Premium. Datos cuantitativos completos, sin recortes."}
        </p>

        {/* Badge de prueba gratis */}
        <div className="mb-5 inline-flex items-center gap-1.5 border border-emerald-500/40 bg-emerald-500/10 px-3 py-1">
          <span className="h-1.5 w-1.5 bg-emerald-400" />
          <span className="text-[11px] font-black uppercase tracking-wider text-emerald-300">Incluye 3 días de prueba gratis</span>
        </div>

        {/* CTA brutalista → /pricing (checkout Stripe) */}
        <Link
          href="/pricing"
          className="flex items-center justify-center gap-2 border border-emerald-400 bg-emerald-400 px-7 py-3 text-[13px] font-black uppercase tracking-wider text-black transition-colors hover:bg-emerald-300"
        >
          Empezar Prueba de 3 Días Gratis
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  )
}

export default PremiumGate
