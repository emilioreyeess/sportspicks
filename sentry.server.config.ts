/**
 * Sentry — configuración del SDK en el servidor Node.js (Server Components, route handlers).
 * Este archivo se importa automáticamente por Next.js al compilar el bundle servidor.
 */
import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Tracing: 5% para no superar cuotas del plan gratuito
  tracesSampleRate: 0.05,

  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === "production",

  // No capturar errores de rate-limiting esperados (son operacionales, no bugs)
  beforeSend(event) {
    const msg = event.exception?.values?.[0]?.value ?? ""
    if (msg.includes("Too Many Requests") || msg.includes("rate limit")) return null
    return event
  },
})
