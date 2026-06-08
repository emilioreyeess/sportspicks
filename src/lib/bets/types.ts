/**
 * Tipos del flujo de OCR de tickets de apuesta (lado UI).
 *
 * `ExtractedBet` es la forma que consume el BetConfirmationModal tras el OCR
 * real (Server Action `extractBetDataReal` → mapeado en el cliente).
 */

export interface ExtractedBet {
  /** Partido detectado (editable por el usuario en el modal). */
  match: string
  /** Opciones para el dropdown de corrección (incluye el detectado + manual). */
  matchOptions: string[]
  /** Stake detectado (€). 0 si el OCR no lo detectó. */
  stake: number
  /** Cuota detectada. 0 si el OCR no la detectó. */
  odds: number
}
