import type { Metadata } from "next"
import Link from "next/link"
import { Icon } from "@/components/ui/icons"

export const metadata: Metadata = {
  title: "Sobre nosotros",
  description: "SportsPicks Analytics: plataforma de análisis deportivo cuantitativo con datos reales, modelo Poisson y motor de motivación. Sin datos inventados.",
}

const PILLARS = [
  {
    icon: "stats", color: "text-emerald-400", bg: "bg-emerald-500/12",
    title: "Modelo Poisson ajustado",
    desc: "Modelo estadístico de predicción de goles ajustado por rival, motivación y shrinkage — no simplemente el historial bruto del equipo.",
  },
  {
    icon: "value", color: "text-blue-400", bg: "bg-blue-500/12",
    title: "Value detection real",
    desc: "Comparamos la probabilidad del modelo con la probabilidad implícita de la cuota real de DraftKings (vía ESPN). Si no hay edge, no hay pick.",
  },
  {
    icon: "bot", color: "text-violet-400", bg: "bg-violet-500/12",
    title: "Bot IA con visión",
    desc: "Analiza boletos por imagen usando Claude. Consulta clasificación, forma reciente y H2H reales de ESPN. Nunca inventa datos.",
  },
  {
    icon: "combinadas", color: "text-amber-400", bg: "bg-amber-500/12",
    title: "Combinadas cuantitativas",
    desc: "El mismo motor que los value picks construye combinadas con cuotas reales, probabilidad del modelo y perfil de riesgo configurable.",
  },
  {
    icon: "trophy", color: "text-rose-400", bg: "bg-rose-500/12",
    title: "Motor de motivación",
    desc: "Clasificaciones reales de ESPN para detectar equipos en lucha por el título, descenso, o sin objetivos — factores críticos que los mercados sub-valoran.",
  },
  {
    icon: "shield", color: "text-cyan-400", bg: "bg-cyan-500/12",
    title: "Anti-hallucination",
    desc: "Prohibición absoluta de inventar datos. Si no hay cuota real o datos de ESPN, el pick no se publica. Preferimos cero picks antes que uno fabricado.",
  },
]

const PRINCIPLES = [
  "Cuotas reales de DraftKings vía ESPN, nunca fabricadas con fórmulas inventadas",
  "Modelo Poisson ajustado por rival — no el win-rate bruto de la temporada",
  "Shrinkage estadístico (K=8) para muestras pequeñas — evita edges imposibles",
  "Motor de motivación desde clasificaciones reales, no supuestos narrativos",
  "Si un día no hay valor, no se publica ningún pick — integridad sobre cantidad",
  "El bot solo cita fuentes reales de ESPN y dice explícitamente qué no sabe",
]

export default function AboutPage() {
  return (
    <div className="safe-x">
      {/* Hero */}
      <section className="relative overflow-hidden px-4 pt-12 pb-8 sm:pt-16 sm:pb-12 text-center mesh-bg">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-blue-500/5 rounded-full blur-[80px]" />
        </div>
        <div className="inline-flex items-center gap-2 bg-zinc-900/80 border border-zinc-800 rounded-full px-3.5 py-1.5 text-xs text-zinc-400 font-medium mb-5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Análisis cuantitativo · datos reales
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight max-w-2xl mx-auto">
          No somos una casa de apuestas.<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
            Somos un motor estadístico.
          </span>
        </h1>
        <p className="text-zinc-400 text-sm sm:text-base max-w-xl mx-auto leading-relaxed mt-4">
          SportsPicks Analytics busca discrepancias entre la probabilidad real de un resultado
          y su precio de mercado. Sin promesas de rentabilidad. Sin datos inventados.
        </p>
      </section>

      {/* Pillars */}
      <section className="max-w-5xl mx-auto px-4 py-10">
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-5 px-1">Cómo funciona el motor</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 stagger">
          {PILLARS.map((p) => (
            <div key={p.title} className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 card-glow">
              <span className={`grid place-items-center w-10 h-10 rounded-xl ${p.bg} ${p.color} mb-3`}>
                <Icon name={p.icon} className="w-5 h-5" strokeWidth={2} />
              </span>
              <h3 className="text-sm font-black text-white mb-1.5">{p.title}</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Anti-hallucination principles */}
      <section className="max-w-3xl mx-auto px-4 pb-10">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Icon name="shield" className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-black text-white uppercase tracking-wide">Principios de honestidad</h2>
          </div>
          <ul className="space-y-2.5">
            {PRINCIPLES.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-sm text-zinc-400">
                <Icon name="check" className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" strokeWidth={2.5} />
                <span className="leading-snug">{p}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Disclaimer */}
      <section className="max-w-3xl mx-auto px-4 pb-12">
        <div className="rounded-2xl border border-amber-800/40 bg-amber-500/6 p-6">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-400 mb-2">Aviso legal importante</p>
          <p className="text-sm text-amber-100/80 leading-relaxed">
            SportsPicks Analytics es una plataforma de <strong className="text-white">análisis estadístico informativo</strong>.
            No somos una casa de apuestas, no aceptamos depósitos ni gestionamos fondos.
            El contenido es exclusivamente educativo e informativo. Las apuestas deportivas
            implican riesgo de pérdida. <strong className="text-white">+18</strong> · Juega con responsabilidad.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/legal/terms" className="text-xs text-amber-400 hover:text-amber-300 underline transition-colors">Términos</Link>
            <span className="text-amber-800">·</span>
            <Link href="/legal/privacy" className="text-xs text-amber-400 hover:text-amber-300 underline transition-colors">Privacidad</Link>
            <span className="text-amber-800">·</span>
            <Link href="/legal/responsible-gaming" className="text-xs text-amber-400 hover:text-amber-300 underline transition-colors">Juego responsable</Link>
            <span className="text-amber-800">·</span>
            <Link href="/legal/contact" className="text-xs text-amber-400 hover:text-amber-300 underline transition-colors">Contacto</Link>
          </div>
        </div>
      </section>
    </div>
  )
}
