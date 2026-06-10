import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import { JsonLd } from "@/components/seo/JsonLd"
import { TrustpilotReviewToast } from "@/components/reviews/TrustpilotReviewToast"
import { AppShell } from "@/components/ui/AppShell"
import { AgeGate } from "@/components/legal/AgeGate"
import { CookieConsent } from "@/components/legal/CookieConsent"
import { SafariInstallBanner } from "@/components/ui/SafariInstallBanner"
import { ConditionalAnalytics } from "@/components/analytics/ConditionalAnalytics"
import { ConditionalAdSense } from "@/components/ads/ConditionalAdSense"
import { PlanProvider } from "@/lib/plan"
import { SessionWrapper } from "@/components/ui/SessionWrapper"
import { LoginWall } from "@/components/ui/LoginWall"
import "./globals.css"

const inter = Inter({ subsets: ["latin"], display: "swap" })

export const viewport: Viewport = {
  themeColor: "#09090b",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  // maximumScale y userScalable eliminados — penalizaban accesibilidad y Mobile Usability score
  viewportFit: "cover",
}

export const metadata: Metadata = {
  metadataBase: new URL("https://sportspicks.app"),
  applicationName: "SportsPicks Analytics",
  title: {
    template: "%s · SportsPicks Analytics",
    default: "SportsPicks Analytics — Análisis deportivo cuantitativo",
  },
  description:
    "Plataforma de análisis deportivo cuantitativo. Value picks con cuotas reales, modelo estadístico Poisson y motor de motivación. Contenido informativo, no es una casa de apuestas. +18.",
  // keywords eliminado — Google lo ignora desde 2009, aumenta peso HTML sin beneficio
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/icon.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SportsPicks",
  },
  formatDetection: { telephone: false },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "es_ES",
    siteName: "SportsPicks Analytics",
    title: "SportsPicks Analytics — Análisis deportivo cuantitativo",
    description:
      "Value picks con cuotas reales, modelo estadístico y motor de motivación. Cero datos inventados.",
  },
  twitter: {
    card: "summary_large_image",
    title: "SportsPicks Analytics",
    description: "Análisis deportivo cuantitativo con datos reales. Value picks, combinadas y bot IA.",
    images: ["/opengraph-image.png"],
  },
  category: "sports",
  // Metadatos de verificación — Next.js los renderiza como <meta> en el <head>
  // (vía Metadata API, sin HTML crudo → sin riesgo de hidratación).
  other: {
    "google-adsense-account": "ca-pub-9944234338041841",
    "trustpilot-one-time-domain-verification-id": "c0849222-360e-48af-b14d-a7bbc22e990a",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark">
      <head>
        {/* Schema.org base — Organization + WebSite. Server Component, 0 JS cliente. */}
        <JsonLd />
        {/* DIAGNÓSTICO + KILL-SWITCH (consola del navegador):
            1. Imprime la versión de build (commit + render) para verificar que el
               cliente está viendo el deploy actual y no un build cacheado.
            2. Desregistra cualquier Service Worker zombie de builds antiguos y
               purga Cache Storage — un SW viejo sirve la app entera desactualizada
               ("ignora los commits") aunque el servidor esté al día. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `console.log("VERSIÓN DE BUILD: ${process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local"} · render ${new Date().toISOString()}");
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then(function (rs) {
    if (rs.length) console.warn("[SW kill-switch] desregistrando", rs.length, "service worker(s) zombie");
    rs.forEach(function (r) { r.unregister(); });
  }).catch(function () {});
}
if (window.caches && caches.keys) {
  caches.keys().then(function (keys) {
    if (keys.length) console.warn("[SW kill-switch] purgando", keys.length, "cache(s):", keys.join(","));
    keys.forEach(function (k) { caches.delete(k); });
  }).catch(function () {});
}`,
          }}
        />
      </head>
      <body className={`${inter.className} bg-zinc-950 text-white antialiased`}>
        <SessionWrapper>
          <PlanProvider>
            <AgeGate>
              <LoginWall>
                <AppShell>{children}</AppShell>
                <CookieConsent />
                <SafariInstallBanner />
                <TrustpilotReviewToast />
                <ConditionalAnalytics />
                <ConditionalAdSense />
              </LoginWall>
            </AgeGate>
          </PlanProvider>
        </SessionWrapper>
      </body>
    </html>
  )
}
