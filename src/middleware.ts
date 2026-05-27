import { NextResponse, type NextRequest } from "next/server"

/**
 * Security headers — applied to all routes except static assets.
 * CSP is strict but compatible with Next.js (allows inline scripts for hydration).
 */
export function middleware(_req: NextRequest) {
  const res = NextResponse.next()

  // ── Standard security headers ─────────────────────────────────────────────
  res.headers.set("X-Content-Type-Options", "nosniff")
  res.headers.set("X-Frame-Options", "DENY")
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()")
  res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")
  res.headers.set("X-DNS-Prefetch-Control", "off")
  res.headers.set("X-Permitted-Cross-Domain-Policies", "none")

  // ── Content Security Policy ───────────────────────────────────────────────
  // Note: 'unsafe-inline' for scripts is required by Next.js hydration (inline <script> tags).
  // Remove 'unsafe-inline' only when migrating to nonce-based CSP with next.config.js nonces.
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",   // unsafe-eval needed for Next.js dev + some libs
    "style-src 'self' 'unsafe-inline'",                   // unsafe-inline needed for Tailwind/CSS-in-JS
    "img-src 'self' data: blob: https:",                  // https: allows external avatars/images
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co https://api.stripe.com wss://*.supabase.co",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; ")

  res.headers.set("Content-Security-Policy", csp)

  return res
}

// Skip static assets, images, favicon, manifest
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest).*)"],
}
