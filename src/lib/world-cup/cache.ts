/**
 * World Cup 2026 — Cache layer (Upstash KV con fallback a memoria).
 *
 * TTLs por tipo:
 *  - Teams (estable):           24 h
 *  - Squads (cambian poco):     12 h
 *  - Form (puede actualizarse):  6 h
 *  - Group standings (live):     2 h
 *  - Fixtures (calendario):     12 h
 *  - Match center (live mix):    1 h
 *  - Referee stats (curado):    72 h
 *  - Dark horses (computed):     6 h
 *
 * Patrón:
 *   const cached = await cacheGet<T>("ns:key")
 *   if (cached) return cached
 *   const fresh = await fetchSomething()
 *   await cacheSet("ns:key", fresh, TTL.FORM)
 *   return fresh
 */

export const WC_CACHE_TTL = {
  TEAMS:    24 * 3600,
  SQUAD:    12 * 3600,
  FORM:      6 * 3600,
  STANDINGS: 2 * 3600,
  FIXTURES: 12 * 3600,
  MATCH:     1 * 3600,
  REFEREE:  72 * 3600,
  DARK_HORSES: 6 * 3600,
} as const

// ─── KV con fallback a memoria ────────────────────────────────────────────────

interface KVClient {
  get<T = unknown>(key: string): Promise<T | null>
  set(key: string, value: unknown, opts?: { ex?: number }): Promise<unknown>
  del(key: string): Promise<unknown>
}

let kvClient: KVClient | null = null
let kvLoadAttempted = false

async function getKV(): Promise<KVClient | null> {
  if (kvLoadAttempted) return kvClient
  kvLoadAttempted = true
  if (!process.env.KV_REST_API_URL && !process.env.KV_URL) return null
  try {
    const mod = await import("@vercel/kv")
    kvClient = mod.kv as unknown as KVClient
    return kvClient
  } catch {
    return null
  }
}

// Memory fallback con TTL real
interface MemEntry { value: unknown; expiresAt: number }
const memoryCache = new Map<string, MemEntry>()

function memGet<T>(key: string): T | null {
  const entry = memoryCache.get(key)
  if (!entry) return null
  if (entry.expiresAt < Date.now()) {
    memoryCache.delete(key)
    return null
  }
  return entry.value as T
}

function memSet(key: string, value: unknown, ttlSeconds: number): void {
  memoryCache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 })
}

// ─── API pública ──────────────────────────────────────────────────────────────

const NAMESPACE = "wc26"

function nsKey(key: string): string {
  return `${NAMESPACE}:${key}`
}

export async function cacheGet<T = unknown>(key: string): Promise<T | null> {
  const k = nsKey(key)
  const kv = await getKV()
  if (kv) {
    try {
      const v = await kv.get<T>(k)
      return v ?? null
    } catch {
      // KV temporal fail → fallback a memoria
    }
  }
  return memGet<T>(k)
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const k = nsKey(key)
  const kv = await getKV()
  if (kv) {
    try {
      await kv.set(k, value, { ex: ttlSeconds })
      return
    } catch {
      // KV temporal fail → caer a memoria
    }
  }
  memSet(k, value, ttlSeconds)
}

export async function cacheInvalidate(key: string): Promise<void> {
  const k = nsKey(key)
  const kv = await getKV()
  if (kv) {
    try { await kv.del(k) } catch { /* noop */ }
  }
  memoryCache.delete(k)
}

/** Helper: get-or-compute con caching automático */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  compute: () => Promise<T>,
): Promise<T> {
  const hit = await cacheGet<T>(key)
  if (hit !== null) return hit
  const fresh = await compute()
  if (fresh !== null && fresh !== undefined) {
    await cacheSet(key, fresh, ttlSeconds)
  }
  return fresh
}
