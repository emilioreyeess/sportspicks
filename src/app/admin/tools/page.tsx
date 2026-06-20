"use client"

/**
 * /admin/tools — Herramientas de emergencia (FASE 2)
 *
 * Ruta oculta (no enlazada desde la navegación). Misma puerta de token que /admin:
 * el ADMIN_TOKEN vive solo en estado de React y se borra al recargar.
 *
 * Botón de pánico "Forzar Resolución de Picks Pendientes" → POST /api/admin/settle-now,
 * que server-side re-dispara los liquidadores (árbitro IA + ESPN) con el CRON_SECRET.
 */
import { useState } from "react"
import { PageHeader, Card, Spinner } from "@/components/ui/primitives"
import { Icon } from "@/components/ui/icons"

interface RunResult {
  endpoint: string
  status: number
  ok: boolean
  result?: any
  error?: string
}

export default function AdminToolsPage() {
  const [token, setToken] = useState<string | null>(null)
  const [tokenInput, setTokenInput] = useState("")
  const [error, setError] = useState("")
  const [running, setRunning] = useState(false)
  const [runs, setRuns] = useState<RunResult[] | null>(null)
  const [ranAt, setRanAt] = useState<string | null>(null)

  function submitToken(e: React.FormEvent) {
    e.preventDefault()
    if (!tokenInput.trim()) return
    setToken(tokenInput.trim())
    setTokenInput("")
    setError("")
  }

  async function forceSettle() {
    if (!token) return
    setRunning(true)
    setError("")
    setRuns(null)
    try {
      const r = await fetch("/api/admin/settle-now", {
        method: "POST",
        headers: { "x-admin-token": token },
        cache: "no-store",
      })
      const data = await r.json().catch(() => null)
      if (r.status === 401) {
        setError("Token incorrecto o ADMIN_TOKEN no configurado.")
        setToken(null)
        return
      }
      if (!r.ok) {
        setError(data?.error ?? `Error ${r.status} al liquidar.`)
        setRuns(data?.runs ?? null)
        return
      }
      setRuns(data?.runs ?? [])
      setRanAt(data?.ranAt ?? new Date().toISOString())
    } catch (e: any) {
      setError(e?.message ?? "Fallo de red al contactar el endpoint.")
    } finally {
      setRunning(false)
    }
  }

  // ── Puerta de token ────────────────────────────────────────────────────
  if (!token) {
    return (
      <div className="px-4 py-12 max-w-sm mx-auto safe-x">
        <PageHeader icon="lock" title="Herramientas" subtitle="Acceso restringido · operador" />
        <Card className="p-5">
          <form onSubmit={submitToken} className="space-y-3">
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Admin token</span>
              <input
                type="password" value={tokenInput} onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Pega aquí tu ADMIN_TOKEN"
                autoFocus autoComplete="off"
                className="mt-1.5 w-full bg-zinc-800/40 border border-white/[0.08] focus:border-emerald-600/60 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none transition-colors font-mono"
              />
            </label>
            {error && <p className="text-xs text-rose-400">{error}</p>}
            <button type="submit" disabled={!tokenInput.trim()}
              className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-zinc-950 font-bold text-sm tap">
              Entrar
            </button>
          </form>
        </Card>
      </div>
    )
  }

  // ── Panel de herramientas ──────────────────────────────────────────────
  return (
    <div className="px-4 py-6 max-w-2xl mx-auto safe-x space-y-4">
      <PageHeader icon="settings" title="Herramientas de emergencia"
        subtitle="Fallback manual cuando los crons no se disparan" />

      <Card className="p-5">
        <div className="flex items-start gap-2 mb-3">
          <Icon name="shield" className="w-4.5 h-4.5 text-amber-400 mt-0.5" />
          <div>
            <h2 className="text-sm font-black text-white uppercase tracking-wide">Resolución de picks</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Re-ejecuta los liquidadores (árbitro IA + ESPN) sobre las apuestas en estado
              <span className="text-zinc-300 font-semibold"> pendiente</span>. Úsalo si quedaron picks
              de ayer sin resolver.
            </p>
          </div>
        </div>

        <button onClick={forceSettle} disabled={running}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 text-zinc-950 font-black text-sm tap disabled:opacity-40">
          {running
            ? <><Spinner className="w-4 h-4 text-zinc-950" /> Liquidando…</>
            : <><Icon name="settings" className="w-4 h-4" strokeWidth={2.4} /> Forzar Resolución de Picks Pendientes</>}
        </button>

        {error && <p className="text-xs text-rose-400 mt-3">{error}</p>}
      </Card>

      {runs && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Icon name="stats" className="w-4.5 h-4.5 text-emerald-400" />
            <h2 className="text-sm font-black text-white uppercase tracking-wide">Resultado</h2>
            {ranAt && <span className="text-[10px] text-zinc-600 ml-auto">{new Date(ranAt).toLocaleString("es-ES")}</span>}
          </div>
          <div className="space-y-2">
            {runs.map((run, i) => (
              <div key={i} className="rounded-lg bg-zinc-950/60 border border-white/[0.07] p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono text-zinc-300">{run.endpoint}</span>
                  <span className={`text-[11px] font-bold ${run.ok ? "text-emerald-400" : "text-rose-400"}`}>
                    {run.ok ? `OK · ${run.status}` : `FALLO · ${run.status || "—"}`}
                  </span>
                </div>
                <pre className="mt-1.5 text-[11px] text-zinc-500 font-mono leading-snug whitespace-pre-wrap break-all">
                  {run.error ?? JSON.stringify(run.result ?? {}, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
