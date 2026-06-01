/**
 * Sentry — configuración del SDK en el navegador (Client Components).
 * Sentry lo carga automáticamente desde `instrumentation-client.ts`
 * en la raíz del proyecto (sustituye al antiguo `sentry.client.config.ts`).
 */
import * as Sentry from "@sentry/nextjs"

// Instrumentar transiciones de App Router para tracing de navegación
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Porcentaje de sesiones grabadas para Session Replay (0 en producción salvo debugging activo)
  replaysSessionSampleRate: 0,
  // Captura el 100% de las sesiones con error para diagnosticar problemas
  replaysOnErrorSampleRate: 1.0,

  // Tracing: 5% de las peticiones para no consumir quota en el plan gratuito
  tracesSampleRate: 0.05,

  // Entorno para separar errores de preview vs. producción
  environment: process.env.NODE_ENV,

  // No enviar errores en desarrollo local (consola ya los muestra)
  enabled: process.env.NODE_ENV === "production",

  // Filtrar errores que no nos interesan (red, extensiones de navegador, etc.)
  beforeSend(event) {
    // Ignorar errores de extensiones de Chrome/Firefox
    if (event.exception?.values?.[0]?.stacktrace?.frames?.some(
      (f) => f.filename?.includes("chrome-extension://") || f.filename?.includes("moz-extension://")
    )) {
      return null
    }
    return event
  },
})
