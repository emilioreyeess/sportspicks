import { NextResponse, type NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/middleware-session"

/**
 * Security headers — applied to all routes except static assets.
 * CSP is strict but compatible with Next.js (allows inline scripts for hydration).
 * Además refresca la cookie de sesión de Supabase Auth (@supabase/ssr).
 */
export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  // ── Standard security headers ─────────────────────────────────────────────
  res.headers.set("X-Content-Type-Options", "nosniff")
  res.headers.set("X-Frame-Options", "DENY")
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()")
  res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")
  res.headers.set("X-DNS-Prefetch-Control", "off")
  res.headers.set("X-Permitted-Cross-Domain-Policies", "none")

  // CN-015: CSP is defined only in next.config.js headers() to avoid duplicates.
  // Middleware sets the remaining security headers; CSP comes from next.config.js.

  // ── Refresco de sesión Supabase (escribe cookies sobre `res`) ─────────────
  return await updateSession(req, res)
}

// Skip static assets, images, favicon, manifest
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest).*)"],
}
