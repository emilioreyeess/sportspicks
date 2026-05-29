"use client"

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend } from "recharts"
import type { XgSnapshot } from "@/lib/world-cup/types"

interface Props {
  home: { name: string; code: string; xg: XgSnapshot | null }
  away: { name: string; code: string; xg: XgSnapshot | null }
}

/**
 * Radar comparativo de últimos 5 partidos.
 * Métricas: xG ofensivo, xG defensivo (invertido para que mayor = mejor),
 * Goles marcados, Clean-sheet rate, Eficiencia (gf/xG).
 *
 * Si alguno no tiene datos → mensaje honesto, no rellena con ceros.
 */
export function XgRadar({ home, away }: Props) {
  if (!home.xg || !away.xg) {
    return (
      <div className="rounded-2xl border border-white/[0.07] bg-zinc-900/60 px-5 py-8 text-center">
        <p className="text-sm font-bold text-zinc-400">Datos xG insuficientes</p>
        <p className="text-[11px] text-zinc-600 mt-1">Necesitamos al menos 5 partidos recientes de ambas selecciones.</p>
      </div>
    )
  }

  // Normalizar a escala 0-100 para comparar
  const data = [
    {
      metric: "Ataque",
      home: clampScale(home.xg.xgFor5, 0, 3) * 100,
      away: clampScale(away.xg.xgFor5, 0, 3) * 100,
    },
    {
      metric: "Defensa",
      // Invertido: menos xGA = mejor defensa
      home: (1 - clampScale(home.xg.xgAgainst5, 0, 2.5)) * 100,
      away: (1 - clampScale(away.xg.xgAgainst5, 0, 2.5)) * 100,
    },
    {
      metric: "Goles reales",
      home: clampScale(home.xg.goalsFor5, 0, 3) * 100,
      away: clampScale(away.xg.goalsFor5, 0, 3) * 100,
    },
    {
      metric: "Eficiencia",
      home: efficiency(home.xg) * 100,
      away: efficiency(away.xg) * 100,
    },
    {
      metric: "Solidez",
      home: solidity(home.xg) * 100,
      away: solidity(away.xg) * 100,
    },
  ]

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-zinc-900/60 backdrop-blur-sm overflow-hidden shadow-xl">
      <div className="bg-gradient-to-br from-amber-600/10 to-transparent px-5 py-3 border-b border-white/[0.07]">
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-0.5">Comparativa xG · últimos 5 partidos</p>
        <p className="text-xs text-zinc-400">
          <span className="text-amber-300 font-black">{home.code}</span>
          <span className="mx-1.5 text-zinc-600">vs</span>
          <span className="text-cyan-300 font-black">{away.code}</span>
        </p>
      </div>
      <div className="h-72 px-2 py-3 -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="75%">
            <PolarGrid stroke="#3f3f46" strokeOpacity={0.45} />
            <PolarAngleAxis
              dataKey="metric"
              tick={{ fill: "#a1a1aa", fontSize: 11, fontWeight: 700 }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fill: "#52525b", fontSize: 9 }}
              stroke="#3f3f46"
              strokeOpacity={0.5}
            />
            <Radar
              name={home.code}
              dataKey="home"
              stroke="#fbbf24"
              fill="#fbbf24"
              fillOpacity={0.35}
              strokeWidth={2}
              dot={{ fill: "#fbbf24", r: 3 }}
            />
            <Radar
              name={away.code}
              dataKey="away"
              stroke="#22d3ee"
              fill="#22d3ee"
              fillOpacity={0.25}
              strokeWidth={2}
              dot={{ fill: "#22d3ee", r: 3 }}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 11, fontWeight: 700, paddingTop: 6 }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[10px] text-zinc-700 px-5 pb-3 leading-relaxed">
        Proxy estadístico computado (goals × 0.85). No es xG StatsBomb. Solidez = clean-sheet rate aproximado.
      </p>
    </div>
  )
}

function clampScale(v: number, min: number, max: number): number {
  if (max === min) return 0
  return Math.max(0, Math.min(1, (v - min) / (max - min)))
}

function efficiency(xg: XgSnapshot): number {
  if (xg.xgFor5 === 0) return 0
  return clampScale(xg.goalsFor5 / xg.xgFor5, 0.7, 1.4)
}

function solidity(xg: XgSnapshot): number {
  // Más alto = más sólido. xGA bajo + goles concedidos reales bajos.
  return (1 - clampScale(xg.xgAgainst5, 0, 2.5)) * 0.6
       + (1 - clampScale(xg.goalsAgainst5, 0, 2.5)) * 0.4
}
