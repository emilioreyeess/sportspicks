/**
 * Ranking FIFA — Top 40 selecciones (snapshot estático).
 * ───────────────────────────────────────────────────────────────────────────
 * API-Football v3 NO expone un endpoint /rankings de selecciones, así que el
 * ranking FIFA se mantiene aquí como diccionario estático por código FIFA de
 * 3 letras (coincide con WCTeam.code). Actualizar manualmente tras cada
 * publicación oficial de la FIFA.
 *
 * Snapshot a JUNIO 2026 (pre-Mundial). Es un valor informativo, no de cálculo
 * del motor. Top: ARG 1 · FRA 2 · ESP 3 · ENG 4 · BRA 5.
 */
export const FIFA_RANKING: Record<string, number> = {
  ARG: 1,  FRA: 2,  ESP: 3,  ENG: 4,  BRA: 5,
  POR: 6,  NED: 7,  BEL: 8,  ITA: 9,  GER: 10,
  CRO: 11, MAR: 12, COL: 13, URU: 14, USA: 15,
  MEX: 16, SUI: 17, SEN: 18, JPN: 19, DEN: 20,
  IRN: 21, KOR: 22, AUT: 23, UKR: 24, AUS: 25,
  ECU: 26, CAN: 27, SWE: 28, POL: 29, WAL: 30,
  SRB: 31, EGY: 32, ALG: 33, HUN: 34, NOR: 35,
  NGA: 36, CZE: 37, SCO: 38, PAN: 39, TUR: 40,
}

/** Devuelve el puesto FIFA de una selección por su código (3 letras) o null. */
export function fifaRankOf(code: string | null | undefined): number | null {
  if (!code) return null
  return FIFA_RANKING[code.toUpperCase()] ?? null
}
