/**
 * Second Opinion Engine — Regeneración inteligente de picks.
 *
 * Reglas duras:
 *   1. Quotas por plan (FREE=1, PREMIUM=3, PRO=5) por día por usuario.
 *   2. NO degradar la calidad: el alternativo debe igualar o superar el quality_score original.
 *   3. Excluir selecciones ya rechazadas por el usuario en la misma sesión.
 *   4. Devolver change_log explicando QUÉ cambió y POR QUÉ.
 *   5. Si NO hay nada mejor → mensaje estricto: "protegemos tu bankroll".
 *
 * El cómputo del alternativo se delega a `findAlternativePick` (pipeline.ts),
 * que ya aplica los gates del motor base. Este módulo añade quota, change_log
 * y la regla de no-degradar.
 */

import { findAlternativePick, type SecondOpinionResult } from "../pipeline"
import { getStore } from "../store"
import { getLearningStorage } from "../learning/storage"
import {
  SECOND_OPINION_QUOTA,
  type PlanTier,
  type SecondOpinionRequest,
  type SecondOpinionResponse,
  type ChangeLog,
} from "./types"

// ─── Quota tracking ───────────────────────────────────────────────────────────
//
// Usamos el storage de learning (KV o memory) para persistir cuotas por día.
// Clave: `second-opinion:quota:${userKey}:${YYYY-MM-DD}` → integer

function quotaKey(userKey: string, dateISO: string): string {
  return `second-opinion:quota:${userKey}:${dateISO}`
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

async function readQuota(userKey: string): Promise<number> {
  try {
    const storage = await getLearningStorage()
    // El storage no expone get/set genérico → accedemos al KV interno solo si existe
    const kv = (storage as { kv?: { get: (k: string) => Promise<number | null> } }).kv
    if (!kv) return readMemoryQuota(userKey)
    const v = await kv.get(quotaKey(userKey, todayISO()))
    return typeof v === "number" ? v : 0
  } catch {
    return readMemoryQuota(userKey)
  }
}

async function incrementQuota(userKey: string): Promise<number> {
  try {
    const storage = await getLearningStorage()
    const kv = (storage as { kv?: { incr: (k: string) => Promise<number>; expire: (k: string, s: number) => Promise<void> } }).kv
    if (!kv) return incrementMemoryQuota(userKey)
    const k = quotaKey(userKey, todayISO())
    const next = await kv.incr(k)
    // Expira en 36h — sobra para cubrir el día
    if (next === 1) await kv.expire(k, 36 * 3600)
    return next
  } catch {
    return incrementMemoryQuota(userKey)
  }
}

// ─── Fallback de memoria (dev / si KV no responde) ─────────────────────────────

const memoryQuotas = new Map<string, number>()
function memKey(userKey: string): string { return `${userKey}::${todayISO()}` }
function readMemoryQuota(userKey: string): number {
  return memoryQuotas.get(memKey(userKey)) ?? 0
}
function incrementMemoryQuota(userKey: string): number {
  const k = memKey(userKey)
  const next = (memoryQuotas.get(k) ?? 0) + 1
  memoryQuotas.set(k, next)
  return next
}

// ─── Change log builder ───────────────────────────────────────────────────────

function buildChangeLog(
  original: { market: string; selection: string; quality: number; odd?: number },
  alternative: { market: string; selection: string; quality_score: number; odd: number; reasoning?: string[] | string },
): ChangeLog {
  // Qué cambió
  const sameMarket = original.market === alternative.market
  const whatChanged = sameMarket
    ? `Selección: "${original.selection}" → "${alternative.selection}"`
    : `Mercado: ${original.market} → ${alternative.market}. Nueva selección: ${alternative.selection}`

  // Por qué (extraído de la razones del alternative)
  const reasonsText = Array.isArray(alternative.reasoning)
    ? alternative.reasoning.slice(0, 2).join(" · ")
    : (alternative.reasoning ?? "")
  const why = reasonsText.length > 0
    ? reasonsText
    : "El motor encontró una selección con scores equiparables tras re-evaluar todos los mercados disponibles."

  // Risk delta
  const oddDelta = original.odd != null
    ? Math.round((alternative.odd - original.odd) * 100) / 100
    : 0
  const qualityDelta = alternative.quality_score - original.quality
  const confidenceMaintained = qualityDelta >= 0

  return {
    whatChanged,
    why,
    riskDelta: {
      oddDelta,
      confidenceMaintained,
      qualityDelta,
    },
  }
}

// ─── API pública ──────────────────────────────────────────────────────────────

export async function runSecondOpinion(req: SecondOpinionRequest): Promise<SecondOpinionResponse> {
  const limit = SECOND_OPINION_QUOTA[req.plan]

  // 1. Verificar quota ANTES de consumir cómputo
  const used = await readQuota(req.userKey)
  if (used >= limit) {
    return {
      found: false,
      reason: `Has alcanzado el límite de regeneraciones de tu plan (${limit}/día). Mejora a un plan superior para más alternativas.`,
      quota: { plan: req.plan, limit, used, remaining: 0 },
    }
  }

  // 2. Verificar que los datos del día están listos
  const store = getStore()
  const data = store.dailyData
  if (!data) {
    return {
      found: false,
      reason: "Los datos del día aún no están disponibles. Inténtalo en unos segundos — no consumimos tu cuota de regeneración.",
      quota: { plan: req.plan, limit, used, remaining: limit - used },
    }
  }

  // 3. Consumir cuota ya — incluso si no encontramos nada, el cómputo cuesta
  const newUsed = await incrementQuota(req.userKey)

  // 4. Ejecutar el motor de alternativas (ya aplica gates internos)
  const result: SecondOpinionResult = findAlternativePick(
    data,
    req.matchId,
    req.originalSelection,
    req.originalMarket,
    req.originalQuality,
    req.excludeSelections,
  )

  if (!result.found || !result.pick) {
    return {
      found: false,
      reason: result.reason
        ?? "No se encontró una alternativa que mejore o mantenga la calidad del pick actual. Protegemos tu bankroll.",
      quota: { plan: req.plan, limit, used: newUsed, remaining: Math.max(0, limit - newUsed) },
    }
  }

  // findAlternativePick devuelve `pick` (no `alternative`) — extraemos los campos
  const pick = result.pick as {
    market: string; selection: string; best_odd: number; quality_score: number
    confidence_pct: number; reasons: string[]
  }
  const changes = result.changes

  // 5. Construir change_log estructurado a partir de `changes` cuando exista
  const changeLog: ChangeLog = changes
    ? {
        whatChanged: changes.market_from !== changes.market_to
          ? `Mercado: ${changes.market_from} → ${changes.market_to}. Nueva selección: ${changes.selection_to}`
          : `Selección: "${changes.selection_from}" → "${changes.selection_to}"`,
        why: changes.why_changed,
        riskDelta: {
          oddDelta: Math.round((changes.odd_to - changes.odd_from) * 100) / 100,
          confidenceMaintained: changes.quality_to >= changes.quality_from,
          qualityDelta: changes.quality_to - changes.quality_from,
        },
      }
    : buildChangeLog(
        { market: req.originalMarket, selection: req.originalSelection, quality: req.originalQuality },
        { market: pick.market, selection: pick.selection, quality_score: pick.quality_score, odd: pick.best_odd, reasoning: pick.reasons },
      )

  return {
    found: true,
    alternative: {
      market: pick.market,
      selection: pick.selection,
      odd: pick.best_odd,
      qualityScore: pick.quality_score,
      confidence: pick.confidence_pct / 100,
      reasoning: Array.isArray(pick.reasons) ? pick.reasons : [],
    },
    changeLog,
    quota: { plan: req.plan, limit, used: newUsed, remaining: Math.max(0, limit - newUsed) },
  }
}
