"use client"

type Verdict = "GOOD" | "RISKY" | "BAD" | "UNKNOWN"

const CONFIG: Record<Verdict, { label: string; color: string; dot: string }> = {
  GOOD:    { label: "✅ BUENA",       color: "bg-emerald-500/15 text-emerald-400 ring-emerald-700", dot: "bg-emerald-400" },
  RISKY:   { label: "⚠️ ARRIESGADA", color: "bg-amber-500/15 text-amber-400 ring-amber-700",     dot: "bg-amber-400" },
  BAD:     { label: "❌ DÉBIL",       color: "bg-red-500/15 text-red-400 ring-red-700",            dot: "bg-red-400" },
  UNKNOWN: { label: "🔍 SIN DATOS",  color: "bg-zinc-500/15 text-zinc-400 ring-zinc-700",         dot: "bg-zinc-400" },
}

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const cfg = CONFIG[verdict] ?? CONFIG.UNKNOWN
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ring-1 ${cfg.color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}
