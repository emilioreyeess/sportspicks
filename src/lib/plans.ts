/**
 * SISTEMA DE PLANES — FREE / PREMIUM / PRO
 *
 * Arquitectura SaaS optimizada para conversión:
 *  FREE    → muestra suficiente valor para enganchar
 *  PREMIUM → desbloquea la plataforma completa, precio accesible (9.99€)
 *  PRO     → experiencia definitiva, exclusivo y premium (19.99€)
 *
 * Cuando se integre Stripe real:
 *  1. Sustituye la fuente del plan (localStorage → sesión/DB del usuario)
 *  2. Conecta el checkout en /pricing
 * La lógica de feature-gating (planHas / límites) no cambia.
 */

export type PlanId = "free" | "premium" | "pro"

export type Feature =
  // ── Value Picks ───────────────────────────────────────────────────────────
  | "value_picks_all"       // todos los picks (free: máx 3)
  | "value_pick_detail"     // análisis completo del pick (premium+)
  // ── Combinadas ────────────────────────────────────────────────────────────
  | "combinadas_dream"      // modo Soñadora (premium+; free tiene segura+balanceada)
  | "combinadas_ai"         // combinadas IA por prompt libre (premium+)
  | "combinadas_unlimited"  // sin límite de generaciones al día (premium+)
  // ── Bot IA ────────────────────────────────────────────────────────────────
  | "bot_extended"          // hasta 15 mensajes/día (premium)
  | "bot_unlimited"         // sin límite diario (pro)
  // ── Estadísticas ──────────────────────────────────────────────────────────
  | "stats_advanced"        // métricas avanzadas y comparativas (premium+)
  | "stats_unlimited"       // búsquedas ilimitadas (premium+; free: 2/día)
  // ── Retos ─────────────────────────────────────────────────────────────────
  | "retos_monthly"         // 1 reto mensual incluido (premium)
  | "retos_unlimited"       // todos los retos sin coste extra (pro)
  | "custom_retos"          // crear retos personalizados (pro)
  // ── Alertas & notificaciones ──────────────────────────────────────────────
  | "alerts"                // alertas inteligentes de valor (premium+)
  // ── Funciones exclusivas PRO ──────────────────────────────────────────────
  | "watchlist"             // seguir equipos/ligas/mercados (pro)
  | "trader_mode"           // modo Trader con edge, probabilidades, filtros (pro)
  | "ai_analyst"            // analista IA personal sin restricciones (pro)

export interface PlanLimits {
  valuePicks: number          // -1 = ilimitado
  botMessagesPerDay: number
  combinadasPerDay: number
  statsSearchesPerDay: number
}

export interface PlanDef {
  id: PlanId
  name: string
  emoji: string
  priceMonthly: number        // €/mes
  priceAnnual: number         // €/año (precio total, no mensual)
  period: string
  tagline: string
  badge?: string
  highlighted?: boolean
  accent: string
  features: Feature[]
  perks: string[]
  proFeatures?: string[]      // para el bloque "funciones exclusivas Pro"
  limits: PlanLimits
}

export const PLANS: Record<PlanId, PlanDef> = {

  free: {
    id: "free",
    name: "Free",
    emoji: "🔓",
    priceMonthly: 0,
    priceAnnual: 0,
    period: "siempre gratis",
    tagline: "Empieza a explorar el motor cuantitativo",
    accent: "zinc",
    features: [],
    perks: [
      "2–3 value picks diarios",
      "Combinadas Segura y Balanceada",
      "Bot IA — 3 mensajes al día",
      "Estadísticas básicas (2 búsquedas/día)",
      "Acceso a los retos comunitarios",
    ],
    limits: {
      valuePicks: 3,
      botMessagesPerDay: 3,
      combinadasPerDay: 2,
      statsSearchesPerDay: 2,
    },
  },

  premium: {
    id: "premium",
    name: "Premium",
    emoji: "⭐",
    priceMonthly: 9.99,
    priceAnnual: 99.99,
    period: "/mes",
    tagline: "Toda la plataforma. Para el apostador serio.",
    badge: "Más popular",
    highlighted: true,
    accent: "emerald",
    features: [
      "value_picks_all", "value_pick_detail",
      "combinadas_dream", "combinadas_ai", "combinadas_unlimited",
      "bot_extended",
      "stats_advanced", "stats_unlimited",
      "retos_monthly", "alerts",
    ],
    perks: [
      "Todos los value picks con análisis completo",
      "Bot IA — hasta 15 mensajes al día",
      "Combinadas en los 3 modos + IA por prompt",
      "Estadísticas avanzadas ilimitadas",
      "Alertas inteligentes de valor",
      "1 reto comunitario incluido al mes",
      "Todas las ligas y mercados",
    ],
    limits: {
      valuePicks: -1,
      botMessagesPerDay: 15,
      combinadasPerDay: -1,
      statsSearchesPerDay: -1,
    },
  },

  pro: {
    id: "pro",
    name: "Pro",
    emoji: "👑",
    priceMonthly: 19.99,
    priceAnnual: 189.99,
    period: "/mes",
    tagline: "La experiencia definitiva. Sin límites.",
    badge: "Exclusivo",
    accent: "violet",
    features: [
      "value_picks_all", "value_pick_detail",
      "combinadas_dream", "combinadas_ai", "combinadas_unlimited",
      "bot_extended", "bot_unlimited",
      "stats_advanced", "stats_unlimited",
      "retos_monthly", "retos_unlimited", "custom_retos",
      "alerts", "watchlist", "trader_mode", "ai_analyst",
    ],
    perks: [
      "Todo lo de Premium, sin límites",
      "Bot IA ilimitado",
      "Todos los retos incluidos (sin coste extra)",
      "Retos personalizados — bankroll, cuota, días",
    ],
    proFeatures: [
      "Combinadas IA avanzadas — \"cuota 3\", \"BTTS MLS\", \"corners Premier\"",
      "Analista IA Personal — análisis completo a demanda",
      "Watchlist Inteligente — alertas de equipos y ligas",
      "Modo Trader — edge, prob. implícita, quality score, filtros",
    ],
    limits: {
      valuePicks: -1,
      botMessagesPerDay: -1,
      combinadasPerDay: -1,
      statsSearchesPerDay: -1,
    },
  },
}

export const PLAN_ORDER: PlanId[] = ["free", "premium", "pro"]

/** ¿Tiene este plan acceso a una feature? */
export function planHas(plan: PlanId, feature: Feature): boolean {
  return PLANS[plan]?.features.includes(feature) ?? false
}

/** Plan mínimo que desbloquea una feature */
export function minPlanFor(feature: Feature): PlanId {
  for (const id of PLAN_ORDER) {
    if (planHas(id, feature)) return id
  }
  return "pro"
}

/** Límites del plan activo */
export function planLimits(plan: PlanId): PlanLimits {
  return PLANS[plan]?.limits ?? PLANS.free.limits
}
