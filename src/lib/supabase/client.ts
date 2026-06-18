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

export const supabase = supabaseUrl
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null as any

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

// ─── Plan del usuario ────────────────────────────────────────────────────────
// FASE 4 (saneamiento): se eliminaron `getUserPlan` y `upsertUserPlan`. Eran
// código MUERTO (cero callers) que apuntaba a la tabla `user_profiles`, que NO
// existe en Supabase (devolvía 404). La fuente de verdad del plan es:
//   1) plan-grants.ts (grants manuales)  2) Stripe  → resueltos en /api/auth/plan
//   y vía getGrantedPlan() en los endpoints gateados. Nada lee `user_profiles`.
