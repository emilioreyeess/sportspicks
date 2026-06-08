/**
 * csv-logger — serialización CSV del histórico de picks (PickRecord).
 *
 * Pure functions, SIN `fs`: en Vercel el filesystem del proyecto es read-only y
 * `/tmp` es efímero, así que un `appendFileSync` local NO persistiría. El
 * histórico auditable real vive en Supabase (`predictions_log`); este módulo
 * solo lo formatea a CSV (lo consume el endpoint de export).
 *
 * Decimales con punto (.) — `Number.toString` no usa coma local.
 */

import type { PickRecord } from "@/data/picks"

export const CSV_HEADER =
  "id,date,event,market,recommendedOdds,stakeUnits,closingLineValue,result"

/** Escapa un campo CSV: comilla-envuelto si contiene coma, comilla o salto. */
function esc(v: string): string {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

/** Número con punto decimal siempre; `0` si no es finito. */
function num(n: number): string {
  return Number.isFinite(n) ? String(n) : "0"
}

/** Serializa UN PickRecord a una línea CSV. */
export function toCsvRow(p: PickRecord): string {
  return [
    esc(p.id),
    esc(p.date),
    esc(p.event),
    esc(p.market),
    num(p.recommendedOdds),
    num(p.stakeUnits),
    num(p.closingLineValue),
    esc(p.result),
  ].join(",")
}

/** Serializa un array de PickRecord a CSV completo (cabecera + filas + LF final). */
export function toCsv(picks: PickRecord[]): string {
  return [CSV_HEADER, ...picks.map(toCsvRow)].join("\n") + "\n"
}
