"use client"

import { useState } from "react"

interface Group { id: string; name: string; emoji?: string }

/**
 * Botón "Enviar a grupo" para una apuesta de Mis Apuestas. Abre un selector
 * inline con los grupos del usuario y comparte la apuesta (POST a
 * /api/groups/[id]/bets). Surfacea el error del servidor (incl. el bloqueo
 * anti-trampas de FASE 2: "El partido ya ha empezado…").
 */
export function ShareToGroupButton({ betId }: { betId: string }) {
  const [open, setOpen] = useState(false)
  const [groups, setGroups] = useState<Group[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function toggle(e: React.MouseEvent) {
    e.stopPropagation()
    const next = !open
    setOpen(next)
    setMsg(null)
    if (next && groups === null) {
      try {
        const r = await fetch("/api/groups")
        const d = await r.json()
        setGroups(d.groups ?? [])
      } catch {
        setGroups([])
      }
    }
  }

  async function share(e: React.MouseEvent, groupId: string) {
    e.stopPropagation()
    setBusy(true)
    setMsg(null)
    try {
      const r = await fetch(`/api/groups/${groupId}/bets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bet_id: betId }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        setMsg({ ok: false, text: d.error ?? "No se pudo compartir." })
      } else {
        setMsg({ ok: true, text: "Compartida al grupo ✓" })
        setTimeout(() => setOpen(false), 1100)
      }
    } catch {
      setMsg({ ok: false, text: "Error de red." })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={toggle}
        className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 text-xs font-semibold border border-cyan-700/40 transition"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.7 10.7l6.6-3.4M8.7 13.3l6.6 3.4M18 8a3 3 0 10-3-3 3 3 0 003 3zm0 11a3 3 0 10-3-3 3 3 0 003 3zM6 15a3 3 0 100-6 3 3 0 000 6z" />
        </svg>
        Enviar a grupo
      </button>

      {open && (
        <div
          className="absolute z-50 mt-1 right-0 w-56 max-h-48 overflow-y-auto rounded-xl border border-white/[0.10] bg-zinc-900 shadow-2xl p-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          {groups === null ? (
            <p className="px-2 py-2 text-xs text-zinc-500">Cargando grupos…</p>
          ) : groups.length === 0 ? (
            <p className="px-2 py-2 text-xs text-zinc-500">No estás en ningún grupo todavía.</p>
          ) : (
            groups.map((g) => (
              <button
                key={g.id}
                disabled={busy}
                onClick={(e) => share(e, g.id)}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-[13px] text-zinc-200 hover:bg-white/[0.05] disabled:opacity-50 transition"
              >
                <span className="text-base leading-none">{g.emoji ?? "⚽"}</span>
                <span className="truncate">{g.name}</span>
              </button>
            ))
          )}
          {msg && (
            <p className={`px-2 py-1.5 text-[11px] ${msg.ok ? "text-emerald-400" : "text-rose-400"}`}>{msg.text}</p>
          )}
        </div>
      )}
    </div>
  )
}
