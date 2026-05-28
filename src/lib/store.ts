/**
 * STORE DIARIO EN MEMORIA — resultados precomputados del pipeline.
 *
 * El pipeline (src/lib/pipeline.ts) corre a las 00:00 y al arrancar el servidor.
 * Las rutas /api/* leen de aquí → respuesta instantánea, sin recalcular nada.
 * Si el store está frío, la ruta dispara el pipeline una vez (cold start).
 *
 * Persistencia de "ayer": se escribe en /tmp/sp-yesterday.json para sobrevivir
 * cold starts de Vercel. El campo en memoria se hidrata desde el fichero en el
 * primer getYesterday() si el store arrancó frío.
 *
 * Nota de producción: para escalado multi-instancia, este store se sustituiría
 * por Redis (ya disponible en docker-compose). El contrato (getStore/setDailyResults)
 * no cambiaría — solo la implementación de persistencia.
 */

export type PipelineStatus = "cold" | "running" | "ready" | "error"

export interface PipelineMeta {
  status: PipelineStatus
  lastRunAt: string | null
  lastSuccessAt: string | null
  nextRunAt: string | null
  durationMs: number
  runCount: number
  errorCount: number
  counts: { matches: number; valuePicks: number; combinadas: number; retos: number }
  errors: string[]
  logs: string[]
}

export interface DailyResults {
  date: string
  valuePicks: any[]
  picksNote?: string
  combinadaPool: any[]
  retos: any[]
  retosNote?: string
  matches: number
  durationMs: number
}

interface DailyStore {
  date: string | null
  valuePicks: any[]
  picksNote?: string
  combinadaPool: any[]
  retos: any[]
  retosNote?: string
  // Snapshot completo del DailyData usado para generar los picks de hoy
  // (necesario para Second Opinion — reanalizar sin volver a hacer fetch)
  dailyData: any | null
  // Auditoría: candidatos rechazados por el motor de decisión
  lastAuditTrail: any[]
  // Picks del día anterior con resultados verificados
  yesterday: {
    date: string | null
    picks: any[]   // misma estructura que valuePicks + result: WIN|LOSS|VOID|PENDING
  }
  meta: PipelineMeta
}

const MAX_LOGS = 120

const store: DailyStore = {
  date: null,
  valuePicks: [],
  combinadaPool: [],
  retos: [],
  dailyData: null,
  lastAuditTrail: [],
  yesterday: { date: null, picks: [] },
  meta: {
    status: "cold",
    lastRunAt: null,
    lastSuccessAt: null,
    nextRunAt: null,
    durationMs: 0,
    runCount: 0,
    errorCount: 0,
    counts: { matches: 0, valuePicks: 0, combinadas: 0, retos: 0 },
    errors: [],
    logs: [],
  },
}

export function getStore(): DailyStore {
  return store
}

/** El store tiene resultados de hoy */
export function isWarm(): boolean {
  return store.meta.status === "ready" && store.valuePicks !== undefined
}

/** Los resultados son recientes (frescos) */
export function isFresh(maxAgeMs: number): boolean {
  if (!store.meta.lastSuccessAt) return false
  return Date.now() - new Date(store.meta.lastSuccessAt).getTime() < maxAgeMs
}

export function addLog(line: string): void {
  const stamp = new Date().toISOString().replace("T", " ").slice(0, 19)
  store.meta.logs.unshift(`[${stamp}] ${line}`)
  if (store.meta.logs.length > MAX_LOGS) store.meta.logs.length = MAX_LOGS
}

export function setStatus(status: PipelineStatus): void {
  store.meta.status = status
  if (status === "running") store.meta.lastRunAt = new Date().toISOString()
}

export function recordError(msg: string): void {
  store.meta.errorCount++
  store.meta.errors.unshift(`[${new Date().toISOString().slice(0, 19)}] ${msg}`)
  if (store.meta.errors.length > 20) store.meta.errors.length = 20
  addLog(`❌ ${msg}`)
}

export function setNextRun(iso: string): void {
  store.meta.nextRunAt = iso
}

const YESTERDAY_TMP = "/tmp/sp-yesterday.json"

/** Lee los picks de ayer del store en memoria; en cold start carga desde /tmp */
export function getYesterday(): { date: string | null; picks: any[] } {
  if (store.yesterday.picks.length > 0) return store.yesterday
  // Cold start — intentar cargar desde /tmp
  try {
    const { readFileSync } = require("fs")
    const raw = readFileSync(YESTERDAY_TMP, "utf8")
    const parsed = JSON.parse(raw)
    if (parsed?.date && Array.isArray(parsed?.picks)) {
      store.yesterday = parsed
      return parsed
    }
  } catch { /* /tmp vacío o inexistente en cold start → normal */ }
  return store.yesterday
}

export function setYesterdayResults(date: string, picks: any[]): void {
  store.yesterday = { date, picks }
  addLog(`📋 Ayer guardado: ${picks.length} picks · ${date} · ${picks.filter(p => p.result === "WIN").length}W ${picks.filter(p => p.result === "LOSS").length}L`)
  // Persistir en /tmp para sobrevivir cold restarts de la instancia serverless
  try {
    const { writeFileSync } = require("fs")
    writeFileSync(YESTERDAY_TMP, JSON.stringify({ date, picks }), "utf8")
  } catch (e: any) {
    addLog(`⚠️ No se pudo escribir /tmp: ${e?.message}`)
  }
}

export function setDailyResults(r: DailyResults): void {
  store.date = r.date
  store.valuePicks = r.valuePicks
  store.picksNote = r.picksNote
  store.combinadaPool = r.combinadaPool
  store.retos = r.retos
  store.retosNote = r.retosNote
  store.meta.status = "ready"
  store.meta.lastSuccessAt = new Date().toISOString()
  store.meta.durationMs = r.durationMs
  store.meta.runCount++
  store.meta.counts = {
    matches: r.matches,
    valuePicks: r.valuePicks.length,
    combinadas: r.combinadaPool.length,
    retos: r.retos.length,
  }
}
