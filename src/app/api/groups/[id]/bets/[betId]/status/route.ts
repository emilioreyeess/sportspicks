/**
 * PATCH /api/groups/[id]/bets/[betId]/status — auto-validación (sistema de honor)
 *
 * Entorno entre amigos: el propio DUEÑO del boleto marca el resultado a mano
 * ('won' | 'lost' | 'pending' para deshacer). El ranking del grupo se recalcula
 * solo al leer (lee el status del bet). Regla de seguridad: SOLO el creador
 * original del boleto puede cambiar su estado.
 */
import { NextRequest } from "next/server"
import { getServerSession } from "@/lib/auth-server"
import { createServiceClient } from "@/lib/supabase/client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const VALID = ["won", "lost", "pending"] as const
type BetStatus = (typeof VALID)[number]

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; betId: string }> },
) {
  const { id: groupId, betId } = await params
  const session = await getServerSession()
  if (!session?.user?.email) return Response.json({ error: "No autorizado" }, { status: 401 })
  const email = session.user.email

  let body: { status?: string }
  try { body = await req.json() } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 })
  }
  if (typeof body.status !== "string" || !VALID.includes(body.status as BetStatus)) {
    return Response.json({ error: "Estado inválido (won | lost | pending)" }, { status: 400 })
  }
  const status = body.status as BetStatus

  const sb = createServiceClient()

  // El boleto debe estar compartido EN ESTE grupo (scope correcto del endpoint).
  const { data: shared } = await sb
    .from("group_bets")
    .select("id")
    .eq("group_id", groupId)
    .eq("bet_id", betId)
    .maybeSingle()
  if (!shared) return Response.json({ error: "Boleto no compartido en este grupo" }, { status: 404 })

  // REGLA DE SEGURIDAD: solo el CREADOR del boleto puede marcar su resultado.
  // Update atómico con filtro de propiedad → si no es suyo, no toca nada.
  const { data, error } = await sb
    .from("bets")
    .update({ status, settled_at: status === "pending" ? null : new Date().toISOString() })
    .eq("id", betId)
    .eq("user_email", email)
    .select("id, status, settled_at")
    .single()

  if (error || !data) {
    const { data: ex } = await sb.from("bets").select("user_email").eq("id", betId).single()
    if (!ex || ex.user_email !== email) {
      return Response.json({ error: "Solo el dueño del boleto puede marcar su resultado" }, { status: 403 })
    }
    return Response.json({ error: "No se pudo actualizar" }, { status: 500 })
  }

  // Propaga el estado a las patas (consistencia con el flujo de "Mis Apuestas").
  await sb.from("bet_legs").update({ status }).eq("bet_id", betId)

  return Response.json({ ok: true, bet: data })
}
