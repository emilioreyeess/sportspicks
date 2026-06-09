/**
 * Stub de compatibilidad para CLIENTES con el bundle ANTIGUO de NextAuth cacheado.
 * ───────────────────────────────────────────────────────────────────────────
 * Tras migrar a Supabase Auth, las pestañas/PWA con el bundle viejo siguen
 * haciendo polling a /api/auth/session, /api/auth/providers, /api/auth/_log,
 * /api/auth/csrf, etc. Sin este stub esas rutas dan 404 (HTML) y el cliente
 * next-auth/react ejecuta res.json() sobre HTML → SyntaxError → Error Boundary
 * ("Algo se rompió cargando la app").
 *
 * Devolviendo JSON 200 vacío, el cliente viejo lo interpreta como "sin sesión"
 * y degrada con gracia (muestra login) en vez de crashear. La ruta estática
 * /api/auth/plan tiene prioridad sobre este catch-all, así que no se ve afectada.
 *
 * TEMPORAL: eliminar en unas semanas, cuando las cachés antiguas hayan expirado.
 */
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// NextAuth v4 devuelve {} para "sesión vacía"; el cliente lo trata como null.
function emptyJson() {
  return NextResponse.json({}, { status: 200, headers: { "Cache-Control": "no-store" } })
}

export async function GET() {
  return emptyJson()
}

export async function POST() {
  return emptyJson()
}

export async function HEAD() {
  return emptyJson()
}
