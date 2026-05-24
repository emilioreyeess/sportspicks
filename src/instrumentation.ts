/**
 * Next.js instrumentation hook — se ejecuta UNA vez al arrancar el servidor.
 * Aquí se activa el scheduler diario del pipeline (00:00 + calentamiento al boot).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("./lib/pipeline")
    startScheduler()
  }
}
