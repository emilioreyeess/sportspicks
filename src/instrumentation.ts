/**
 * Next.js instrumentation hook — se ejecuta UNA vez al arrancar el servidor.
 * Aquí se activa:
 *   1. Sentry (error tracking para todos los runtimes)
 *   2. El scheduler diario del pipeline (00:00 + calentamiento al boot)
 */
export async function register() {
  // ─── Sentry ─────────────────────────────────────────────────────────────
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config")
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config")
  }

  // ─── Pipeline scheduler (solo Node.js) ──────────────────────────────────
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("./lib/pipeline")
    startScheduler()
  }
}

export const onRequestError = async (
  err: unknown,
  request: { path: string; method: string },
) => {
  // Captura errores de renderizado de server components y route handlers en Sentry
  const Sentry = await import("@sentry/nextjs")
  Sentry.captureException(err, {
    tags: {
      path: (request as { path: string }).path,
      method: (request as { method: string }).method,
    },
  })
}
