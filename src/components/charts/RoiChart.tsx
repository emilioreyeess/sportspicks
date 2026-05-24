"use client"

import { useEffect, useState } from "react"
import { getRoi } from "@/lib/api"
import type { RoiSummary } from "@/types"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts"

export function RoiChart({ days = 30 }: { days?: number }) {
  const [data, setData] = useState<RoiSummary | null>(null)

  useEffect(() => {
    getRoi(days).then(setData).catch(() => null)
  }, [days])

  if (!data) return <div className="h-48 bg-zinc-900 rounded-2xl animate-pulse" />

  const { summary, daily_history } = data
  const profitable = (summary.profit_units ?? 0) >= 0

  return (
    <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-300">ROI últimos {days} días</h3>
          <p className="text-xs text-zinc-600 mt-0.5">1 unidad de apuesta por pick</p>
        </div>
        <div className="text-right">
          <p className={`text-2xl font-black ${profitable ? "text-emerald-400" : "text-red-400"}`}>
            {profitable ? "+" : ""}{summary.profit_units?.toFixed(2) ?? "—"} u
          </p>
          <p className="text-xs text-zinc-500">{summary.win_rate_pct?.toFixed(1) ?? "—"}% win rate</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={daily_history} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis
            dataKey="date"
            tick={{ fill: "#52525b", fontSize: 10 }}
            tickFormatter={(v) => v.slice(5)}
          />
          <YAxis tick={{ fill: "#52525b", fontSize: 10 }} />
          <Tooltip
            contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }}
            labelStyle={{ color: "#a1a1aa" }}
            itemStyle={{ color: "#34d399" }}
          />
          <ReferenceLine y={0} stroke="#3f3f46" />
          <Line
            type="monotone"
            dataKey="win_rate"
            stroke="#34d399"
            dot={false}
            strokeWidth={2}
            name="Win rate %"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
