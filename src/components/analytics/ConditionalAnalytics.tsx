"use client"

/**
 * ConditionalAnalytics — carga Umami solo si el usuario ha dado consentimiento
 * analítico. Se suscribe al evento "consent-granted" del CookieConsent banner
 * para activarse sin recargar la página.
 *
 * Variables de entorno:
 *   NEXT_PUBLIC_UMAMI_WEBSITE_ID  — ID de tu sitio en Umami Cloud o self-hosted
 *   NEXT_PUBLIC_UMAMI_SCRIPT_URL  — URL del script (por defecto: Umami Cloud)
 */

import { useEffect, useState } from "react"
import Script from "next/script"
import { getConsent } from "@/lib/compliance"

const UMAMI_SCRIPT =
  process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL ?? "https://analytics.umami.is/script.js"
const UMAMI_ID = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID ?? ""

export function ConditionalAnalytics() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Comprueba consentimiento guardado al montar
    if (getConsent().cookies_analytics) {
      setReady(true)
      return
    }

    // Escucha si el usuario acepta cookies durante la sesión
    const onGrant = () => setReady(true)
    window.addEventListener("consent-granted", onGrant)
    return () => window.removeEventListener("consent-granted", onGrant)
  }, [])

  if (!ready || !UMAMI_ID) return null

  return (
    <Script
      src={UMAMI_SCRIPT}
      data-website-id={UMAMI_ID}
      strategy="afterInteractive"
      // Atributo de privacidad: deshabilita el seguimiento de URLs exactas en favor
      // de patrones para no capturar tokens o IDs en la URL
      data-auto-track="true"
      data-do-not-track="true"
    />
  )
}

// ─── Helpers para tracking de eventos personalizados ─────────────────────────

type UmamiTrackFn = (event: string, data?: Record<string, string | number | boolean>) => void

declare global {
  interface Window {
    umami?: { track: UmamiTrackFn }
  }
}

/**
 * Envía un evento personalizado a Umami (no-op si no hay consentimiento o script no cargado).
 *
 * @example
 * trackEvent("subscribe_click", { plan: "premium" })
 * trackEvent("reto_enrolled", { retoId: "avanzado" })
 * trackEvent("worldcup_match_opened", { matchId: "wc26-esp-bra" })
 */
export function trackEvent(
  event: string,
  data?: Record<string, string | number | boolean>,
) {
  if (typeof window === "undefined") return
  if (!getConsent().cookies_analytics) return
  window.umami?.track(event, data)
}
