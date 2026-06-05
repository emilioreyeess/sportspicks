/**
 * /admin/usuarios — Panel de control de usuarios (solo admin).
 *
 * Server Component. Lee `users_log` (la tabla real de usuarios del proyecto:
 * NextAuth → users_log; `auth.users` está vacío y no es accesible vía REST).
 * Gateado server-side con requireAdmin() — redirige a "/" si no es admin.
 *
 * Diseño brutalista: tabla densa, bordes 1px duros, fuente mono, alto contraste.
 */

import { redirect } from "next/navigation"
import { requireAdmin } from "@/lib/admin-auth"
import { createServiceClient } from "@/lib/supabase/client"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

interface UserRow {
  email:         string
  name:          string | null
  plan:          string | null
  first_sign_in: string | null
  last_sign_in:  string | null
  sign_in_count: number | null
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  try {
    return new Intl.DateTimeFormat("es-ES", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid",
    }).format(new Date(iso))
  } catch {
    return "—"
  }
}

export default async function AdminUsuariosPage() {
  // ── Gate de seguridad server-side ──────────────────────────────────────────
  // requireAdmin() resuelve la sesión (getServerSession) y comprueba is_admin /
  // ADMIN_EMAILS. No se confía en ningún flag de cliente. No-admin → redirect.
  const gate = await requireAdmin()
  if (!gate.ok) redirect("/")

  // ── Carga de usuarios (service_role) ───────────────────────────────────────
  let users: UserRow[] = []
  let loadError = false
  try {
    const sb = createServiceClient()
    const { data, error } = await sb
      .from("users_log")
      .select("email, name, plan, first_sign_in, last_sign_in, sign_in_count")
      .order("first_sign_in", { ascending: false })
      .limit(500)
    if (error) loadError = true
    else users = (data ?? []) as UserRow[]
  } catch {
    loadError = true
  }

  const premium = users.filter((u) => u.plan === "premium" || u.plan === "pro").length

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10 pb-24">

      {/* ── Cabecera ──────────────────────────────────────────────────── */}
      <header className="border-b-2 border-zinc-700 pb-5">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-zinc-600 mb-2">
              Admin · {gate.email}
            </p>
            <h1 className="text-[clamp(1.5rem,4vw,2.25rem)] font-black text-white tracking-tighter leading-none uppercase">
              Usuarios
            </h1>
          </div>
          <p className="font-mono text-[13px] text-zinc-500 tabular-nums">
            {users.length} registrados · {premium} premium
          </p>
        </div>
      </header>

      {/* ── Tabla ─────────────────────────────────────────────────────── */}
      {users.length > 0 ? (
        <div className="overflow-x-auto border border-zinc-800 border-t-0">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-zinc-900 border-b-2 border-zinc-700">
                {["Email", "Nombre", "Plan", "Alta", "Último acceso", "Logins"].map((h, i) => (
                  <th
                    key={h}
                    className={`px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500 text-left ${
                      i < 5 ? "border-r border-zinc-800/60" : ""
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isPrem = u.plan === "premium" || u.plan === "pro"
                return (
                  <tr key={u.email} className="border-b border-zinc-800 hover:bg-zinc-900/60 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-[12px] text-white whitespace-nowrap border-r border-zinc-800/60">
                      {u.email}
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-zinc-400 whitespace-nowrap border-r border-zinc-800/60">
                      {u.name ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 border-r border-zinc-800/60">
                      <span
                        className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          isPrem ? "bg-emerald-400 text-black" : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                        }`}
                      >
                        {u.plan ?? "free"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-zinc-500 tabular-nums whitespace-nowrap border-r border-zinc-800/60">
                      {fmtDate(u.first_sign_in)}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-zinc-500 tabular-nums whitespace-nowrap border-r border-zinc-800/60">
                      {fmtDate(u.last_sign_in)}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[12px] text-zinc-400 tabular-nums text-right">
                      {u.sign_in_count ?? 0}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="border border-zinc-800 border-t-0 px-6 py-16 text-center">
          <p className="font-mono text-[13px] text-zinc-600 uppercase tracking-wide">
            {loadError ? "// error al cargar usuarios" : "// sin usuarios registrados"}
          </p>
        </div>
      )}

      <p className="mt-4 font-mono text-[10px] text-zinc-700 uppercase tracking-wider">
        Fuente: users_log · acceso service_role · gate requireAdmin()
      </p>
    </main>
  )
}
