/**
 * /herramientas/calculadora-ev
 *
 * Server Component shell: metadata en layout.tsx, hero estático,
 * calculadora interactiva aislada en EvCalculator (Client Component).
 *
 * Esto garantiza que el shell HTML del hero se sirve sin JS y solo
 * la calculadora hidrata en el cliente — sin errores de hidratación.
 */

import Link from "next/link"
import { EvCalculator } from "@/components/herramientas/EvCalculator"

export default function CalculadoraEvPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14 pb-28">

      {/* ── Breadcrumb ──────────────────────────────────────────── */}
      <nav className="flex items-center gap-1.5 mb-8 text-[11px] text-zinc-600" aria-label="Ruta de navegación">
        <Link href="/" className="hover:text-zinc-400 transition-colors">Inicio</Link>
        <span>/</span>
        <Link href="/herramientas" className="hover:text-zinc-400 transition-colors">Herramientas</Link>
        <span>/</span>
        <span className="text-zinc-400">Calculadora EV</span>
      </nav>

      {/* ── Hero estático (Server-rendered) ─────────────────────── */}
      <header className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-700/30 px-2.5 py-1 rounded-full">
            Herramienta gratuita
          </span>
        </div>
        <h1 className="text-[clamp(1.75rem,5vw,2.75rem)] font-black text-white tracking-tight leading-[1.1] mb-4">
          Calculadora de{" "}
          <span className="text-emerald-400">Valor Esperado</span>
          <br />
          (EV)
        </h1>
        <p className="text-[16px] text-zinc-400 leading-relaxed max-w-[540px]">
          ¿Tiene valor esa cuota? Introduce los tres datos y calcula si la apuesta es matemáticamente rentable — antes de apostar, no después.
        </p>
      </header>

      {/* ── Calculadora interactiva (Client Component) ───────────── */}
      <EvCalculator />
    </main>
  )
}
