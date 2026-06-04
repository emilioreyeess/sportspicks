"use client"

/**
 * LazyRefreshTrigger — componente invisible de infraestructura (Bloque C).
 *
 * Problema resuelto: el cron ml-settle solo corre 1×/día (Vercel Hobby).
 * Solución: cuando el servidor detecta picks pendientes vencidos, devuelve
 * `hasPendingSettles: true`. El servidor liquidará en background vía after().
 * Este componente espera SETTLE_REFETCH_DELAY_MS y luego dispara un re-fetch
 * silencioso del primer bloque de historico para mostrar los picks recién
 * liquidados SIN spinners ni redirecciones.
 *
 * Garantías:
 * - Solo se activa si hasPendingSettles === true.
 * - Dispara onRefresh exactamente una vez por montaje.
 * - El timeout se limpia si el componente se desmonta antes.
 * - No renderiza nada visible.
 */

import { useEffect, useRef } from "react"

// Tiempo de espera tras recibir hasPendingSettles=true. El after() del servidor
// tarda ~3-7s en completar (COUNT + ESPN fetch + DB updates). 8s garantiza que
// el resultado está disponible antes del re-fetch.
const SETTLE_REFETCH_DELAY_MS = 8_000

interface LazyRefreshTriggerProps {
  /** El servidor indica que un settle está corriendo en background. */
  hasPendingSettles: boolean
  /** Callback que recarga el primer bloque de picks de forma silenciosa. */
  onRefresh: () => void
}

export function LazyRefreshTrigger({ hasPendingSettles, onRefresh }: LazyRefreshTriggerProps) {
  const scheduled = useRef(false)

  useEffect(() => {
    if (!hasPendingSettles || scheduled.current) return
    scheduled.current = true

    const id = setTimeout(onRefresh, SETTLE_REFETCH_DELAY_MS)
    return () => clearTimeout(id)
  }, [hasPendingSettles, onRefresh])

  return null
}
