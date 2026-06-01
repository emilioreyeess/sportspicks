"use client"

/**
 * Next.js App Router — global root error boundary.
 * Diferente a error.tsx: este reemplaza el root layout cuando un error
 * ocurre durante el render del propio root layout, así que debe declarar
 * <html> y <body>. Requerido por Sentry para capturar React render errors
 * en App Router.
 */
import { useEffect } from "react"
import * as Sentry from "@sentry/nextjs"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="es">
      <body style={{
        margin: 0,
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        background: "#09090b",
        color: "#fafafa",
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "1.5rem",
      }}>
        <div style={{
          maxWidth: 420,
          width: "100%",
          background: "rgba(24, 24, 27, 0.7)",
          borderRadius: 24,
          border: "1px solid rgba(255,255,255,0.06)",
          padding: "1.75rem",
          textAlign: "center",
        }}>
          <div style={{ fontSize: "2.75rem", marginBottom: "0.5rem" }}>😕</div>
          <h2 style={{
            fontSize: "1.25rem",
            fontWeight: 700,
            margin: 0,
            letterSpacing: "-0.02em",
          }}>
            Algo se rompió cargando la app
          </h2>
          <p style={{
            fontSize: "0.875rem",
            color: "#a1a1aa",
            lineHeight: 1.55,
            marginTop: 8,
            marginBottom: 20,
          }}>
            Estamos sobre ello. Reintenta o vuelve al inicio.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={reset}
              style={{
                flex: 1,
                minWidth: 120,
                padding: "0.75rem 1rem",
                borderRadius: 12,
                background: "linear-gradient(90deg, #52b591, #4db3c3)",
                color: "#09090b",
                fontWeight: 700,
                fontSize: "0.875rem",
                border: "none",
                cursor: "pointer",
              }}
            >
              Reintentar
            </button>
            <a
              href="/"
              style={{
                flex: 1,
                minWidth: 120,
                padding: "0.75rem 1rem",
                borderRadius: 12,
                background: "rgba(255,255,255,0.06)",
                color: "#fafafa",
                fontWeight: 600,
                fontSize: "0.875rem",
                textDecoration: "none",
                display: "grid",
                placeItems: "center",
              }}
            >
              Ir al inicio
            </a>
          </div>
        </div>
      </body>
    </html>
  )
}
