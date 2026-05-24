/**
 * Capa de persistencia del Learning Engine.
 *
 * Dos adapters:
 *  - KVStorage:     Vercel KV (Redis). Producción.
 *  - MemoryStorage: en memoria. Dev local — se borra en cold start.
 *
 * Auto-detección: si las env vars de KV existen → KV. Si no → memoria con warning.
 *
 * Schema de claves en KV:
 *  picks:by-date:YYYY-MM-DD       → JSON array de PickRecord (los del día)
 *  picks:all-dates                → Set de fechas con picks
 *  picks:by-id:<pickId>           → JSON PickRecord (lookup directo)
 *  patterns:current               → JSON array de Pattern (los activos)
 *  weights:current                → JSON WeightsConfig
 *  reports:by-date:YYYY-MM-DD     → JSON LearningReport
 *  reports:latest-dates           → JSON array de fechas (top 30)
 */

import type { PickRecord, Pattern, WeightsConfig, LearningReport } from "./types"
import { DEFAULT_WEIGHTS } from "./types"

export interface LearningStorage {
  // ── Picks ────────────────────────────────────────────────────────────────
  savePick(record: PickRecord): Promise<void>
  updatePickResult(pickId: string, result: "WIN" | "LOSS" | "VOID", homeScore?: number, awayScore?: number): Promise<void>
  getPicksByDate(date: string): Promise<PickRecord[]>
  /** Devuelve los picks de los últimos N días, ordenados por fecha desc */
  getRecentPicks(daysBack: number): Promise<PickRecord[]>
  /** Fechas con picks registrados, desc */
  getDatesWithPicks(limit?: number): Promise<string[]>

  // ── Patterns ────────────────────────────────────────────────────────────
  getPatterns(): Promise<Pattern[]>
  savePatterns(patterns: Pattern[]): Promise<void>

  // ── Weights ─────────────────────────────────────────────────────────────
  getWeights(): Promise<WeightsConfig>
  saveWeights(weights: WeightsConfig): Promise<void>

  // ── Reports ─────────────────────────────────────────────────────────────
  saveReport(report: LearningReport): Promise<void>
  getReport(date: string): Promise<LearningReport | null>
  getRecentReports(limit: number): Promise<LearningReport[]>

  // ── Health ──────────────────────────────────────────────────────────────
  /** Identifica el adapter actual para diagnóstico */
  backendName(): string
  isEphemeral(): boolean         // true = se borra al reiniciar (memoria)
}

// ═══════════════════════════════════════════════════════════════════════════════
// KV Storage (Vercel KV / Upstash compatible)
// ═══════════════════════════════════════════════════════════════════════════════

class KVStorage implements LearningStorage {
  private kv: any

  constructor(kv: any) { this.kv = kv }

  backendName() { return "vercel-kv" }
  isEphemeral() { return false }

  // Picks
  async savePick(r: PickRecord) {
    const dateKey = `picks:by-date:${r.date}`
    const existing: PickRecord[] = (await this.kv.get(dateKey)) ?? []
    // Idempotente: si el pickId ya está, lo sustituye
    const idx = existing.findIndex((p) => p.pickId === r.pickId)
    if (idx >= 0) existing[idx] = r
    else existing.push(r)
    await this.kv.set(dateKey, existing)
    await this.kv.set(`picks:by-id:${r.pickId}`, r)
    await this.kv.sadd("picks:all-dates", r.date)
  }

  async updatePickResult(pickId: string, result: "WIN" | "LOSS" | "VOID", homeScore?: number, awayScore?: number) {
    const rec: PickRecord | null = await this.kv.get(`picks:by-id:${pickId}`)
    if (!rec) return
    rec.result = result
    rec.resultRecordedAt = new Date().toISOString()
    if (homeScore != null) rec.homeScore = homeScore
    if (awayScore != null) rec.awayScore = awayScore
    await this.kv.set(`picks:by-id:${pickId}`, rec)
    const dateKey = `picks:by-date:${rec.date}`
    const dateList: PickRecord[] = (await this.kv.get(dateKey)) ?? []
    const idx = dateList.findIndex((p) => p.pickId === pickId)
    if (idx >= 0) { dateList[idx] = rec; await this.kv.set(dateKey, dateList) }
  }

  async getPicksByDate(date: string): Promise<PickRecord[]> {
    return (await this.kv.get(`picks:by-date:${date}`)) ?? []
  }

  async getRecentPicks(daysBack: number): Promise<PickRecord[]> {
    const dates = await this.getDatesWithPicks(daysBack * 2)
    const today = new Date().toISOString().slice(0, 10)
    const cutoff = new Date(Date.now() - daysBack * 86_400_000).toISOString().slice(0, 10)
    const valid = dates.filter((d) => d >= cutoff && d <= today)
    const all = await Promise.all(valid.map((d) => this.getPicksByDate(d)))
    return all.flat()
  }

  async getDatesWithPicks(limit = 365): Promise<string[]> {
    const set: string[] = (await this.kv.smembers("picks:all-dates")) ?? []
    return set.sort((a, b) => b.localeCompare(a)).slice(0, limit)
  }

  // Patterns
  async getPatterns(): Promise<Pattern[]> {
    return (await this.kv.get("patterns:current")) ?? []
  }
  async savePatterns(patterns: Pattern[]) {
    await this.kv.set("patterns:current", patterns)
  }

  // Weights
  async getWeights(): Promise<WeightsConfig> {
    return (await this.kv.get("weights:current")) ?? DEFAULT_WEIGHTS
  }
  async saveWeights(weights: WeightsConfig) {
    await this.kv.set("weights:current", weights)
  }

  // Reports
  async saveReport(r: LearningReport) {
    await this.kv.set(`reports:by-date:${r.date}`, r)
    const dates: string[] = (await this.kv.get("reports:latest-dates")) ?? []
    if (!dates.includes(r.date)) dates.unshift(r.date)
    await this.kv.set("reports:latest-dates", dates.slice(0, 60))
  }
  async getReport(date: string): Promise<LearningReport | null> {
    return (await this.kv.get(`reports:by-date:${date}`)) ?? null
  }
  async getRecentReports(limit: number): Promise<LearningReport[]> {
    const dates: string[] = (await this.kv.get("reports:latest-dates")) ?? []
    const sliced = dates.slice(0, limit)
    const reports = await Promise.all(sliced.map((d) => this.getReport(d)))
    return reports.filter((r): r is LearningReport => r !== null)
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Memory Storage (dev fallback — NO PERSISTE)
// ═══════════════════════════════════════════════════════════════════════════════

class MemoryStorage implements LearningStorage {
  private picksByDate = new Map<string, PickRecord[]>()
  private picksById = new Map<string, PickRecord>()
  private dates = new Set<string>()
  private patterns: Pattern[] = []
  private weights: WeightsConfig = DEFAULT_WEIGHTS
  private reportsByDate = new Map<string, LearningReport>()

  backendName() { return "memory" }
  isEphemeral() { return true }

  async savePick(r: PickRecord) {
    const list = this.picksByDate.get(r.date) ?? []
    const idx = list.findIndex((p) => p.pickId === r.pickId)
    if (idx >= 0) list[idx] = r
    else list.push(r)
    this.picksByDate.set(r.date, list)
    this.picksById.set(r.pickId, r)
    this.dates.add(r.date)
  }

  async updatePickResult(pickId: string, result: "WIN" | "LOSS" | "VOID", homeScore?: number, awayScore?: number) {
    const rec = this.picksById.get(pickId)
    if (!rec) return
    rec.result = result
    rec.resultRecordedAt = new Date().toISOString()
    if (homeScore != null) rec.homeScore = homeScore
    if (awayScore != null) rec.awayScore = awayScore
  }

  async getPicksByDate(date: string) { return this.picksByDate.get(date) ?? [] }

  async getRecentPicks(daysBack: number) {
    const cutoff = new Date(Date.now() - daysBack * 86_400_000).toISOString().slice(0, 10)
    const today = new Date().toISOString().slice(0, 10)
    const out: PickRecord[] = []
    for (const d of this.dates) if (d >= cutoff && d <= today) out.push(...(this.picksByDate.get(d) ?? []))
    return out
  }

  async getDatesWithPicks(limit = 365) {
    return [...this.dates].sort((a, b) => b.localeCompare(a)).slice(0, limit)
  }

  async getPatterns() { return [...this.patterns] }
  async savePatterns(p: Pattern[]) { this.patterns = p }
  async getWeights() { return this.weights }
  async saveWeights(w: WeightsConfig) { this.weights = w }
  async saveReport(r: LearningReport) { this.reportsByDate.set(r.date, r) }
  async getReport(date: string) { return this.reportsByDate.get(date) ?? null }
  async getRecentReports(limit: number) {
    return [...this.reportsByDate.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit)
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Singleton — auto-detecta KV o cae a memoria
// ═══════════════════════════════════════════════════════════════════════════════

let _instance: LearningStorage | null = null

async function tryCreateKVStorage(): Promise<LearningStorage | null> {
  if (!process.env.KV_REST_API_URL && !process.env.KV_URL) return null
  try {
    const kv = (await import("@vercel/kv")).kv
    // Ping rápido para verificar que funciona
    await kv.set("__health_check__", Date.now())
    return new KVStorage(kv)
  } catch (e: any) {
    console.warn("[learning-storage] KV import/connect falló, usando memoria:", e?.message ?? e)
    return null
  }
}

export async function getLearningStorage(): Promise<LearningStorage> {
  if (_instance) return _instance
  const kv = await tryCreateKVStorage()
  _instance = kv ?? new MemoryStorage()
  return _instance
}

/** Solo para tests — fuerza un backend específico */
export function _setLearningStorageForTesting(s: LearningStorage) { _instance = s }
