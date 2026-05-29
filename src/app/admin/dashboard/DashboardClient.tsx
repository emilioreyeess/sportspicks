"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { PageHeader, Card, Input, Badge, Spinner, StatCard, EmptyState } from "@/components/ui/primitives"

interface UserRow {
  email: string
  name: string | null
  avatar_url: string | null
  provider: string | null
  plan: string
  registered_at: string | null
  last_login_at: string | null
  sign_in_count: number
  is_admin: boolean
  total_bets: number
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (isNaN(d.getTime())) return "—"
  return d.toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
}

function planTone(plan: string): "emerald" | "violet" | "zinc" {
  if (plan === "pro") return "violet"
  if (plan === "premium") return "emerald"
  return "zinc"
}

export default function DashboardClient({ adminEmail }: { adminEmail: string }) {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async (q: string) => {
    setLoading(true)
    setError(null)
    try {
      const url = q.trim() ? `/api/admin/users?q=${encodeURIComponent(q.trim())}` : "/api/admin/users"
      const res = await fetch(url, { cache: "no-store" })
      if (res.status === 401 || res.status === 403) {
        setError("Acceso no autorizado.")
        setUsers([])
        return
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setUsers(Array.isArray(data.users) ? data.users : [])
    } catch (e: any) {
      setError(e?.message ?? "Error al cargar usuarios")
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Carga inicial
  useEffect(() => { load("") }, [load])

  // Búsqueda con debounce (filtra por email en servidor)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => load(search), 350)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search, load])

  const stats = useMemo(() => {
    const total = users.length
    const premium = users.filter((u) => u.plan === "premium").length
    const pro = users.filter((u) => u.plan === "pro").length
    const bets = users.reduce((s, u) => s + (u.total_bets ?? 0), 0)
    return { total, premium, pro, bets }
  }, [users])

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-8">
      <PageHeader
        icon="shield"
        title="Panel de administración"
        subtitle={`Sesión: ${adminEmail}`}
        breadcrumb={[{ label: "Admin", href: "/admin" }]}
      />

      {/* Resumen */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
        <StatCard value={String(stats.total)} label="Usuarios" color="emerald" />
        <StatCard value={String(stats.premium)} label="Premium" color="cyan" />
        <StatCard value={String(stats.pro)} label="Pro" color="violet" />
        <StatCard value={String(stats.bets)} label="Apuestas totales" color="amber" />
      </div>

      {/* Buscador */}
      <Card className="mb-4 p-4">
        <Input
          iconLeft="search"
          placeholder="Buscar por email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Buscar usuario por email"
        />
      </Card>

      {/* Tabla */}
      <Card className="overflow-hidden p-0">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner className="w-6 h-6" />
          </div>
        ) : error ? (
          <div className="py-12">
            <EmptyState emoji="🔒" title={error} hint="Verifica tus permisos de administrador." />
          </div>
        ) : users.length === 0 ? (
          <div className="py-12">
            <EmptyState emoji="🔍" title="Sin resultados" hint="Prueba con otro email." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-white/[0.08] text-[11px] uppercase tracking-wide text-zinc-500">
                  <th className="px-4 py-3 font-semibold">Usuario</th>
                  <th className="px-4 py-3 font-semibold">Registro</th>
                  <th className="px-4 py-3 font-semibold">Último acceso</th>
                  <th className="px-4 py-3 font-semibold">Plan</th>
                  <th className="px-4 py-3 font-semibold text-right">Apuestas</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.email} className="border-b border-white/[0.05] hover:bg-white/[0.03] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-[12px] font-bold text-emerald-300">
                          {(u.name ?? u.email).slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate font-medium text-white">{u.name ?? "—"}</span>
                            {u.is_admin && <Badge tone="violet">admin</Badge>}
                          </div>
                          <div className="truncate text-[12px] text-zinc-500">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{fmtDate(u.registered_at)}</td>
                    <td className="px-4 py-3 text-zinc-400">{fmtDateTime(u.last_login_at)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={planTone(u.plan)}>{u.plan}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-white tabular-nums">{u.total_bets}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="mt-4 text-center text-[12px] text-zinc-600">
        {loading ? "Cargando…" : `${users.length} usuario${users.length === 1 ? "" : "s"} mostrados`}
      </p>
    </div>
  )
}
