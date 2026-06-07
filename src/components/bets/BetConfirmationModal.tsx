"use client"

/**
 * BetConfirmationModal — confirmación tras el OCR del ticket.
 *
 * Muestra los datos "extraídos" (mock por ahora) para que el usuario los
 * corrija antes de publicar la apuesta en el chat del grupo:
 *   · Partido detectado → dropdown editable
 *   · Stake → input numérico
 *   · Cuota → input numérico
 *
 * Al confirmar, devuelve los datos estructurados al padre vía onConfirm.
 */

import { useEffect, useState } from "react"
import type { ExtractedBet } from "@/lib/bets/ocr-mock"

export interface ConfirmedBet {
  match: string
  stake: number
  odds: number
}

interface Props {
  open: boolean
  /** Datos extraídos por el OCR (mock). Null mientras no hay extracción. */
  data: ExtractedBet | null
  /** Preview de la imagen subida (object URL o URL pública). */
  imagePreview?: string | null
  saving?: boolean
  onConfirm: (bet: ConfirmedBet) => void
  onClose: () => void
}

export function BetConfirmationModal({ open, data, imagePreview, saving, onConfirm, onClose }: Props) {
  const [match, setMatch] = useState("")
  const [stake, setStake] = useState("")
  const [odds, setOdds] = useState("")

  // Rellena el formulario cuando llegan los datos del OCR.
  useEffect(() => {
    if (data) {
      setMatch(data.match)
      setStake(String(data.stake))
      setOdds(String(data.odds))
    }
  }, [data])

  if (!open || !data) return null

  const stakeNum = parseFloat(stake.replace(",", "."))
  const oddsNum = parseFloat(odds.replace(",", "."))
  const valid = match.trim() !== "" && Number.isFinite(stakeNum) && stakeNum > 0 && Number.isFinite(oddsNum) && oddsNum >= 1.01

  const inputCls =
    "w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white " +
    "placeholder-zinc-600 outline-none transition focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/30"

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm safe-bottom" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full sm:w-[440px] bg-zinc-900/95 border border-white/[0.08] rounded-t-3xl sm:rounded-2xl p-6 backdrop-blur-xl animate-slide-up sm:animate-scale-in">

        <div className="flex items-center gap-2 mb-1">
          <span className="grid place-items-center w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-700/40 text-emerald-400">✦</span>
          <h3 className="text-[16px] font-black text-white">Confirma tu apuesta</h3>
        </div>
        <p className="text-[12px] text-zinc-500 mb-4">
          Hemos leído estos datos del ticket. Revísalos y corrígelos si hace falta.
        </p>

        {imagePreview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imagePreview} alt="Ticket" className="w-full max-h-40 object-contain rounded-xl border border-white/[0.07] bg-zinc-950 mb-4" />
        )}

        <div className="space-y-3">
          {/* Partido — dropdown editable */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">Partido detectado</label>
            <select value={match} onChange={(e) => setMatch(e.target.value)} disabled={saving} className={inputCls}>
              {data.matchOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              {!data.matchOptions.includes(match) && <option value={match}>{match}</option>}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">Stake (€)</label>
              <input type="number" min="0.01" step="0.01" value={stake} onChange={(e) => setStake(e.target.value)} disabled={saving} className={inputCls} />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">Cuota</label>
              <input type="number" min="1.01" step="0.01" value={odds} onChange={(e) => setOdds(e.target.value)} disabled={saving} className={inputCls} />
            </div>
          </div>

          {stakeNum > 0 && oddsNum >= 1.01 && (
            <p className="text-[12px] text-zinc-500">
              Retorno potencial: <span className="text-emerald-400 font-semibold">{(stakeNum * oddsNum).toFixed(2)} €</span>
            </p>
          )}
        </div>

        <div className="mt-5 flex gap-2">
          <button onClick={onClose} disabled={saving}
            className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-sm text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03] transition-colors disabled:opacity-50">
            Cancelar
          </button>
          <button onClick={() => valid && onConfirm({ match: match.trim(), stake: stakeNum, odds: oddsNum })}
            disabled={!valid || saving}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${
              valid && !saving ? "bg-emerald-500 text-zinc-950 hover:bg-emerald-400" : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
            }`}>
            {saving ? "Publicando…" : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  )
}
