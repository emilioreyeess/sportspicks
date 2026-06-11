import CombinadasClient from "./CombinadasClient"

// FASE 1 — DESTRUCCIÓN DEL FULL ROUTE CACHE:
// Este page.tsx es un Server Component fino (sin "use client") cuyo único cometido
// es declarar la ruta como 100% dinámica y renderizar el cliente. Así Next.js NO
// prerrenderiza ni cachea el HTML de la ruta en build → nada queda "fosilizado".
// (En Next 15 estos exports NO se permiten en un fichero "use client"; por eso se
//  separó el componente cliente en CombinadasClient.tsx.)
export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

export default function CombinadasPage() {
  return <CombinadasClient />
}
