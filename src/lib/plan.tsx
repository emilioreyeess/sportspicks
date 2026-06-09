"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { useSession } from "@/lib/auth-client"
import { PLANS, planHas, type Feature, type PlanId } from "@/lib/plans"

/**
 * Contexto de plan del usuario.
 *
 * Fuente de verdad (por orden de prioridad):
 *   1. Servidor (/api/auth/plan) si hay sesión activa — grants manuales + Stripe.
 *   2. localStorage — caché local y fallback para usuarios no autenticados.
 *
 * El resto de la app (usePlan / <Gate/> / paywalls) NO necesita cambios.
 */

const STORAGE_KEY = "sp_plan"

interface PlanContextValue {
  plan: PlanId
  setPlan: (p: PlanId) => void
  isPremium: boolean
  isPro: boolean
  isVipTipster: boolean
  can: (feature: Feature) => boolean
  ready: boolean
}

const PlanContext = createContext<PlanContextValue | null>(null)

function readStoredPlan(): PlanId {
  if (typeof window === "undefined") return "free"
  const v = window.localStorage.getItem(STORAGE_KEY)
  return v === "premium" || v === "pro" ? v : "free"
}

function writeStoredPlan(p: PlanId) {
  try { window.localStorage.setItem(STORAGE_KEY, p) } catch {}
}

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const [plan, setPlanState] = useState<PlanId>("free")
  const [isVipTipster, setIsVipTipster] = useState(false)
  const [ready, setReady] = useState(false)

  // ─── Paso 1: cargar localStorage inmediatamente (sin flash) ──────────────
  useEffect(() => {
    setPlanState(readStoredPlan())
  }, [])

  // ─── Paso 2: si hay sesión, preguntar al servidor ─────────────────────────
  useEffect(() => {
    if (status === "loading") return        // sesión aún cargando
    if (status === "unauthenticated") {
      setReady(true)
      return
    }
    if (!session?.user?.email) {
      setReady(true)
      return
    }

    // Consulta server-side: grants manuales + Stripe
    fetch("/api/auth/plan", { credentials: "include" })
      .then(async (r) => {
        if (!r.ok) return
        const data = await r.json() as { plan: PlanId; source: string; is_vip_tipster?: boolean }
        const resolved = data.plan === "premium" || data.plan === "pro" ? data.plan : "free"
        setPlanState(resolved)
        writeStoredPlan(resolved)           // sincronizar localStorage como caché
        setIsVipTipster(data.is_vip_tipster === true)
      })
      .catch(() => {
        // Error de red → usar localStorage como fallback
        setPlanState(readStoredPlan())
      })
      .finally(() => setReady(true))
  }, [status, session?.user?.email])

  // ─── Para usuarios no autenticados: ready en cuanto carga localStorage ────
  useEffect(() => {
    if (status === "unauthenticated") setReady(true)
  }, [status])

  const setPlan = useCallback((p: PlanId) => {
    setPlanState(p)
    writeStoredPlan(p)
  }, [])

  const value = useMemo<PlanContextValue>(() => ({
    plan,
    setPlan,
    isPremium: plan === "premium" || plan === "pro",
    isPro: plan === "pro",
    isVipTipster,
    can: (feature: Feature) => planHas(plan, feature),
    ready,
  }), [plan, setPlan, isVipTipster, ready])

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>
}

export function usePlan(): PlanContextValue {
  const ctx = useContext(PlanContext)
  if (!ctx) {
    return {
      plan: "free", setPlan: () => {}, isPremium: false, isPro: false,
      isVipTipster: false, can: () => false, ready: true,
    }
  }
  return ctx
}

export function planLabel(plan: PlanId): string {
  return PLANS[plan].name
}
