import Link from "next/link"

const LEGAL_LINKS = [
  { href: "/legal/terms",             label: "Términos de Servicio" },
  { href: "/legal/privacy",           label: "Privacidad" },
  { href: "/legal/cookies",           label: "Cookies" },
  { href: "/legal/responsible-gaming",label: "Juego Responsable" },
  { href: "/legal/ai-disclaimer",     label: "Descargo IA" },
  { href: "/legal/refund-policy",     label: "Reembolsos" },
  { href: "/legal/gdpr",              label: "GDPR" },
  { href: "/legal/contact",           label: "Contacto Legal" },
  { href: "/about",                   label: "Sobre Nosotros" },
]

export function GlobalFooter() {
  return (
    <footer className="border-t border-zinc-800 bg-zinc-900/50 mt-auto">
      {/* Disclaimer principal */}
      <div className="bg-amber-500/5 border-b border-amber-900/30 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-start gap-3">
          <span className="text-amber-500 text-lg shrink-0 mt-0.5">⚠️</span>
          <div className="text-[11px] text-amber-700/80 leading-relaxed space-y-1">
            <p>
              <strong className="text-amber-600">Sports Picks Analytics</strong> es una plataforma de análisis
              estadístico deportivo basada en inteligencia artificial. <strong>No somos una casa de apuestas,
              no aceptamos depósitos, no ejecutamos apuestas y no actuamos como operador de juego.</strong>
            </p>
            <p>
              Todo el contenido es estrictamente informativo y educativo. Las predicciones son probabilísticas
              y no garantizan ningún resultado económico. Las apuestas deportivas implican riesgo económico
              real y pueden generar adicción. <strong>Solo para mayores de 18 años.</strong>
            </p>
            <p>
              Si tienes problemas con el juego: <strong>España</strong> 900 200 300 (gratuito) ·{" "}
              <a href="https://www.jugarbien.es" target="_blank" rel="noopener noreferrer"
                className="underline hover:text-amber-500">jugarbien.es</a>
            </p>
          </div>
        </div>
      </div>

      {/* Main footer */}
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Brand */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚽</span>
            <div>
              <p className="text-sm font-black text-white">Sports Picks Analytics</p>
              <p className="text-[10px] text-emerald-600">AI-Powered Sports Intelligence Platform</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] px-2 py-1 bg-zinc-800 text-zinc-500 rounded-lg border border-zinc-700">
              +18
            </span>
            <span className="text-[10px] px-2 py-1 bg-zinc-800 text-zinc-500 rounded-lg border border-zinc-700">
              Solo análisis
            </span>
            <span className="text-[10px] px-2 py-1 bg-zinc-800 text-zinc-500 rounded-lg border border-zinc-700">
              No apuestas
            </span>
          </div>
        </div>

        {/* Legal links */}
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {LEGAL_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Fine print */}
        <div className="pt-4 border-t border-zinc-800 grid sm:grid-cols-2 gap-3 text-[10px] text-zinc-700">
          <p>
            © {new Date().getFullYear()} Sports Picks Analytics Ltd. Todos los derechos reservados.
            Plataforma de análisis estadístico deportivo con IA. No regulado como operador de juego.
          </p>
          <p className="sm:text-right">
            Las predicciones son modelos probabilísticos. Pasado no garantiza futuro.
            No constituyen asesoramiento financiero ni de inversión.
          </p>
        </div>
      </div>
    </footer>
  )
}
