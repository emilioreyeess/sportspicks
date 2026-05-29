"use client"

import { useEffect, useState } from "react"
import { getSystemStats } from "@/lib/api"
import type { SystemStats } from "@/types"

export function StatsBar() {
  const [stats, setStats] = useState<SystemStats | null>(null)

  useEffect(() => {
    getSystemStats().then(setStats).catch(() => null)
  }, [])

  if (!stats) return <StatsBarSkeleton />

  const winRate = stats.win_rate ?? 0

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <StatCard
        label="Win Rate global"
        value={`${winRate.toFixed(1)}%`}
        sub={`${stats.wins}W / ${stats.losses}L`}
        accent="emerald"
      />
      <StatCard
        label="Picks SEGUROS"
        value={String(stats.safe_picks)}
        sub="≥ 80% confianza"
        accent="emerald"
      />
      <StatCard
        label="Picks ALTOS"
        value={String(stats.high_picks)}
        sub="70–79% confianza"
        accent="amber"
      />
      <StatCard
        label="Total analizados"
        value={String(stats.total_picks)}
        sub="desde el inicio"
        accent="blue"
      />
    </div>
  )
}

function StatCard({
  label, value, sub, accent,
}: {
  label: string; value: string; sub: string; accent: "emerald" | "amber" | "blue"
}) {
  const colors = {
    emerald: "text-emerald-400 border-emerald-800",
    amber:   "text-amber-400   border-amber-800",
    blue:    "text-blue-400    border-blue-800",
  }

  return (
    <div className={`rounded-2xl bg-zinc-900 border ${colors[accent]} p-4`}>
      <p className="text-xs text-zinc-500 uppercase tracking-wider">{label}</p>
      <p className={`text-3xl font-black mt-1 ${colors[accent].split(" ")[0]}`}>{value}</p>
      <p className="text-xs text-zinc-600 mt-0.5">{sub}</p>
    </div>
  )
}

function StatsBarSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-24 rounded-2xl bg-zinc-900/60 border border-white/[0.07] animate-pulse" />
      ))}
    </div>
  )
}
