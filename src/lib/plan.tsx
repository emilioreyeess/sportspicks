"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { PLANS, planHas, type Feature, type PlanId } from "@/lib/plans"

/**
 * Contexto de plan del usuario.
 *
 * Fuente de verdad actual: localStorage (sin Stripe). Cuando se integre el pago,
 * se sustituye `readStoredPlan` por la sesión real del usuario — el resto de la
 * app (usePlan / <Gate/> / paywalls) NO necesita cambios.
 */

const STORAGE_KEY = "sp_plan"

interface PlanContextValue {
  plan: PlanId
  setPlan: (p: PlanId) => void
  isPremium: boolean
  isPro: boolean
  can: (feature: Feature) => boolean
  ready: boolean
}

const PlanContext = createContext<PlanContextValue | null>(null)

function readStoredPlan(): PlanId {
  if (typeof window === "undefined") return "free"
  const v = window.localStorage.getItem(STORAGE_KEY)
  return v === "premium" || v === "pro" ? v : "free"
}

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const [plan, setPlanState] = useState<PlanId>("free")
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setPlanState(readStoredPlan())
    setReady(true)
  }, [])

  const setPlan = useCallback((p: PlanId) => {
    setPlanState(p)
    try { window.localStorage.setItem(STORAGE_KEY, p) } catch {}
  }, [])

  const value = useMemo<PlanContextValue>(() => ({
    plan,
    setPlan,
    isPremium: plan === "premium" || plan === "pro",
    isPro: plan === "pro",
    can: (feature: Feature) => planHas(plan, feature),
    ready,
  }), [plan, setPlan, ready])

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>
}

export function usePlan(): PlanContextValue {
  const ctx = useContext(PlanContext)
  if (!ctx) {
    // Fallback seguro si se usa fuera del provider
    return {
      plan: "free", setPlan: () => {}, isPremium: false, isPro: false,
      can: () => false, ready: true,
    }
  }
  return ctx
}

export function planLabel(plan: PlanId): string {
  return PLANS[plan].name
}
