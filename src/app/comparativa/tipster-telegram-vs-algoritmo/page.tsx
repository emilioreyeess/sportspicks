/**
 * /comparativa/tipster-telegram-vs-algoritmo
 *
 * Server Component puro — estático, 0 JS cliente.
 * Landing de posicionamiento: evidencia matemática vs. promesas de canal.
 */

import Link from "next/link"

// ── Datos de la tabla comparativa ─────────────────────────────────────────────

interface CompRow {
  dimension: string
  telegram: { text: string; bad: boolean }
  algo: { text: string }
}

const ROWS: CompRow[] = [
  {
    dimension: "Transparencia de resultados",
    telegram: { text: "Picks perdedores borrados sin aviso", bad: true },
    algo:     { text: "Histórico inmutable público en /historico" },
  },
  {
    dimension: "Cuotas",
    telegram: { text: "Publicadas post-cierre o con cuota inflada", bad: true },
    algo:     { text: "Cuota real de mercado en el momento del pick" },
  },
  {
    dimension: "Closing Line Value (CLV)",
    telegram: { text: "No calculado, no publicado, no existe", bad: true },
    algo:     { text: "Trazable por pick: probabilidad vs. cierre de mercado" },
  },
  {
    dimension: "Yield declarado",
    telegram: { text: "Cherry-picked sobre racha, sin muestra mínima", bad: true },
    algo:     { text: "Calculado sobre 100% de picks con fecha y cuota real" },
  },
  {
    dimension: "Modelo de predicción",
    telegram: { text: "\"Instinto\" y \"análisis\" sin metodología explícita", bad: true },
    algo:     { text: "Distribución de Poisson calibrada con datos ESPN" },
  },
  {
    dimension: "Sesgo emocional",
    telegram: { text: "Confianza de la semana, racha personal, hundir al rival", bad: true },
    algo:     { text: "Edge matemático ≥ 3 % o el pick no se emite" },
  },
  {
    dimension: "Garantía de \"dinero seguro\"",
    telegram: { text: "Promesa de recuperación y VIP de pago", bad: true },
    algo:     { text: "No existe. El modelo tiene un hit-rate, no magia" },
  },
  {
    dimension: "Fuente de datos",
    telegram: { text: "Desconocida o no verificable", bad: true },
    algo:     { text: "ESPN público, trazable, sin datos inventados" },
  },
  {
    dimension: "Gestión del bankroll",
    telegram: { text: "\"Apuesta X unidades\" sin contexto de riesgo", bad: true },
    algo:     { text: "Edge, probabilidad y kelly implícito visibles por pick" },
  },
]

// ── Ventajas clave del algoritmo ──────────────────────────────────────────────

const ADVANTAGES = [
  {
    icon: "📊",
    title: "Histórico público e inmutable",
    desc: "Cada pick publicado queda registrado con fecha, cuota real y resultado verificado contra ESPN. No hay botón de borrar.",
  },
  {
    icon: "🎯",
    title: "CLV como métrica de calidad",
    desc: "El Closing Line Value mide si el modelo bate al mercado antes del cierre. Es el único indicador que no se puede manipular post-partido.",
  },
  {
    icon: "⚙️",
    title: "Modelo Poisson calibrado",
    desc: "Las probabilidades se calculan con distribución de Poisson ajustada por rival, motivación y shrinkage. Metodología explícita, no fe ciega.",
  },
  {
    icon: "🚫",
    title: "Cero promesas",
    desc: "El modelo no garantiza beneficio. Lo que sí garantiza: transparencia total, datos reales y trazabilidad. Si eso no es suficiente, los canales de Telegram están a un click.",
  },
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ComparativaPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16 pb-24">

      {/* ── Hero ──────────────────────────────────────────────────── */}
      <div className="mb-14 text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-4">
          Comparativa honesta
        </p>
        <h1 className="text-[clamp(2rem,6vw,3.5rem)] font-black text-white tracking-tight leading-[1.05] mb-5">
          Tipster de Telegram<br />
          <span className="text-zinc-600">vs.</span>{" "}
          <span className="text-emerald-400">Modelo Matemático</span>
        </h1>
        <p className="text-zinc-400 text-[15px] sm:text-[17px] leading-relaxed max-w-[560px] mx-auto">
          Una diferencia que se mide en yield real, no en capturas de pantalla con el fondo negro y un BMW de fondo.
        </p>
      </div>

      {/* ── Tabla comparativa ─────────────────────────────────────── */}
      <section aria-label="Comparativa" className="mb-16 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-white/[0.08]">
              <th className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-widest text-zinc-500 w-[32%]">
                Dimensión
              </th>
              <th className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-widest text-rose-500 w-[34%]">
                Tipster de Telegram
              </th>
              <th className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-widest text-emerald-400 w-[34%]">
                SportsPicks Analytics
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, i) => (
              <tr
                key={row.dimension}
                className={`border-b border-white/[0.04] transition-colors ${
                  i % 2 === 0 ? "bg-transparent" : "bg-white/[0.015]"
                }`}
              >
                <td className="py-3.5 px-4 text-zinc-400 font-medium text-[13px] align-top">
                  {row.dimension}
                </td>
                <td className="py-3.5 px-4 align-top">
                  <span className="flex items-start gap-2 text-[13px] text-rose-400/80">
                    <span className="mt-[2px] shrink-0 text-rose-600">✕</span>
                    {row.telegram.text}
                  </span>
                </td>
                <td className="py-3.5 px-4 align-top">
                  <span className="flex items-start gap-2 text-[13px] text-emerald-400/90">
                    <span className="mt-[2px] shrink-0 text-emerald-500">✓</span>
                    {row.algo.text}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ── Ventajas clave ────────────────────────────────────────── */}
      <section className="mb-16" aria-label="Por qué SportsPicks">
        <h2 className="text-[18px] sm:text-[22px] font-black text-white tracking-tight mb-6">
          Lo que el modelo sí te da
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {ADVANTAGES.map((a) => (
            <div
              key={a.title}
              className="bg-zinc-900/40 border border-white/[0.05] rounded-2xl px-5 py-4 flex gap-4"
            >
              <span className="text-2xl leading-none mt-0.5 shrink-0" aria-hidden="true">
                {a.icon}
              </span>
              <div>
                <p className="text-[14px] font-bold text-white mb-1">{a.title}</p>
                <p className="text-[12.5px] text-zinc-500 leading-relaxed">{a.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Separador ─────────────────────────────────────────────── */}
      <hr className="border-white/[0.06] mb-16" />

      {/* ── CTA ───────────────────────────────────────────────────── */}
      <section className="text-center" aria-label="Llamada a la acción">
        <p className="text-zinc-500 text-[13px] uppercase tracking-[0.18em] font-semibold mb-4">
          Suficiente teoría
        </p>
        <h2 className="text-[clamp(1.5rem,4vw,2.5rem)] font-black text-white tracking-tight leading-tight mb-4">
          El histórico habla<br />
          <span className="text-emerald-400">por sí solo</span>
        </h2>
        <p className="text-zinc-400 text-[15px] leading-relaxed max-w-[480px] mx-auto mb-8">
          Sin promesas de yield imposibles. Sin picks borrados. Solo datos, modelo y transparencia. El resto lo decides tú.
        </p>
        <Link
          href="/pricing"
          className="inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 font-bold text-[15px] hover:bg-emerald-500/25 hover:border-emerald-500/55 transition-all"
        >
          Ver planes y empezar
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </Link>
        <p className="text-zinc-700 text-[11px] mt-4">
          Plan gratuito disponible · Sin tarjeta de crédito
        </p>
      </section>
    </main>
  )
}
