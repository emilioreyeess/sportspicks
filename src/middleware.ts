import { NextResponse, type NextRequest } from "next/server"

/**
 * Cabeceras de seguridad globales. Se aplican a todas las rutas (HTML + API)
 * salvo assets estáticos. CSP intencionadamente conservadora para no romper Next.
 */
export function middleware(_req: NextRequest) {
  const res = NextResponse.next()
  res.headers.set("X-Content-Type-Options", "nosniff")
  res.headers.set("X-Frame-Options", "DENY")
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()")
  res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
  res.headers.set("X-DNS-Prefetch-Control", "off")
  // Anti-clickjacking redundante con X-Frame-Options
  res.headers.set("Content-Security-Policy", "frame-ancestors 'none'")
  return res
}

// No aplicar a assets estáticos / imágenes optimizadas / favicon
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest).*)"],
}
