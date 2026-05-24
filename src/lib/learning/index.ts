/**
 * API pública del Learning Engine.
 *
 * Re-exporta todo lo que necesita el resto de la app + helpers de alto nivel.
 */

export * from "./types"
export { getLearningStorage } from "./storage"
export { detectPatterns, getProbAdjustmentFor } from "./pattern-detector"
export { planAdjustments, applyAdjustments } from "./weight-adjuster"
export { runDailyLearning, type RunResult } from "./daily-job"

import type { WeightsConfig, Pattern, PickRecord } from "./types"
import { DEFAULT_WEIGHTS } from "./types"
import { getLearningStorage } from "./storage"
import { getProbAdjustmentFor } from "./pattern-detector"

// ─────────────────────────────────────────────────────────────────────────────
// Helpers cacheados para uso en runtime de pipeline.ts / decision-engine.ts
// El cache se refresca cada N minutos para no saturar KV
// ─────────────────────────────────────────────────────────────────────────────

let cachedWeights: WeightsConfig | null = null
let cachedPatterns: Pattern[] | null = null
let cacheUntil = 0
const CACHE_TTL_MS = 5 * 60_000  // 5 min

async function ensureCache() {
  if (Date.now() < cacheUntil && cachedWeights && cachedPatterns) return
  try {
    const storage = await getLearningStorage()
    cachedWeights = await storage.getWeights()
    cachedPatterns = await storage.getPatterns()
    cacheUntil = Date.now() + CACHE_TTL_MS
  } catch {
    // Fallback a defaults si storage no disponible
    cachedWeights = DEFAULT_WEIGHTS
    cachedPatterns = []
    cacheUntil = Date.now() + 60_000
  }
}

/** Pesos actuales — usado por decision-engine */
export async function getCurrentWeights(): Promise<WeightsConfig> {
  await ensureCache()
  return cachedWeights ?? DEFAULT_WEIGHTS
}

/** Versión síncrona: devuelve el cache actual o defaults. Para usos hot-path. */
export function getCurrentWeightsSync(): WeightsConfig {
  return cachedWeights ?? DEFAULT_WEIGHTS
}

/** Ajuste de probabilidad sugerido por el histórico (significant patterns) */
export async function getHistoricalProbAdjustment(args: {
  market: string; league: string; selectionType: string
}): Promise<{ adjustment: number; sourcePattern?: string }> {
  await ensureCache()
  if (!cachedPatterns || cachedPatterns.length === 0) return { adjustment: 0 }
  return getProbAdjustmentFor(cachedPatterns, args)
}

/** Versión síncrona para hot-path */
export function getHistoricalProbAdjustmentSync(args: {
  market: string; league: string; selectionType: string
}): { adjustment: number; sourcePattern?: string } {
  if (!cachedPatterns || cachedPatterns.length === 0) return { adjustment: 0 }
  return getProbAdjustmentFor(cachedPatterns, args)
}

/** Fuerza precarga del cache (llamar al inicio del pipeline) */
export async function preloadLearningCache(): Promise<void> {
  cacheUntil = 0
  await ensureCache()
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper para registrar picks publicados en el storage
// ─────────────────────────────────────────────────────────────────────────────

export async function recordPublishedPicks(picks: PickRecord[]): Promise<void> {
  if (picks.length === 0) return
  try {
    const storage = await getLearningStorage()
    await Promise.all(picks.map((p) => storage.savePick(p)))
  } catch (e: any) {
    console.warn("[learning] recordPublishedPicks falló:", e?.message ?? e)
  }
}
