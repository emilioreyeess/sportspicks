/**
 * Registro público de pronósticos — fuente de verdad ESTÁTICA e inmutable.
 *
 * Sin BD ni APIs: el array `pickHistory` se edita manualmente. Cada entrada
 * queda registrada para auditoría de rendimiento (transparencia total).
 */

export interface PickRecord {
  id: string
  date: string                 // YYYY-MM-DD
  event: string
  market: string
  recommendedOdds: number
  stakeUnits: number
  closingLineValue: number     // CLV en % (puede ser negativo)
  result: "Won" | "Lost" | "Void"
}

export const pickHistory: PickRecord[] = [
  {
    id: "p1",
    date: "2026-06-01",
    event: "Real Madrid vs Barcelona",
    market: "1X2 — Real Madrid",
    recommendedOdds: 2.10,
    stakeUnits: 1,
    closingLineValue: 3.5,
    result: "Won",
  },
  {
    id: "p2",
    date: "2026-06-03",
    event: "Arsenal vs Chelsea",
    market: "Over 2.5 goles",
    recommendedOdds: 1.85,
    stakeUnits: 2,
    closingLineValue: -1.2,
    result: "Lost",
  },
  {
    id: "p3",
    date: "2026-06-05",
    event: "Bayern München vs Borussia Dortmund",
    market: "Ambos marcan (BTTS)",
    recommendedOdds: 1.70,
    stakeUnits: 1,
    closingLineValue: 0.8,
    result: "Void",
  },
]
