"use client"

import { useCallback, useEffect, useState } from "react"
import { PageHeader, Card, Spinner } from "@/components/ui/primitives"
import { Icon } from "@/components/ui/icons"

interface AdminData {
  date: string | null
  meta: {
    status: string
    lastRunAt: string | null
    lastSuccessAt: string | null
    nextRunAt: string | null
    durationMs: number
    runCount: number
    errorCount: number
    counts: { matches: number; valuePicks: number; combinadas: number; retos: number }
    errors: string[]
    logs: string[]
  }
  sample: {
    valuePicks: { selection: string; market: string; quality: number; edge: number; odd: number }[]
    retos: { title: string; daily_pick: string | null; odd: number | null }[]
  }
}

const STATUS: Record<string, { label: string; cls: string; dot: string }> = {
  ready:   { label: "Operativo", cls: "text-emerald-400", dot: "bg-emerald-400" },
  running: { label: "Ejecutando", cls: "text-amber-400", dot: "bg-amber-400 animate-pulse" },
  error:   { label: "Con errores", cls: "text-rose-400", dot: "bg-rose-400" },
  cold:    { label: "Sin iniciar", cls: "text-zinc-400", dot: "bg-zinc-500" },
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
}

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null)
  const [tokenInput, setTokenInput] = useState("")
  const [tokenError, setTokenError] = useState("")
  const [data, setData] = useState<AdminData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // CN-025: Token kept in React state only — not persisted to sessionStorage
  useEffect(() => {
    // No-op: token lives in component state; cleared on page reload (intentional)
  }, [])

  const load = useCallback(async (tok: string) => {
    try {
      const r = await fetch("/api/admin", {
        cache: "no-store",
        headers: { "x-admin-token": tok },
      })
      if (r.status === 401) {
        setTokenError("Token incorrecto")
        setToken(null)
        return
      }
      setData(await r.json())
      setTokenError("")
    } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (!token) { setLoading(false); return }
    load(token)
    const t = setInterval(() => load(token), 10000)
    return () => clearInterval(t)
  }, [token, load])

  function submitToken(e: React.FormEvent) {
    e.preventDefault()
    if (!tokenInput.trim()) return
    // CN-025: Store only in React state — do not persist to sessionStorage
    setToken(tokenInput.trim())
    setTokenInput("")
    setLoading(true)
  }

  async function forceRefresh() {
    if (!token) return
    setRefreshing(true)
    try {
      await fetch("/api/admin", { method: "POST", headers: { "x-admin-token": token } })
      await load(token)
    } catch {} finally { setRefreshing(false) }
  }

  // Pantalla de login
  if (!token) {
    return (
      <div className="px-4 py-12 max-w-sm mx-auto safe-x">
        <PageHeader icon="lock" title="Panel de control" subtitle="Acceso restringido · operador" />
        <Card className="p-5">
          <form onSubmit={submitToken} className="space-y-3">
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Admin token</span>
              <input
                type="password" value={tokenInput} onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Pega aquí tu ADMIN_TOKEN"
                autoFocus autoComplete="off"
                className="mt-1.5 w-full bg-zinc-800 border border-zinc-700 focus:border-emerald-600 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none transition-colors font-mono"
              />
            </label>
            {tokenError && <p className="text-xs text-rose-400">{tokenError}</p>}
            <button type="submit" disabled={!tokenInput.trim()}
              className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-zinc-950 font-bold text-sm tap">
              Entrar
            </button>
            <p className="text-[10px] text-zinc-600 text-center mt-2">
              El token está en `.env.local` del servidor. Solo existe en memoria — se borra al recargar.
            </p>
          </form>
        </Card>
      </div>
    )
  }

  const meta = data?.meta
  const st = STATUS[meta?.status ?? "cold"] ?? STATUS.cold

  return (
    <div className="px-4 py-6 max-w-3xl mx-auto safe-x space-y-4">
      <PageHeader icon="settings" title="Panel de control"
        subtitle="Pipeline diario · monitorización interna · datos reales" />

      {loading ? (
        <div className="py-16 grid place-items-center"><Spinner className="w-7 h-7" /></div>
      ) : !data ? (
        <Card className="p-6 text-center text-sm text-zinc-400">No se pudo cargar el estado.</Card>
      ) : (
        <>
          {/* Status */}
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className={`h-2.5 w-2.5 rounded-full ${st.dot}`} />
                <div>
                  <p className={`text-lg font-black ${st.cls}`}>{st.label}</p>
                  <p className="text-xs text-zinc-500">Pipeline · {data.date ?? "sin datos"}</p>
                </div>
              </div>
              <button onClick={forceRefresh} disabled={refreshing || meta?.status === "running"}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-zinc-950 font-bold text-sm tap disabled:opacity-40">
                {refreshing
                  ? <><Spinner className="w-4 h-4 text-zinc-950" /> Actualizando…</>
                  : <><Icon name="settings" className="w-4 h-4" strokeWidth={2.2} /> Forzar refresh</>}
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-center">
              <Mini label="Última ejecución" value={fmtTime(meta!.lastSuccessAt)} />
              <Mini label="Próxima (00:00)" value={fmtTime(meta!.nextRunAt)} />
              <Mini label="Duración" value={`${(meta!.durationMs / 1000).toFixed(1)}s`} />
              <Mini label="Ejecuciones" value={`${meta!.runCount} · ${meta!.errorCount} err`} />
            </div>
          </Card>

          {/* Counts */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Count icon="combinadas" label="Partidos" value={meta!.counts.matches} c="text-blue-400" />
            <Count icon="value" label="Value picks" value={meta!.counts.valuePicks} c="text-emerald-400" />
            <Count icon="combinadas" label="Combinadas" value={meta!.counts.combinadas} c="text-amber-400" />
            <Count icon="trophy" label="Retos" value={meta!.counts.retos} c="text-rose-400" />
          </div>

          {/* Sample value picks */}
          <Card className="p-5">
            <SectionTitle icon="value" title={`Value picks de hoy (${data.sample.valuePicks.length})`} />
            {data.sample.valuePicks.length === 0 ? (
              <p className="text-sm text-zinc-500">Sin value picks en esta ejecución.</p>
            ) : (
              <div className="space-y-1.5">
                {data.sample.valuePicks.map((p, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-zinc-200 truncate">{p.selection}</span>
                    <span className="shrink-0 text-zinc-500 text-xs">
                      <span className="text-emerald-400 font-bold">{p.quality}/100</span> · +{p.edge}% · @{p.odd}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Retos */}
          <Card className="p-5">
            <SectionTitle icon="trophy" title="Picks diarios de retos" />
            <div className="space-y-1.5">
              {data.sample.retos.map((r, i) => (
                <div key={i} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-zinc-300">{r.title}</span>
                  <span className="text-zinc-500 text-xs truncate">
                    {r.daily_pick ? `${r.daily_pick} @${r.odd}` : "sin pick"}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Errors */}
          {meta!.errors.length > 0 && (
            <Card className="p-5 border-rose-900/50">
              <SectionTitle icon="shield" title="Errores recientes" />
              <div className="space-y-1">
                {meta!.errors.map((e, i) => (
                  <p key={i} className="text-xs text-rose-300/90 font-mono leading-snug">{e}</p>
                ))}
              </div>
            </Card>
          )}

          {/* Logs */}
          <Card className="p-5">
            <SectionTitle icon="stats" title="Registro del pipeline" />
            <div className="max-h-72 overflow-y-auto rounded-lg bg-zinc-950 border border-zinc-800 p-3 space-y-0.5">
              {meta!.logs.length === 0 ? (
                <p className="text-xs text-zinc-600">Sin registros todavía.</p>
              ) : meta!.logs.map((l, i) => (
                <p key={i} className="text-[11px] text-zinc-400 font-mono leading-snug whitespace-pre-wrap">{l}</p>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-zinc-950/60 border border-zinc-800 p-2.5">
      <p className="text-[10px] text-zinc-600 uppercase tracking-wide">{label}</p>
      <p className="text-xs font-bold text-zinc-200 mt-0.5">{value}</p>
    </div>
  )
}

function Count({ icon, label, value, c }: { icon: string; label: string; value: number; c: string }) {
  return (
    <Card className="p-3.5">
      <Icon name={icon} className={`w-5 h-5 ${c} mb-1.5`} />
      <p className={`text-2xl font-black ${c}`}>{value}</p>
      <p className="text-[10px] text-zinc-600">{label}</p>
    </Card>
  )
}

function SectionTitle({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon name={icon} className="w-4.5 h-4.5 text-emerald-400" />
      <h2 className="text-sm font-black text-white uppercase tracking-wide">{title}</h2>
    </div>
  )
}
