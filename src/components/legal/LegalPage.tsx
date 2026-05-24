import Link from "next/link"

interface Props {
  title: string
  subtitle?: string
  lastUpdated?: string
  children: React.ReactNode
}

export function LegalPage({ title, subtitle, lastUpdated, children }: Props) {
  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-10 max-w-3xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-zinc-600 mb-8">
        <Link href="/" className="hover:text-zinc-400 transition-colors">Inicio</Link>
        <span>›</span>
        <Link href="/legal/terms" className="hover:text-zinc-400 transition-colors">Legal</Link>
        <span>›</span>
        <span className="text-zinc-500">{title}</span>
      </div>

      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-black text-white mb-2">{title}</h1>
        {subtitle && <p className="text-zinc-500">{subtitle}</p>}
        {lastUpdated && (
          <p className="text-xs text-zinc-700 mt-2">Última actualización: {lastUpdated}</p>
        )}
      </div>

      {/* Company notice */}
      <div className="bg-emerald-500/5 border border-emerald-900/40 rounded-xl p-4 mb-8 text-xs text-emerald-800 space-y-1">
        <p className="font-bold text-emerald-600">Sports Picks Analytics</p>
        <p>Plataforma de análisis estadístico deportivo basada en inteligencia artificial.</p>
        <p>No somos operador de juego. No aceptamos apuestas. No gestionamos fondos de apuestas.</p>
      </div>

      {/* Content */}
      <div className="prose prose-sm prose-invert max-w-none space-y-6">
        {children}
      </div>

      {/* Footer nav */}
      <div className="mt-12 pt-6 border-t border-zinc-800 flex flex-wrap gap-3 text-xs text-zinc-600">
        {[
          ["Términos", "/legal/terms"],
          ["Privacidad", "/legal/privacy"],
          ["Cookies", "/legal/cookies"],
          ["Juego Responsable", "/legal/responsible-gaming"],
          ["Descargo IA", "/legal/ai-disclaimer"],
          ["Reembolsos", "/legal/refund-policy"],
          ["GDPR", "/legal/gdpr"],
          ["Contacto", "/legal/contact"],
        ].map(([l, h]) => (
          <Link key={h} href={h} className="hover:text-zinc-400 transition-colors underline">
            {l}
          </Link>
        ))}
      </div>
    </div>
  )
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-bold text-white border-b border-zinc-800 pb-2">{title}</h2>
      <div className="text-sm text-zinc-400 leading-relaxed space-y-2">{children}</div>
    </section>
  )
}
