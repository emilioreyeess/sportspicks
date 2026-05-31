/**
 * Lightweight KV Job Queue — SportsPicks Analytics (FASE 3)
 * ════════════════════════════════════════════════════════════════════════════
 * Uses Vercel KV as the backing store. No external queue service needed.
 *
 * Architecture:
 *   1. `enqueueJob(type, payload)` → writes job record, returns jobId
 *   2. Worker processes the job (called inline or via self-invoke)
 *   3. `resolveJob(id, result)` / `failJob(id, error)` → update KV
 *   4. Client polls `GET /api/jobs/[id]` until status is done/failed
 *
 * Job TTL: 1 hour (long enough for user to poll, short enough to avoid KV bloat).
 * ════════════════════════════════════════════════════════════════════════════
 */

import { kv } from "@vercel/kv"
import { randomBytes } from "crypto"

// ─── Types ─────────────────────────────────────────────────────────────────

export type JobStatus = "queued" | "processing" | "done" | "failed"

export interface Job<T = unknown, R = unknown> {
  id: string
  type: string
  payload: T
  status: JobStatus
  result?: R
  error?: string
  createdAt: number
  updatedAt: number
}

const JOB_TTL = 3600         // 1 hour

function jobKey(id: string) { return `job:${id}` }

function kvAvailable() {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Create a new job record in KV. Returns the job (with a fresh ID).
 * Gracefully returns a synthetic job if KV is unavailable.
 */
export async function enqueueJob<T>(type: string, payload: T): Promise<Job<T>> {
  const id = randomBytes(12).toString("base64url")
  const job: Job<T> = {
    id,
    type,
    payload,
    status: "queued",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  if (kvAvailable()) {
    try {
      await kv.set(jobKey(id), job, { ex: JOB_TTL })
    } catch (err) {
      console.warn("[jobs] enqueue error:", err)
    }
  }
  return job
}

/**
 * Read a job record. Returns null if not found or KV is unavailable.
 */
export async function getJob<T = unknown, R = unknown>(id: string): Promise<Job<T, R> | null> {
  if (!kvAvailable()) return null
  try {
    return await kv.get<Job<T, R>>(jobKey(id))
  } catch {
    return null
  }
}

/**
 * Mark a job as processing.
 */
export async function startJob(id: string): Promise<void> {
  await _patchJob(id, { status: "processing" })
}

/**
 * Mark a job as done with a result.
 */
export async function resolveJob<R>(id: string, result: R): Promise<void> {
  await _patchJob(id, { status: "done", result })
}

/**
 * Mark a job as failed with an error message.
 */
export async function failJob(id: string, error: string): Promise<void> {
  await _patchJob(id, { status: "failed", error })
}

async function _patchJob(id: string, patch: Partial<Job>): Promise<void> {
  if (!kvAvailable()) return
  try {
    const existing = await kv.get<Job>(jobKey(id))
    if (!existing) return
    const updated: Job = { ...existing, ...patch, updatedAt: Date.now() }
    await kv.set(jobKey(id), updated, { ex: JOB_TTL })
  } catch (err) {
    console.warn("[jobs] patch error:", id, err)
  }
}

// ─── SSE helpers ──────────────────────────────────────────────────────────

/**
 * Encode a value as a Server-Sent Event line.
 * Usage: send this to a ReadableStream controller.
 */
export function sseEvent(event: string, data: unknown): Uint8Array {
  const encoder = new TextEncoder()
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

export function ssePing(): Uint8Array {
  return new TextEncoder().encode(": ping\n\n")
}
