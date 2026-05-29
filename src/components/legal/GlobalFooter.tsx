import Link from "next/link"
import { Icon } from "@/components/ui/icons"

const LEGAL_LINKS = [
  { href: "/legal/terms",              label: "Términos" },
  { href: "/legal/privacy",            label: "Privacidad" },
  { href: "/legal/cookies",            label: "Cookies" },
  { href: "/legal/responsible-gaming", label: "Juego Responsable" },
  { href: "/legal/ai-disclaimer",      label: "Descargo IA" },
  { href: "/legal/refund-policy",      label: "Reembolsos" },
  { href: "/legal/gdpr",               label: "GDPR" },
  { href: "/legal/contact",            label: "Contacto Legal" },
  { href: "/about",                    label: "Sobre Nosotros" },
]

export function GlobalFooter() {
  return (
    <footer className="border-t border-white/[0.07] bg-zinc-950/60 mt-auto">

      {/* ─── Disclaimer strip ─────────────────────────────────────────── */}
      <div className="border-b border-amber-900/25 bg-amber-500/[0.04]">
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-start gap-3">
          <span className="text-amber-500/80 text-base shrink-0 mt-px select-none" aria-hidden="true">⚠️</span>
          <p className="text-[11px] text-amber-700/70 leading-relaxed">
            <strong className="text-amber-600/90 font-black">Sports Picks Analytics</strong>{" "}
            es una plataforma de análisis estadístico. No somos casa de apuestas, no aceptamos depósitos
            ni ejecutamos apuestas. Todo el contenido es estrictamente informativo.
            Las predicciones son probabilísticas y no garantizan resultados.{" "}
            <strong className="text-amber-600/80">+18.</strong>{" "}
            ¿Problemas con el juego?{" "}
            <a href="tel:900200300" className="underline hover:text-amber-500 transition-colors">
              900 200 300
            </a>{" · "}
            <a
              href="https://www.jugarbien.es" target="_blank" rel="noopener noreferrer"
              className="underline hover:text-amber-500 transition-colors">
              jugarbien.es
            </a>
          </p>
        </div>
      </div>

      {/* ─── Main footer ─────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-5 py-7 space-y-6">

        {/* Brand + badges */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="grid place-items-center w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/10 border border-emerald-700/40 text-emerald-400">
              <Icon name="value" className="w-4 h-4" strokeWidth={2} />
            </span>
            <div>
              <p className="text-sm font-black text-white leading-none">Sports Picks Analytics</p>
              <p className="text-[10px] text-emerald-500/70 mt-0.5 font-semibold tracking-wide">
                AI-Powered Sports Intelligence
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {["+18", "Solo análisis", "Sin apuestas"].map((tag) => (
              <span key={tag}
                className="text-[10px] px-2 py-1 rounded-lg border border-white/[0.07] bg-zinc-900/60 text-zinc-600 font-medium">
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Legal links */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
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
        <div className="h-px bg-white/[0.07]" />
        <div className="grid sm:grid-cols-2 gap-3 text-[10px] text-zinc-700">
          <p>© {new Date().getFullYear()} Sports Picks Analytics Ltd. Todos los derechos reservados.</p>
          <p className="sm:text-right">
            Modelos probabilísticos. El pasado no garantiza el futuro. No es asesoramiento financiero.
          </p>
        </div>
      </div>
    </footer>
  )
}
