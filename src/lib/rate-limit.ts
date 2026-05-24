/**
 * Rate limit en memoria — token-bucket por clave (normalmente IP).
 *
 * Funciona perfecto en single-instance (despliegue actual en Docker).
 * Para multi-instancia/horizontal habría que migrarlo a Redis (ya está en compose).
 * Contrato mínimo (check/refill) → fácil de cambiar la implementación más adelante.
 */

interface Bucket { tokens: number; lastRefill: number }
const buckets = new Map<string, Bucket>()

// Limpieza periódica para evitar crecimiento ilimitado de IPs antiguas
const TTL_MS = 24 * 3600_000
setInterval(() => {
  const cutoff = Date.now() - TTL_MS
  for (const [k, b] of buckets) {
    if (b.lastRefill < cutoff) buckets.delete(k)
  }
}, 3600_000)

/**
 * Devuelve true si la petición pasa el límite (consume 1 token).
 * - `capacity`: tokens máximos almacenables (= ráfaga máxima)
 * - `refillPerMin`: tokens recargados por minuto (= ritmo sostenible)
 */
export function consume(key: string, capacity: number, refillPerMin: number): boolean {
  const now = Date.now()
  const b = buckets.get(key) ?? { tokens: capacity, lastRefill: now }
  const elapsedMin = (now - b.lastRefill) / 60_000
  b.tokens = Math.min(capacity, b.tokens + elapsedMin * refillPerMin)
  b.lastRefill = now
  if (b.tokens >= 1) {
    b.tokens -= 1
    buckets.set(key, b)
    return true
  }
  buckets.set(key, b)
  return false
}

/** Saca la IP real del cliente desde cabeceras (compatibles con proxies habituales). */
export function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for")
  if (fwd) return fwd.split(",")[0].trim()
  const real = req.headers.get("x-real-ip")
  if (real) return real
  return "anonymous"
}

/** Helper para devolver respuesta 429 estándar. */
export function tooManyRequests(retrySec = 60): Response {
  return new Response(
    JSON.stringify({ error: "Demasiadas peticiones. Espera un momento e inténtalo de nuevo." }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retrySec),
      },
    },
  )
}
