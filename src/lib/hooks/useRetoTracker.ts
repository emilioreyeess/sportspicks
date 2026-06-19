"use client"

/**
 * useRetoTracker — mecánica de retención 100% CLIENT-SIDE (localStorage).
 *
 * Persiste el progreso del usuario en su reto SIN tocar la base de datos ni
 * autenticación: dinero acumulado jugado, días de racha y un registro simple de
 * los check-ins diarios ("Seguí a la IA" / "Aposté mi pick").
 */
import { useState, useEffect, useCallback } from "react"

const STORAGE_KEY = "sp_reto_tracker_v1"

export interface DailyCheckIn {
  iaFollowed?: boolean
  betPlaced?: boolean
  amount?: number
}

export interface RetoTrackerState {
  dineroAcumulado: number                    // total jugado (€)
  diasRacha: number                          // racha de días con check-in
  checkIns: Record<string, DailyCheckIn>     // "YYYY-MM-DD" → check-in del día
  lastCheckIn: string | null                 // último día con check-in
}

const EMPTY: RetoTrackerState = { dineroAcumulado: 0, diasRacha: 0, checkIns: {}, lastCheckIn: null }

const todayStr = () => new Date().toISOString().slice(0, 10)
const dayBefore = (iso: string) => new Date(new Date(iso).getTime() - 86_400_000).toISOString().slice(0, 10)

function load(): RetoTrackerState {
  if (typeof window === "undefined") return EMPTY
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY
  } catch { return EMPTY }
}

function save(s: RetoTrackerState) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch { /* quota / SSR */ }
}

export function useRetoTracker() {
  const [state, setState] = useState<RetoTrackerState>(EMPTY)
  const [hydrated, setHydrated] = useState(false)

  // Hidratación en cliente (evita mismatch SSR).
  useEffect(() => { setState(load()); setHydrated(true) }, [])

  /** Registra un check-in del día. Avanza la racha y suma el importe jugado. */
  const checkIn = useCallback((kind: "ia" | "bet", amount?: number) => {
    setState((prev) => {
      const today = todayStr()
      const prevDay = prev.checkIns[today] ?? {}
      const add = typeof amount === "number" && isFinite(amount) && amount > 0 ? amount : 0
      const day: DailyCheckIn = {
        ...prevDay,
        ...(kind === "ia" ? { iaFollowed: true } : { betPlaced: true }),
        amount: (prevDay.amount ?? 0) + add,
      }
      // Racha: primer check-in del día → +1 si ayer hubo, si no reinicia a 1.
      let diasRacha = prev.diasRacha
      if (prev.lastCheckIn !== today) {
        diasRacha = prev.lastCheckIn === dayBefore(today) ? prev.diasRacha + 1 : 1
      }
      const next: RetoTrackerState = {
        dineroAcumulado: Math.round((prev.dineroAcumulado + add) * 100) / 100,
        diasRacha,
        checkIns: { ...prev.checkIns, [today]: day },
        lastCheckIn: today,
      }
      save(next)
      return next
    })
  }, [])

  /** Reinicia el reto por completo. */
  const reset = useCallback(() => { setState(EMPTY); save(EMPTY) }, [])

  return {
    ...state,
    hydrated,
    checkIn,
    reset,
    todayCheckIn: state.checkIns[todayStr()] ?? null,
  }
}
