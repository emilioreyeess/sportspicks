/**
 * OCR de tickets de apuesta — MOCK (andamiaje).
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `extractBetData(image)` simula la lectura del ticket con Vision API.
 * Por ahora devuelve datos mock tras un delay; la integración real con la
 * Vision API se conectará aquí más adelante (misma firma).
 */

export interface ExtractedBet {
  /** Partido detectado (editable por el usuario en el modal). */
  match: string
  /** Opciones alternativas para el dropdown de corrección. */
  matchOptions: string[]
  /** Stake detectado (€). */
  stake: number
  /** Cuota detectada. */
  odds: number
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/**
 * MOCK: tras 2s devuelve datos de ejemplo. Reemplazar el cuerpo por la llamada
 * real a la Vision API conservando esta firma `(image: File) => Promise<ExtractedBet>`.
 */
export async function extractBetData(_image: File): Promise<ExtractedBet> {
  await sleep(2000)
  return {
    match: "Real Madrid vs Barcelona",
    matchOptions: [
      "Real Madrid vs Barcelona",
      "Atlético de Madrid vs Sevilla",
      "Girona vs Valencia",
      "Otro / corregir manualmente",
    ],
    stake: 10,
    odds: 2.15,
  }
}
