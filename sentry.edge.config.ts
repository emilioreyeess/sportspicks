/**
 * Sentry — configuración para el runtime Edge (middleware, edge route handlers).
 */
import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.05,
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === "production",
})
