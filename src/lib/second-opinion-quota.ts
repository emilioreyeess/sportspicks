/**
 * Cuota diaria de Second Opinion por pick.
 * Free 1 / Premium 3 / Pro 5 por pick y por día.
 *
 * Persistencia: localStorage. Se resetea al cambiar de día (clave incluye fecha).
 */

import type { PlanId } from "@/lib/plans"

const KEY_PREFIX = "sp_so_usage_"

const LIMITS: Record<PlanId, number> = {
  free:    1,
  premium: 3,
  pro:     5,
}

function todayKey(): string {
  return `${KEY_PREFIX}${new Date().toISOString().slice(0, 10)}`
}

function readMap(): Record<string, number> {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(todayKey())
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function writeMap(m: Record<string, number>): void {
  if (typeof window === "undefined") return
  try { localStorage.setItem(todayKey(), JSON.stringify(m)) } catch {}
}

export function getMaxSecondOpinions(plan: PlanId): number {
  return LIMITS[plan] ?? 1
}

export function getUsedSecondOpinions(pickId: string): number {
  return readMap()[pickId] ?? 0
}

export function getRemainingSecondOpinions(plan: PlanId, pickId: string): number {
  return Math.max(0, getMaxSecondOpinions(plan) - getUsedSecondOpinions(pickId))
}

export function incrementSecondOpinion(pickId: string): void {
  const m = readMap()
  m[pickId] = (m[pickId] ?? 0) + 1
  writeMap(m)
}

/** Lista de selecciones ya rechazadas para este pick — evita repetir alternativas */
const REJECTED_KEY_PREFIX = "sp_so_rejected_"
function rejectedKey(pickId: string): string {
  return `${REJECTED_KEY_PREFIX}${new Date().toISOString().slice(0, 10)}_${pickId}`
}

export function getRejectedSelections(pickId: string): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(rejectedKey(pickId))
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function addRejectedSelection(pickId: string, selection: string): void {
  if (typeof window === "undefined") return
  const cur = getRejectedSelections(pickId)
  if (cur.includes(selection)) return
  cur.push(selection)
  try { localStorage.setItem(rejectedKey(pickId), JSON.stringify(cur)) } catch {}
}
