/**
 * POST /api/admin/settle-now  — Botón de pánico (FASE 2)
 *
 * Fallback de emergencia para cuando los crons de Vercel no se disparan (webhook
 * roto, sin schedule en vercel.json, etc.). Re-ejecuta la resolución de picks
 * pendientes BAJO DEMANDA desde el panel de administración (/admin/tools).
 *
 * Por qué un route server-side y no un fetch directo desde el botón:
 *   los endpoints de settle exigen `Authorization: Bearer ${CRON_SECRET}`. El
 *   secreto NO puede vivir en el navegador, así que el botón llama aquí (auth de
 *   admin con `x-admin-token`) y es ESTE handler quien añade el Bearer server-side.
 *
 * Dispara, en orden, los dos liquidadores independientes:
 *   1. /api/bets/settle      → árbitro IA (lee `fixtures`, el que acabamos de arreglar)
 *   2. /api/cron/settle-bets → liquidador contra resultados de ESPN (respaldo)
 */
import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 120

// CN-004: mismo patrón de auth que el resto de /api/admin — comparación de tiempo
// constante contra ADMIN_TOKEN (nunca expuesto al cliente).
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || ""

function isAuthorized(req: NextRequest): boolean {
  if (!ADMIN_TOKEN) return false
  const t = req.headers.get("x-admin-token") ?? ""
  if (t.length !== ADMIN_TOKEN.length) return false
  let diff = 0
  for (let i = 0; i < t.length; i++) diff |= t.charCodeAt(i) ^ ADMIN_TOKEN.charCodeAt(i)
  return diff === 0
}

async function trigger(origin: string, path: string, secret: string) {
  try {
    const r = await fetch(`${origin}${path}`, {
      method: "GET",
      headers: { authorization: `Bearer ${secret}` },
      cache: "no-store",
      signal: AbortSignal.timeout(110_000),
    })
    let body: any = null
    try { body = await r.json() } catch { body = null }
    return { endpoint: path, status: r.status, ok: r.ok, result: body }
  } catch (e: any) {
    return { endpoint: path, status: 0, ok: false, error: e?.message ?? String(e) }
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const secret = process.env.CRON_SECRET
  if (!secret || secret.trim().length < 16) {
    return NextResponse.json(
      { error: "CRON_SECRET no configurado en el servidor — no se puede liquidar" },
      { status: 500 },
    )
  }

  const origin = new URL(req.url).origin
  // Secuencial para no exceder rate-limits del LLM-árbitro ni de ESPN.
  const referee = await trigger(origin, "/api/bets/settle", secret)
  const espn = await trigger(origin, "/api/cron/settle-bets", secret)

  const ranks = [referee, espn]
  const anyOk = ranks.some((r) => r.ok)
  return NextResponse.json(
    { ok: anyOk, ranAt: new Date().toISOString(), runs: ranks },
    { status: anyOk ? 200 : 502 },
  )
}
