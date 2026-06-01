"use client"

/**
 * AdBanner — bloque de anuncio AdSense con apariencia nativa.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Características:
 *   · Respeta el design system: fondo `bg-zinc-900/40`, `rounded-2xl/3xl`,
 *     padding generoso, etiqueta "Publicidad" muy discreta (text-[10px]
 *     uppercase tracking-widest text-zinc-600). Encaja en feed sin parecer spam.
 *   · No renderiza nada (return null) si:
 *       - el usuario es Premium / Pro (paga por experiencia sin ads)
 *       - el usuario aún no ha aceptado cookies de marketing (GDPR)
 *       - el slot no está configurado vía prop ni env var
 *   · Si AdBlock bloquea o el slot no se rellena en 3s, el componente se oculta
 *     en lugar de mostrar un placeholder vacío feo.
 *   · No bloquea el render: el script raíz se carga en layout.tsx con
 *     `next/script strategy="afterInteractive"` — aquí solo invocamos
 *     `(window.adsbygoogle = window.adsbygoogle || []).push({})`.
 *
 * El publisher ID está fijo (ca-pub-9944234338041841). El `data-ad-slot` se
 * pasa por prop o se toma de NEXT_PUBLIC_ADSENSE_SLOT_DEFAULT.
 *
 * Uso:
 *   <AdBanner slot="1234567890" />
 *   <AdBanner slot="9876543210" variant="inline" />        // sin padding/label
 *   <AdBanner slot="5555555555" minHeight={280} />         // reserva altura
 */

import { useEffect, useRef, useState } from "react"
import { getConsent } from "@/lib/compliance"
import { usePlan } from "@/lib/plan"

const ADSENSE_PUBLISHER_ID = "ca-pub-9944234338041841"
const DEFAULT_SLOT = process.env.NEXT_PUBLIC_ADSENSE_SLOT_DEFAULT ?? ""
const RENDER_TIMEOUT_MS = 3000  // si el ins sigue vacío tras esto → ocultar

interface AdBannerProps {
  /** data-ad-slot del bloque de AdSense (obligatorio para que se rellene). */
  slot?: string
  /** Layout estilo: card respetando design system, o inline minimalista. */
  variant?: "card" | "inline"
  /** Reserva mínima de altura para evitar CLS (Cumulative Layout Shift). */
  minHeight?: number
  /** Formato AdSense: "auto" (responsive) | "fluid" | "rectangle" | "horizontal" */
  format?: "auto" | "fluid" | "rectangle" | "horizontal"
  /** Responsive full-width — true por defecto */
  fullWidthResponsive?: boolean
  className?: string
}

declare global {
  interface Window {
    adsbygoogle?: any[]
  }
}

export function AdBanner({
  slot = DEFAULT_SLOT,
  variant = "card",
  minHeight = 120,
  format = "auto",
  fullWidthResponsive = true,
  className = "",
}: AdBannerProps) {
  const { isPremium } = usePlan()
  const [hasConsent, setHasConsent] = useState(false)
  const [hidden, setHidden] = useState(false)
  const insRef = useRef<HTMLModElement>(null)
  const pushedRef = useRef(false)

  // ─── 1. Consentimiento de marketing (GDPR) ─────────────────────────────────
  useEffect(() => {
    if (isPremium) return
    if (getConsent().cookies_marketing) { setHasConsent(true); return }
    const onGrant = () => {
      if (getConsent().cookies_marketing) setHasConsent(true)
    }
    window.addEventListener("consent-granted", onGrant)
    return () => window.removeEventListener("consent-granted", onGrant)
  }, [isPremium])

  // ─── 2. Push del slot a AdSense (solo una vez por instancia) ──────────────
  useEffect(() => {
    if (!hasConsent || isPremium || !slot || pushedRef.current) return
    pushedRef.current = true
    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch {
      // AdBlock o script aún no cargado — ocultamos para no mostrar caja vacía
      setHidden(true)
    }
  }, [hasConsent, isPremium, slot])

  // ─── 3. Detecta render fallido (AdBlock / sin fill) y oculta el contenedor ─
  useEffect(() => {
    if (!hasConsent || isPremium || !slot) return
    const t = setTimeout(() => {
      const el = insRef.current
      // AdSense añade data-ad-status="filled" cuando hay creatividad servida.
      // Si tras RENDER_TIMEOUT_MS sigue "unfilled" o sin estado, ocultamos.
      const status = el?.getAttribute("data-ad-status")
      const height = el?.clientHeight ?? 0
      if (status !== "filled" && height < 30) setHidden(true)
    }, RENDER_TIMEOUT_MS)
    return () => clearTimeout(t)
  }, [hasConsent, isPremium, slot])

  // ─── Early returns ────────────────────────────────────────────────────────
  if (isPremium) return null
  if (!hasConsent) return null
  if (!slot) {
    // En desarrollo, avisamos en consola — en producción, simplemente no se
    // renderiza nada (no queremos ensuciar la UI con placeholders).
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn(
        "[AdBanner] Sin `slot` configurado. Pasa la prop `slot` o setea " +
        "NEXT_PUBLIC_ADSENSE_SLOT_DEFAULT en tu .env.",
      )
    }
    return null
  }
  if (hidden) return null

  // ─── Render ───────────────────────────────────────────────────────────────
  const wrapperBase = variant === "card"
    ? "rounded-2xl bg-zinc-900/40 px-4 py-4 sm:px-5 sm:py-5"
    : "py-2"

  return (
    <div
      className={`${wrapperBase} ${className}`}
      style={{ minHeight }}
      role="complementary"
      aria-label="Publicidad"
    >
      {variant === "card" && (
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-2.5">
          Publicidad
        </p>
      )}
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{
          display: "block",
          minHeight: Math.max(0, minHeight - (variant === "card" ? 50 : 0)),
        }}
        data-ad-client={ADSENSE_PUBLISHER_ID}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={fullWidthResponsive ? "true" : "false"}
      />
    </div>
  )
}

export default AdBanner
