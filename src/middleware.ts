import { type NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/middleware-session"

/**
 * Middleware: refresca la cookie de sesión de Supabase (patrón oficial @supabase/ssr)
 * y aplica los security headers sobre la misma respuesta. Toda la lógica de
 * cookies vive en updateSession para no romper la cadena de Set-Cookie.
 */
export async function middleware(req: NextRequest) {
  return await updateSession(req)
}

// Skip static assets, images, favicon, manifest
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest).*)"],
}
