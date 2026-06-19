import WorldCupClient from "./WorldCupClient"

// FASE 2.4 — La vista del Mundial NO debe cachearse: los partidos, estados y
// marcadores los refresca el Cron Job (/api/cron/sync-football) en la BD cada
// hora. Server Component fino que declara la ruta 100% dinámica y renderiza el
// cliente. (En Next 15, estos exports no se permiten en un fichero "use client",
// por eso el cliente vive en WorldCupClient.tsx.)
export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

export default function WorldCup2026Page() {
  return <WorldCupClient />
}
