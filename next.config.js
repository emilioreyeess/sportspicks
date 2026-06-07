// @ts-check
const { withSentryConfig } = require("@sentry/nextjs")

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "media.api-sports.io" },
      { protocol: "https", hostname: "*.api-sports.io" },
      // ESPN media CDN (logos de equipos, banderas)
      { protocol: "https", hostname: "a.espncdn.com" },
      { protocol: "https", hostname: "a1.espncdn.com" },
      { protocol: "https", hostname: "a2.espncdn.com" },
      // Google profile photos (NextAuth)
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "lh4.googleusercontent.com" },
      { protocol: "https", hostname: "lh5.googleusercontent.com" },
      { protocol: "https", hostname: "lh6.googleusercontent.com" },
    ],
  },

  // ─── Security Headers ─────────────────────────────────────────────────────
  async headers() {
    // CN-028: 'unsafe-eval' NUNCA en producción. Pero el Fast Refresh de Next.js
    // en desarrollo evalúa strings como JS (HMR) → requiere 'unsafe-eval' SOLO en dev.
    const isDev = process.env.NODE_ENV !== "production"
    const scriptSrc = [
      "script-src 'self' 'unsafe-inline'",
      isDev ? "'unsafe-eval'" : "",
      "https://js.stripe.com https://analytics.umami.is https://*.sentry.io",
    ].filter(Boolean).join(" ")

    const ContentSecurityPolicy = [
      "default-src 'self'",
      // Scripts: propios + inline (Next.js lo necesita) + Stripe + Umami.
      // 'unsafe-eval' se añade arriba solo en desarrollo (HMR).
      scriptSrc,
      "style-src 'self' 'unsafe-inline'",
      // Imágenes: propias + data URIs + blob + ESPN CDN + Supabase storage
      "img-src 'self' data: blob: https://a.espncdn.com https://a1.espncdn.com https://a2.espncdn.com https://media.api-sports.io https://*.api-sports.io https://*.supabase.co https://*.googleusercontent.com",
      "font-src 'self'",
      // Frames: Stripe solamente
      "frame-src https://js.stripe.com https://hooks.stripe.com",
      // Conexiones: propias + Supabase + Stripe + Umami + Sentry + ESPN
      [
        "connect-src 'self'",
        "https://*.supabase.co",
        "wss://*.supabase.co",
        "https://api.stripe.com",
        "https://analytics.umami.is",
        "https://*.sentry.io",
        "https://o*.ingest.sentry.io",
        "https://site.api.espn.com",
      ].join(" "),
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self' https://checkout.stripe.com",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join("; ")

    return [
      {
        source: "/(.*)",
        headers: [
          // Previene clickjacking
          { key: "X-Frame-Options", value: "DENY" },
          // Previene MIME sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Referrer mínimo en cross-origin
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Deshabilitar APIs innecesarias
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
          // HSTS: fuerza HTTPS durante 2 años, incluye subdominios, pre-cargable
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          // CSP
          { key: "Content-Security-Policy", value: ContentSecurityPolicy },
          // Ocultar tecnología del servidor
          { key: "X-Powered-By", value: "" },
        ],
      },
    ]
  },
}

// ─── Sentry wrapper ──────────────────────────────────────────────────────────
module.exports = withSentryConfig(nextConfig, {
  // Org y project de Sentry (configurar en .env o Vercel)
  org: process.env.SENTRY_ORG ?? "sportspicks",
  project: process.env.SENTRY_PROJECT ?? "frontend",
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Subir source maps en build para stack traces legibles en Sentry
  silent: true,            // no spamear el log de build
  hideSourceMaps: true,    // no exponer source maps en el bundle público

  // Túnel para evitar que ad-blockers rompan el SDK en producción
  tunnelRoute: "/monitoring",

  // Opciones recientes (Sentry 10+): viven dentro de `webpack`
  webpack: {
    treeshake: { removeDebugLogging: true },   // sustituye disableLogger
    automaticVercelMonitors: true,             // sustituye automaticVercelMonitors top-level
  },
})
