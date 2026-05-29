"use client"

/**
 * useLiveMatches — suscripción en tiempo real a `live_matches_cache` (STEP 3).
 *
 * El frontend NO llama a ESPN: lee la caché que mantiene el cron `live-sync` y
 * se suscribe vía Supabase Realtime (postgres_changes, WebSocket). El backend
 * actualiza la DB una vez por minuto y Supabase difunde el cambio a todos los
 * clientes. Resultado: 1 sola llamada externa por minuto para toda la app.
 */
import { useEffect, useRef, useState, useCallback } from "react"
import { supabase } from "@/lib/supabase/client"

export interface LiveMatch {
  match_id: string
  league: string
  league_name: string
  home_team: string
  away_team: string
  home_logo: string | null
  away_logo: string | null
  home_score: number
  away_score: number
  status_state: "pre" | "in" | "post" | string
  status_detail: string | null
  clock: string | null
  kickoff_iso: string | null
  odds_home: number | null
  odds_draw: number | null
  odds_away: number | null
}

const STATE_ORDER: Record<string, number> = { in: 0, pre: 1, post: 2 }

function sortMatches(list: LiveMatch[]): LiveMatch[] {
  return [...list].sort((a, b) => {
    const sa = STATE_ORDER[a.status_state] ?? 3
    const sb = STATE_ORDER[b.status_state] ?? 3
    if (sa !== sb) return sa - sb
    const ka = a.kickoff_iso ? new Date(a.kickoff_iso).getTime() : 0
    const kb = b.kickoff_iso ? new Date(b.kickoff_iso).getTime() : 0
    return ka - kb
  })
}

export function useLiveMatches(opts?: { onlyLive?: boolean; limit?: number }) {
  const onlyLive = opts?.onlyLive ?? false
  const limit = opts?.limit
  const [matches, setMatches] = useState<LiveMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(false)
  const mapRef = useRef<Map<string, LiveMatch>>(new Map())

  const publish = useCallback(() => {
    let list = sortMatches(Array.from(mapRef.current.values()))
    if (onlyLive) list = list.filter((m) => m.status_state === "in")
    if (limit && limit > 0) list = list.slice(0, limit)
    setMatches(list)
  }, [onlyLive, limit])

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    let cancelled = false

    // 1) Carga inicial desde la caché (no desde ESPN)
    ;(async () => {
      const { data } = await supabase
        .from("live_matches_cache")
        .select("*")
        .order("kickoff_iso", { ascending: true })
      if (cancelled) return
      mapRef.current = new Map((data ?? []).map((r: any) => [r.match_id, r as LiveMatch]))
      publish()
      setLoading(false)
    })()

    // 2) Suscripción Realtime: inserciones/updates/deletes en la tabla
    const channel = supabase
      .channel("live_matches_cache_rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_matches_cache" },
        (payload: any) => {
          if (payload.eventType === "DELETE") {
            const id = payload.old?.match_id
            if (id) mapRef.current.delete(id)
          } else {
            const row = payload.new as LiveMatch
            if (row?.match_id) mapRef.current.set(row.match_id, row)
          }
          publish()
        },
      )
      .subscribe((status: string) => {
        setConnected(status === "SUBSCRIBED")
      })

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [publish])

  const liveCount = matches.filter((m) => m.status_state === "in").length
  return { matches, loading, connected, liveCount }
}
