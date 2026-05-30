"use client"

/**
 * ConditionalAdSense — carga Google AdSense (Auto Ads) solo si:
 *   1. El usuario ha dado consentimiento de marketing (GDPR)
 *   2. El usuario NO tiene un plan premium (premium = experiencia sin anuncios)
 *
 * Usa el mismo patrón que ConditionalAnalytics para respetar cookies_marketing.
 * Los Auto Ads de Google gestionan la colocación automáticamente.
 *
 * Publisher ID: ca-pub-9944234338041841
 */

import { useEffect, useState } from "react"
import Script from "next/script"
import { getConsent } from "@/lib/compliance"
import { usePlan } from "@/lib/plan"

const ADSENSE_PUBLISHER_ID = "ca-pub-9944234338041841"
const ADSENSE_SRC = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_PUBLISHER_ID}`

export function ConditionalAdSense() {
  const { isPremium } = usePlan()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Premium users never see ads
    if (isPremium) return

    // Comprueba consentimiento de marketing guardado
    if (getConsent().cookies_marketing) {
      setReady(true)
      return
    }

    // Escucha si el usuario acepta cookies durante la sesión
    const onGrant = () => {
      if (getConsent().cookies_marketing) setReady(true)
    }
    window.addEventListener("consent-granted", onGrant)
    return () => window.removeEventListener("consent-granted", onGrant)
  }, [isPremium])

  // No cargar para usuarios premium o sin consentimiento
  if (!ready || isPremium) return null

  return (
    <Script
      src={ADSENSE_SRC}
      strategy="afterInteractive"
      crossOrigin="anonymous"
      onError={(e) => {
        // Silenciar errores de AdBlock — es normal
        console.debug("[AdSense] Script blocked or failed:", e)
      }}
    />
  )
}
