/**
 * KV Cache layer — SportsPicks Analytics
 * ════════════════════════════════════════════════════════════════════════════
 * Wraps @vercel/kv with:
 *   · Graceful degradation: if KV env vars are absent (local dev / CI) the
 *     cache is a no-op and the app falls through to direct computation.
 *   · Stale-While-Revalidate (SWR): returns stale data immediately while
 *     triggering a background refresh — keeps P99 latency low during peaks.
 *   · Typed helpers so callers never touch the raw kv client.
 *
 * TTL constants live here so they're easy to tune from one place.
 * ════════════════════════════════════════════════════════════════════════════
 */

import { kv } from "@vercel/kv"

// ─── TTL constants (seconds) ───────────────────────────────────────────────

export const TTL = {
  /** Live scoreboard — refresh aggressively (scores change every ~30s) */
  MATCHES_LIVE:     60,
  /** Pre/post matches — stale for up to 5 min is acceptable */
  MATCHES_STATIC:   300,
  /** Team season stats & form — changes once per matchday at most */
  TEAM_MODEL:       600,
  /** Single-match boxscore (completed) — immutable once final */
  MATCH_SUMMARY_FINAL: 3600,
  /** Single-match boxscore (in progress) */
  MATCH_SUMMARY_LIVE:  60,
  /** Heavy Supabase aggregations (Brier score, ROI, system stats) */
  AGGREGATION:      300,
  /** Form weights from model_performance — recomputed at cron time */
  FORM_WEIGHTS:     300,
} as const

// ─── KV availability check ─────────────────────────────────────────────────

function kvAvailable(): boolean {
  return !!(
    process.env.KV_REST_API_URL &&
    process.env.KV_REST_API_TOKEN
  )
}

// ─── Core helpers ──────────────────────────────────────────────────────────

/**
 * Get a cached value. Returns null on miss, on error, or when KV is unavailable.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!kvAvailable()) return null
  try {
    const raw = await kv.get<T>(key)
    return raw ?? null
  } catch (err) {
    console.warn("[kv] get error:", key, err)
    return null
  }
}

/**
 * Set a cached value with a TTL in seconds.
 */
export async function cacheSet<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  if (!kvAvailable()) return
  try {
    await kv.set(key, value, { ex: ttlSeconds })
  } catch (err) {
    console.warn("[kv] set error:", key, err)
  }
}

/**
 * Delete a cached key.
 */
export async function cacheDel(key: string): Promise<void> {
  if (!kvAvailable()) return
  try { await kv.del(key) } catch {}
}

// ─── SWR (Stale-While-Revalidate) ─────────────────────────────────────────

interface SWREntry<T> {
  data: T
  cachedAt: number   // epoch ms
  ttl: number        // seconds
}

function isStale<T>(entry: SWREntry<T>): boolean {
  return Date.now() - entry.cachedAt > entry.ttl * 1000
}

/**
 * cacheFetch — the main workhorse.
 *
 * 1. Cache HIT (fresh)   → return cached data immediately.
 * 2. Cache HIT (stale)   → return stale data immediately + revalidate in background.
 * 3. Cache MISS          → await fetcher(), store result, return it.
 * 4. KV unavailable      → await fetcher() and return directly (no caching).
 *
 * The `staleTtlMultiplier` controls how long stale data is still *served*
 * (default 2× = stale data served up to 2× the TTL before forcing a fresh
 * fetch). Set to 1 to disable SWR and use strict TTL semantics.
 */
export async function cacheFetch<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
  staleTtlMultiplier = 2,
): Promise<T> {
  if (!kvAvailable()) return fetcher()

  try {
    const entry = await kv.get<SWREntry<T>>(key)

    if (entry) {
      const stale = isStale(entry)
      if (!stale) {
        // Fresh — return immediately
        return entry.data
      }

      // Stale — return stale data now, refresh in background
      // We use waitUntil-style fire-and-forget (Vercel Edge/Node both support it)
      const refreshPromise = fetcher().then(async (fresh) => {
        const newEntry: SWREntry<T> = {
          data: fresh,
          cachedAt: Date.now(),
          ttl: ttlSeconds,
        }
        // Serve stale for up to staleTtlMultiplier × TTL before forcing
        await kv.set(key, newEntry, { ex: ttlSeconds * staleTtlMultiplier })
      }).catch((err) => {
        console.warn("[kv] SWR background refresh failed:", key, err)
      })

      // Don't block the response on the refresh
      void refreshPromise

      return entry.data
    }
  } catch (err) {
    console.warn("[kv] cacheFetch read error:", key, err)
    // Fall through to direct fetch
  }

  // Cache miss — fetch, store, return
  const data = await fetcher()
  const entry: SWREntry<T> = { data, cachedAt: Date.now(), ttl: ttlSeconds }
  // Store with staleTtlMultiplier to support SWR window
  await cacheSet(key, entry, ttlSeconds * staleTtlMultiplier)
  return data
}

// ─── Cache key builders (centralised to avoid typos) ──────────────────────

export const CK = {
  matchesToday:    (dateKey: string)               => `espn:today:${dateKey}`,
  teamModel:       (slug: string, teamId: string)  => `espn:team:${slug}:${teamId}`,
  matchSummary:    (slug: string, matchId: string) => `espn:summary:${slug}:${matchId}`,
  systemStats:     ()                              => `agg:system-stats`,
  roi:             (days: number)                  => `agg:roi:${days}`,
  formWeights:     (scope: string, key: string)    => `ml:form:${scope}:${key}`,
  picks:           (date: string)                  => `picks:${date}`,
} as const
