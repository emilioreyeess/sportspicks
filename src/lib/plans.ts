/**
 * SISTEMA DE PLANES — arquitectura premium lista para producción.
 *
 * NO conecta Stripe todavía. El control de plan vive en cliente (localStorage)
 * vía src/lib/plan.tsx. Cuando se integre el pago real, basta con:
 *   1. Sustituir la fuente del plan (localStorage → sesión/DB del usuario).
 *   2. Conectar el checkout de Stripe en la página de precios.
 * Toda la lógica de feature-gating (planHas / límites) ya queda centralizada aquí.
 */

export type PlanId = "free" | "premium" | "pro"

export type Feature =
  | "value_picks_all"       // ver todos los value picks (free: solo 1)
  | "value_pick_detail"     // abrir el análisis completo de un pick
  | "combinadas_all_modes"  // modos balanceada y soñadora (free: solo segura)
  | "bot_unlimited"         // bot IA sin límite diario
  | "stats_advanced"        // comparativas y métricas avanzadas
  | "retos_all"             // todos los retos
  | "alerts"                // centro de alertas / notificaciones
  | "api_access"            // acceso API (solo PRO)
  | "exports"               // exportar datos a CSV (solo PRO)

export interface PlanDef {
  id: PlanId
  name: string
  price: number             // €/mes
  period: string
  tagline: string
  badge?: string
  highlighted?: boolean
  accent: string            // clase tailwind de color
  features: Feature[]
  perks: string[]
  notIncluded: string[]
  limits: {
    valuePicks: number      // -1 = ilimitado
    botMessagesPerDay: number
    combinadasModes: number
  }
}

export const PLANS: Record<PlanId, PlanDef> = {
  free: {
    id: "free",
    name: "Free",
    price: 0,
    period: "siempre gratis",
    tagline: "Prueba el motor cuantitativo",
    accent: "zinc",
    features: [],
    perks: [
      "1 value pick destacado al día",
      "Combinada en modo Segura",
      "Bot IA — 3 análisis al día",
      "Estadísticas básicas de equipos",
      "Acceso a los retos comunitarios",
    ],
    notIncluded: [
      "Resto de value picks del día",
      "Análisis completo de cada pick",
      "Modos Balanceada y Soñadora",
      "Estadísticas avanzadas y alertas",
    ],
    limits: { valuePicks: 1, botMessagesPerDay: 3, combinadasModes: 1 },
  },
  premium: {
    id: "premium",
    name: "Premium",
    price: 9.99,
    period: "/mes",
    tagline: "El plan del apostador serio",
    badge: "Más popular",
    highlighted: true,
    accent: "emerald",
    features: [
      "value_picks_all", "value_pick_detail", "combinadas_all_modes",
      "bot_unlimited", "stats_advanced", "retos_all", "alerts",
    ],
    perks: [
      "Todos los value picks del día con edge real",
      "Análisis completo: contexto, motivación y score",
      "Combinadas en los 3 modos de riesgo",
      "Bot IA ilimitado con visión de boletos",
      "Estadísticas avanzadas y comparativas",
      "Centro de alertas en tiempo real",
    ],
    notIncluded: ["Acceso API", "Exportación de datos"],
    limits: { valuePicks: -1, botMessagesPerDay: -1, combinadasModes: 3 },
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: 24.99,
    period: "/mes",
    tagline: "Para traders y automatización",
    badge: "Avanzado",
    accent: "violet",
    features: [
      "value_picks_all", "value_pick_detail", "combinadas_all_modes",
      "bot_unlimited", "stats_advanced", "retos_all", "alerts",
      "api_access", "exports",
    ],
    perks: [
      "Todo lo de Premium",
      "Acceso a la API de picks y cuotas",
      "Exportación de datos a CSV",
      "Webhooks y automatizaciones",
      "Histórico completo del modelo",
      "Soporte prioritario",
    ],
    notIncluded: [],
    limits: { valuePicks: -1, botMessagesPerDay: -1, combinadasModes: 3 },
  },
}

export const PLAN_ORDER: PlanId[] = ["free", "premium", "pro"]

/** ¿Tiene este plan acceso a una feature concreta? */
export function planHas(plan: PlanId, feature: Feature): boolean {
  return PLANS[plan]?.features.includes(feature) ?? false
}

/** Devuelve el plan mínimo que desbloquea una feature (para los CTAs de upgrade) */
export function minPlanFor(feature: Feature): PlanId {
  for (const id of PLAN_ORDER) {
    if (planHas(id, feature)) return id
  }
  return "pro"
}
