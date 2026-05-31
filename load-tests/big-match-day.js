/**
 * K6 Load Test — "Big Match Day" scenario
 * ════════════════════════════════════════════════════════════════════════════
 * Simulates the peak traffic pattern before a Champions League match:
 * thousands of users arriving in a 15-minute window to check today's matches,
 * query odds, and open their group rankings.
 *
 * Usage:
 *   k6 run load-tests/big-match-day.js
 *   k6 run --env TARGET=https://sportspicks.app load-tests/big-match-day.js
 *   k6 run --env TARGET=http://localhost:3000 --vus 50 load-tests/big-match-day.js
 *
 * What it measures:
 *   · P95 / P99 response time per endpoint
 *   · Error rate (target < 1%)
 *   · Cache absorption rate (X-Cache header or response time distribution)
 *   · Throughput (req/s)
 *
 * Pass/Fail thresholds (CI-compatible):
 *   · P95 < 800ms  for cached endpoints (/api/matches/today)
 *   · P95 < 3000ms for DB endpoints (/api/groups, /api/bets)
 *   · Error rate < 1%
 * ════════════════════════════════════════════════════════════════════════════
 */

import http from "k6/http"
import { check, group, sleep } from "k6"
import { Rate, Trend, Counter } from "k6/metrics"

// ─── Configuration ─────────────────────────────────────────────────────────

const TARGET = __ENV.TARGET || "https://sportspicks.app"

// Simulated auth tokens (set via env or use anonymous flows)
// For endpoints requiring auth, pass a real session cookie or Bearer token.
const AUTH_COOKIE = __ENV.AUTH_COOKIE || ""
const CRON_SECRET = __ENV.CRON_SECRET || ""

// ─── Custom metrics ────────────────────────────────────────────────────────

const errorRate        = new Rate("http_error_rate")
const cacheHitRate     = new Rate("cache_hit_rate")
const matchesTodayTime = new Trend("matches_today_ms", true)
const analysisTime     = new Trend("match_analysis_ms", true)
const groupsTime       = new Trend("groups_ms", true)
const betsTime         = new Trend("bets_ms", true)
const cachedResponses  = new Counter("cached_responses_total")
const uncachedResponses = new Counter("uncached_responses_total")

// ─── Load profile ──────────────────────────────────────────────────────────
// Simulates the 15-minute traffic surge before kick-off:
//   00:00–02:00 → ramp from 0 → 200 VUs  (early arrivals)
//   02:00–05:00 → ramp from 200 → 800 VUs (main surge)
//   05:00–10:00 → hold at 800 VUs         (peak)
//   10:00–13:00 → ramp from 800 → 1000 VUs (kick-off spike)
//   13:00–15:00 → hold at 1000 VUs         (first 15 min of game)
//   15:00–20:00 → ramp down to 200 VUs     (game in progress)
//   20:00–25:00 → ramp down to 0           (cool-down)

export const options = {
  scenarios: {
    big_match_day: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "2m",  target: 200  },   // early arrivals
        { duration: "3m",  target: 800  },   // main surge
        { duration: "5m",  target: 800  },   // peak sustained
        { duration: "3m",  target: 1000 },   // kick-off spike
        { duration: "2m",  target: 1000 },   // first 15 min
        { duration: "5m",  target: 200  },   // game in progress
        { duration: "5m",  target: 0    },   // cool-down
      ],
      gracefulRampDown: "30s",
    },
  },

  thresholds: {
    // Cached endpoint — should be very fast with KV
    "matches_today_ms":     ["p(95)<800",  "p(99)<2000"],
    // DB-backed endpoints — acceptable up to 3s P95
    "groups_ms":            ["p(95)<3000", "p(99)<6000"],
    "bets_ms":              ["p(95)<3000", "p(99)<6000"],
    // Match analysis (ESPN + Poisson — should cache after first call)
    "match_analysis_ms":    ["p(95)<5000", "p(99)<12000"],
    // Global error rate
    "http_error_rate":      ["rate<0.01"],  // < 1% errors
    // HTTP built-ins
    "http_req_failed":      ["rate<0.01"],
    "http_req_duration":    ["p(95)<4000"],
  },
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function baseHeaders(auth = false) {
  const h = {
    "User-Agent": "K6-LoadTest/1.0 SportsPicks-BigMatchDay",
    "Accept":     "application/json",
  }
  if (auth && AUTH_COOKIE) {
    h["Cookie"] = AUTH_COOKIE
  }
  return h
}

function isFromCache(res) {
  // Vercel KV cache hit can be inferred by very fast response time (<50ms)
  // or by a custom header if we add one (X-Cache: HIT)
  const xCache = res.headers["X-Cache"] || res.headers["x-cache"] || ""
  if (xCache.includes("HIT")) return true
  // Heuristic: if response < 50ms, very likely from KV cache
  return res.timings.duration < 50
}

function recordCacheMetric(res) {
  if (isFromCache(res)) {
    cacheHitRate.add(1)
    cachedResponses.add(1)
  } else {
    cacheHitRate.add(0)
    uncachedResponses.add(1)
  }
}

// ─── Sample data for realistic requests ────────────────────────────────────

// Real ESPN team IDs for top clubs (for match analysis tests)
const TEAM_PAIRS = [
  { slug: "eng.1", home: "359",  away: "360"  },   // Man City vs Arsenal
  { slug: "esp.1", home: "86",   away: "243"  },   // Real Madrid vs Barcelona
  { slug: "ger.1", home: "132",  away: "134"  },   // Bayern vs Dortmund
  { slug: "ita.1", home: "111",  away: "109"  },   // Juventus vs Inter Milan
  { slug: "fra.1", home: "160",  away: "161"  },   // PSG vs Marseille
  { slug: "uefa.champions", home: "86", away: "359" },
]

const FAKE_GROUP_IDS = [
  "00000000-0000-0000-0000-000000000001",
  "00000000-0000-0000-0000-000000000002",
]

// ─── Main virtual user scenario ────────────────────────────────────────────

export default function () {
  // Each VU runs through a weighted flow simulating real user behavior:
  // 60% open "Partidos de Hoy" → 30% open match analysis → 20% check groups

  const flow = Math.random()

  // ── Flow 1: View today's matches (most common — 100% of users hit this) ──
  group("matches_today", () => {
    const res = http.get(`${TARGET}/api/matches/today`, {
      headers: baseHeaders(),
      tags: { endpoint: "matches_today" },
    })

    const ok = check(res, {
      "status 200":         (r) => r.status === 200,
      "has matches array":  (r) => {
        try { return Array.isArray(JSON.parse(r.body).matches) } catch { return false }
      },
      "response < 2s":      (r) => r.timings.duration < 2000,
    })

    errorRate.add(!ok)
    matchesTodayTime.add(res.timings.duration)
    recordCacheMetric(res)
  })

  sleep(0.5)

  // ── Flow 2: Open match analysis (30% of users) ───────────────────────────
  if (flow < 0.3) {
    group("match_analysis", () => {
      const pair = TEAM_PAIRS[Math.floor(Math.random() * TEAM_PAIRS.length)]
      const qs = new URLSearchParams({
        id:    `test${Math.floor(Math.random() * 9000) + 1000}`,   // synthetic match ID
        slug:  pair.slug,
        home:  pair.home,
        away:  pair.away,
        hname: "Home FC",
        aname: "Away FC",
      })

      const res = http.get(`${TARGET}/api/matches/analysis?${qs}`, {
        headers: baseHeaders(),
        tags: { endpoint: "match_analysis" },
      })

      check(res, {
        "status 200 or 400": (r) => r.status === 200 || r.status === 400,
        "response < 15s":    (r) => r.timings.duration < 15000,
      })

      errorRate.add(res.status >= 500)
      analysisTime.add(res.timings.duration)
    })
    sleep(1)
  }

  // ── Flow 3: Check groups (20% of authenticated users) ────────────────────
  if (flow < 0.2 && AUTH_COOKIE) {
    group("groups", () => {
      const res = http.get(`${TARGET}/api/groups`, {
        headers: baseHeaders(true),
        tags: { endpoint: "groups" },
      })

      check(res, {
        "status 200 or 401": (r) => r.status === 200 || r.status === 401,
        "response < 3s":     (r) => r.timings.duration < 3000,
      })

      errorRate.add(res.status >= 500)
      groupsTime.add(res.timings.duration)
    })
    sleep(0.5)
  }

  // ── Flow 4: Check bets history (15% of authenticated users) ──────────────
  if (flow < 0.15 && AUTH_COOKIE) {
    group("bets", () => {
      const res = http.get(`${TARGET}/api/bets`, {
        headers: baseHeaders(true),
        tags: { endpoint: "bets" },
      })

      check(res, {
        "status 200 or 401": (r) => r.status === 200 || r.status === 401,
        "response < 3s":     (r) => r.timings.duration < 3000,
      })

      errorRate.add(res.status >= 500)
      betsTime.add(res.timings.duration)
    })
    sleep(0.5)
  }

  // ── Flow 5: Check picks feed (50% of users) ───────────────────────────────
  if (flow < 0.5) {
    group("picks", () => {
      const res = http.get(`${TARGET}/api/picks`, {
        headers: baseHeaders(),
        tags: { endpoint: "picks" },
      })

      check(res, {
        "status 200": (r) => r.status === 200,
        "response < 1s": (r) => r.timings.duration < 1000,
      })

      errorRate.add(res.status >= 500)
    })
    sleep(0.2)
  }

  // Think time between page views (realistic user browsing pace: 2-8s)
  sleep(2 + Math.random() * 6)
}

// ─── Setup: warm the cache before the test starts ──────────────────────────

export function setup() {
  if (CRON_SECRET) {
    const res = http.get(`${TARGET}/api/cron/warm-cache`, {
      headers: {
        "Authorization": `Bearer ${CRON_SECRET}`,
        "User-Agent": "K6-Setup/1.0",
      },
    })
    console.log(`[setup] Cache warm: ${res.status} (${res.timings.duration}ms)`)
  } else {
    console.log("[setup] CRON_SECRET not set — skipping cache warm (set --env CRON_SECRET=...)")
  }
  // Give the app a moment to settle after prewarm
  sleep(2)
}

// ─── Teardown: print cache stats ───────────────────────────────────────────

export function teardown(data) {
  // Summary is automatically printed by K6 based on metrics above.
  // Key metrics to check after the test:
  //   · cache_hit_rate     → should be > 80% for /api/matches/today during peak
  //   · http_error_rate    → target < 1%
  //   · matches_today_ms   → P95 < 800ms (KV-cached)
  //   · groups_ms          → P95 < 3000ms (DB via RPC)
  console.log("Test completed. Check thresholds summary above.")
}
