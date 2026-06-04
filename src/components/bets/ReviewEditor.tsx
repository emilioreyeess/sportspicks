"use client"

/**
 * ReviewEditor — panel de rescate OCR embebido en BetCard.
 *
 * Se muestra cuando `needs_review === true` (el OCR no pudo detectar el stake
 * o la confianza fue < 0.7). Permite corregir stake y cuota combinada sin
 * abandonar la vista de apuestas.
 *
 * Contrato R1: el botón "Publicar" permanece disabled mientras stake sea null
 * o <= 0. "Guardar borrador" solo requiere stake > 0 y cuota >= 1.01.
 */

import { useState } from "react"

// ── Tipos públicos ──────────────────────────────────────────────────────────

export interface ReviewableBet {
  id: string
  stake: number | null
  combined_odds: number | null
}

export interface SavedReview {
  stake: number
  combined_odds: number
  needs_review: false
  is_published: boolean
}

interface ReviewEditorProps {
  bet: ReviewableBet
  /** Llamado tras guardar con éxito — pasa el bet actualizado para que el
   *  padre actualice su estado local sin recargar la página entera. */
  onSaved: (patch: SavedReview) => void
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function parsePositive(raw: string): number | null {
  const n = parseFloat(raw.replace(",", "."))
  return Number.isFinite(n) && n > 0 ? n : null
}

// ── Estilos base ────────────────────────────────────────────────────────────

const inputCls =
  "w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white " +
  "placeholder-zinc-600 outline-none transition " +
  "focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/30"

const labelCls = "block text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-1.5"

// ── Componente ──────────────────────────────────────────────────────────────

export function ReviewEditor({ bet, onSaved }: ReviewEditorProps) {
  const [stakeRaw, setStakeRaw] = useState(bet.stake != null ? String(bet.stake) : "")
  const [oddsRaw, setOddsRaw]   = useState(bet.combined_odds != null ? String(bet.combined_odds) : "")
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const stakeVal = parsePositive(stakeRaw)
  const oddsVal  = parsePositive(oddsRaw)
  const oddsOk   = oddsVal !== null && oddsVal >= 1.01
  const formOk   = stakeVal !== null && oddsOk

  const save = async (publish: boolean) => {
    if (!formOk) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/bets/${bet.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ stake: stakeVal, combined_odds: oddsVal, publish }),
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        setError((payload as { error?: string }).error ?? "Error al guardar")
        return
      }
      onSaved({ stake: stakeVal!, combined_odds: oddsVal!, needs_review: false, is_published: publish })
    } catch {
      setError("Error de red — inténtalo de nuevo")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border-t border-amber-500/20 bg-amber-500/[0.04] px-4 py-3.5 space-y-3">

      {/* ── Cabecera de aviso ─────────────────────────────────────────────── */}
      <div className="flex items-start gap-2">
        <span className="text-amber-400 text-base leading-none mt-px shrink-0">⚠</span>
        <div>
          <p className="text-[11px] font-bold text-amber-300 uppercase tracking-wide leading-tight">
            Revisión pendiente
          </p>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            El OCR no detectó todos los datos. Corrígelos para guardar o publicar la apuesta.
          </p>
        </div>
      </div>

      {/* ── Campos editables ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Stake (€)</label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            value={stakeRaw}
            onChange={e => { setStakeRaw(e.target.value); setError(null) }}
            className={inputCls}
            disabled={saving}
            aria-label="Stake en euros"
          />
          {stakeRaw !== "" && stakeVal === null && (
            <p className="text-[10px] text-red-400 mt-1">Introduce un valor mayor que 0</p>
          )}
        </div>
        <div>
          <label className={labelCls}>Cuota combinada</label>
          <input
            type="number"
            min="1.01"
            step="0.01"
            placeholder="1.00"
            value={oddsRaw}
            onChange={e => { setOddsRaw(e.target.value); setError(null) }}
            className={inputCls}
            disabled={saving}
            aria-label="Cuota combinada"
          />
          {oddsRaw !== "" && !oddsOk && (
            <p className="text-[10px] text-red-400 mt-1">Mínimo 1.01</p>
          )}
        </div>
      </div>

      {/* ── Retorno estimado ─────────────────────────────────────────────── */}
      {stakeVal !== null && oddsVal !== null && oddsOk && (
        <p className="text-[11px] text-zinc-500">
          Retorno estimado:{" "}
          <span className="text-emerald-400 font-semibold font-mono">
            {(stakeVal * oddsVal).toFixed(2)} €
          </span>
        </p>
      )}

      {/* ── Error de API ─────────────────────────────────────────────────── */}
      {error && (
        <p className="text-[11px] text-red-400 font-medium">{error}</p>
      )}

      {/* ── Acciones ─────────────────────────────────────────────────────── */}
      <div className="flex gap-2 pt-0.5">
        <button
          onClick={() => save(false)}
          disabled={!formOk || saving}
          className={[
            "flex-1 text-xs py-2 rounded-xl border transition",
            formOk && !saving
              ? "bg-zinc-800/70 border-white/10 text-zinc-300 hover:bg-zinc-700/60 hover:text-white"
              : "bg-zinc-900/40 border-white/[0.05] text-zinc-600 cursor-not-allowed opacity-50",
          ].join(" ")}
        >
          {saving ? "Guardando…" : "Guardar borrador"}
        </button>

        <button
          onClick={() => save(true)}
          disabled={!formOk || saving}
          className={[
            "flex-1 text-xs py-2 rounded-xl border font-semibold transition",
            formOk && !saving
              ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/25"
              : "bg-cyan-900/10 border-cyan-900/20 text-cyan-800 cursor-not-allowed opacity-40",
          ].join(" ")}
        >
          {saving ? "Publicando…" : "Guardar y publicar"}
        </button>
      </div>
    </div>
  )
}
