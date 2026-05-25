/**
 * Supabase clients — SportsPicks Analytics
 *
 * Dos clientes separados:
 *   · supabase  → anon key, safe para usar en Client Components y rutas públicas.
 *   · createServiceClient() → service_role key, SOLO en Server Components y route handlers.
 *     Nunca exportes la instancia directamente; crea una nueva por request para evitar
 *     fugas de sesión en entornos serverless.
 *
 * Variables de entorno requeridas en Vercel:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY   (solo Production/Server — nunca en NEXT_PUBLIC_)
 *   DATABASE_URL                (Prisma connection string con pgbouncer)
 *   DIRECT_URL                  (Prisma direct connection para migraciones)
 */

import { createClient } from "@supabase/supabase-js"

// ─── Client-side / Edge (anon key) ───────────────────────────────────────────
// Safe para navegador: no tiene permisos más allá de las RLS policies.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // NextAuth maneja sesiones; no duplicar
    autoRefreshToken: false,
  },
})

// ─── Server-side (service_role) ───────────────────────────────────────────────
// Bypasa RLS — NUNCA usar en Client Components. Crear una instancia por request.
export function createServiceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    throw new Error("[Supabase] SUPABASE_SERVICE_ROLE_KEY no está configurado")
  }
  return createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

// ─── Helpers tipados ─────────────────────────────────────────────────────────

/** Actualiza el plan de un usuario tras un checkout de Stripe exitoso */
export async function upsertUserPlan(
  email: string,
  plan: "free" | "premium" | "pro",
  stripeCustomerId: string,
) {
  const sb = createServiceClient()
  const { error } = await sb
    .from("user_profiles")
    .upsert(
      {
        email,
        plan,
        stripe_customer_id: stripeCustomerId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email" },
    )
  if (error) throw new Error(`[Supabase] upsertUserPlan failed: ${error.message}`)
}

/** Resuelve el plan de un usuario por email (fallback: "free") */
export async function getUserPlan(email: string): Promise<"free" | "premium" | "pro"> {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from("user_profiles")
    .select("plan")
    .eq("email", email)
    .maybeSingle()
  if (error || !data) return "free"
  const plan = data.plan as string
  if (plan === "premium" || plan === "pro") return plan
  return "free"
}
