/**
 * /admin/dashboard — Panel de administración con visibilidad de la base de datos.
 *
 * Server Component: comprueba RBAC en el servidor (sesión + isAdminEmail) y
 * redirige a la home a cualquiera que no sea admin. La tabla interactiva vive en
 * el client component DashboardClient (consume /api/admin/users).
 */
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { isAdminEmail } from "@/lib/admin-auth"
import DashboardClient from "./DashboardClient"

export const dynamic = "force-dynamic"
export const metadata = { title: "Admin · SportsPicks", robots: { index: false, follow: false } }

export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email ?? null

  // RBAC: sin sesión → login; sesión no-admin → home.
  if (!email) redirect("/auth/signin?callbackUrl=/admin/dashboard")
  const admin = await isAdminEmail(email)
  if (!admin) redirect("/")

  return <DashboardClient adminEmail={email} />
}
