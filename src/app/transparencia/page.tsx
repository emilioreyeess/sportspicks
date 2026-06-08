/**
 * /transparencia — Registro público de auditoría de rendimiento.
 *
 * Server Component PURO (sin "use client", 0 dependencias de cliente).
 * Lee el ledger estático `pickHistory` y calcula las métricas con la función
 * pura calculatePerformance. Inmutable y verificable.
 */

import type { Metadata } from "next"
import { pickHistory, type PickRecord } from "@/data/picks"
import { calculatePerformance } from "@/utils/roi-calculator"

export const metadata: Metadata = {
  title: "Registro público de auditoría — Rendimiento de pronósticos",
  description:
    "Registro público de auditoría de rendimiento de pronósticos deportivos: cada pick con su cuota, stake, CLV y resultado. ROI, yield y win rate calculados de forma transparente y verificable.",
  alternates: { canonical: "/transparencia" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Registro público de auditoría — SportsPicks Analytics",
    description:
      "Historial inmutable de pronósticos con ROI, yield y win rate verificables. Sin cherry-picking.",
    url: "/transparencia",
    type: "website",
  },
}

// ── Helpers de presentación ────────────────────────────────────────────────────
const fmtPct = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(2)}%`
const fmtUnits = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(2)} u`

const RESULT_STYLE: Record<PickRecord["result"], string> = {
  Won:  "bg-emerald-500/15 text-emerald-400",
  Lost: "bg-rose-500/15 text-rose-400",
  Void: "bg-zinc-700/40 text-zinc-400",
}
const RESULT_LABEL: Record<PickRecord["result"], string> = {
  Won: "Ganada", Lost: "Perdida", Void: "Anulada",
}

export default function TransparenciaPage() {
  const m = calculatePerformance(pickHistory)

  const cards: { label: string; value: string; tone: "pos" | "neg" | "neutral" }[] = [
    { label: "Total apostado", value: `${m.totalStaked.toFixed(2)} u`, tone: "neutral" },
    { label: "Beneficio neto", value: fmtUnits(m.netProfit), tone: m.netProfit >= 0 ? "pos" : "neg" },
    { label: "ROI", value: fmtPct(m.roi), tone: m.roi >= 0 ? "pos" : "neg" },
    { label: "Yield", value: fmtPct(m.yield), tone: m.yield >= 0 ? "pos" : "neg" },
    { label: "Win rate", value: `${m.winRate.toFixed(2)}%`, tone: "neutral" },
  ]
  const toneCls = { pos: "text-emerald-400", neg: "text-rose-400", neutral: "text-white" }

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 pb-24">
      {/* Cabecera semántica */}
      <header className="mb-6">
        <p className="apple-eyebrow text-zinc-600 mb-2">Auditoría · datos verificables</p>
        <h1 className="text-[22px] sm:text-[26px] font-black text-white tracking-tight leading-tight">
          Registro público de auditoría de rendimiento
        </h1>
        <p className="mt-2 text-[13px] text-zinc-500 leading-relaxed max-w-prose">
          Historial inmutable de pronósticos deportivos. Cada entrada se registra con su
          cuota recomendada, stake, Closing Line Value (CLV) y resultado real. Las métricas
          se calculan de forma transparente — sin cherry-picking ni picks borrados.
        </p>
      </header>

      {/* Panel de métricas */}
      <section aria-label="Métricas de rendimiento" className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
        {cards.map((c) => (
          <div key={c.label} className="bg-zinc-900/40 rounded-2xl border border-white/[0.05] px-4 py-4">
            <p className="apple-eyebrow text-zinc-600 mb-1">{c.label}</p>
            <p className={`text-xl font-bold tabular-nums leading-none ${toneCls[c.tone]}`}>{c.value}</p>
          </div>
        ))}
      </section>

      {/* Tabla del ledger */}
      <section aria-label="Historial de pronósticos" className="overflow-x-auto rounded-2xl border border-white/[0.05]">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-zinc-900 border-b border-white/[0.08]">
              {["Fecha", "Evento", "Mercado", "Cuota", "Stake", "CLV", "Resultado"].map((h) => (
                <th key={h} className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pickHistory.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-[13px] text-zinc-500">
                  Aún no hay pronósticos registrados.
                </td>
              </tr>
            ) : (
              pickHistory.map((p, i) => (
                <tr key={p.id} className={`border-b border-white/[0.04] ${i % 2 ? "bg-white/[0.015]" : ""}`}>
                  <td className="px-3 py-2.5 font-mono text-zinc-500 tabular-nums whitespace-nowrap">{p.date}</td>
                  <td className="px-3 py-2.5 text-white">{p.event}</td>
                  <td className="px-3 py-2.5 text-zinc-400">{p.market}</td>
                  <td className="px-3 py-2.5 tabular-nums text-zinc-300">@{p.recommendedOdds.toFixed(2)}</td>
                  <td className="px-3 py-2.5 tabular-nums text-zinc-300">{p.stakeUnits} u</td>
                  <td className={`px-3 py-2.5 tabular-nums ${p.closingLineValue >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {p.closingLineValue > 0 ? "+" : ""}{p.closingLineValue.toFixed(1)}%
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${RESULT_STYLE[p.result]}`}>
                      {RESULT_LABEL[p.result]}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <p className="mt-4 text-[11px] text-zinc-600">
        Registro estático e inmutable · {pickHistory.length} pronóstico(s) · métricas calculadas en servidor.
      </p>
    </main>
  )
}
