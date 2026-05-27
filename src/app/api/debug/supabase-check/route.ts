/**
 * GET /api/debug/supabase-check
 * DESACTIVADO — endpoint de diagnóstico eliminado de producción.
 * Era un riesgo de seguridad: exponía estado de env vars e insertaba datos de prueba en DB.
 * Ver FIXES_IMPLEMENTED.md para detalles.
 */
export const runtime = "nodejs"

export async function GET() {
  return Response.json({ error: "Not found" }, { status: 404 })
}
