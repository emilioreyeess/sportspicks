/**
 * /glosario — Hub de Glosario Técnico
 *
 * Server Component puro: metadata en layout.tsx, JSON-LD inline,
 * sin hooks de cliente. El H1 se renderiza con la misma semántica y
 * estética que <PageHeader> (que no puede importarse desde un SC porque
 * primitives.tsx usa hooks sin directiva "use client").
 */

const BASE = "https://sportspicks.app"

// ── Términos semilla ──────────────────────────────────────────────────────────

interface GlossaryTerm {
  /** ID de anchor para enlaces internos y JSON-LD */
  slug: string
  name: string
  /** Definición técnica concisa — máx. 2 frases */
  definition: string
  /** Etiqueta de categoría visible */
  tag: string
}

const TERMS: GlossaryTerm[] = [
  {
    slug: "yield",
    name: "Yield",
    definition:
      "Beneficio neto obtenido dividido entre el total apostado, expresado en porcentaje. Un tipster con yield positivo sostenido durante 500+ picks demuestra edge matemático real.",
    tag: "Rentabilidad",
  },
  {
    slug: "edge",
    name: "Edge (Ventaja Matemática)",
    definition:
      "Diferencia positiva entre la probabilidad estimada por el modelo y la probabilidad implícita en la cuota del mercado. Sin edge, no existe value; sin value, apostar es donar.",
    tag: "Modelo",
  },
  {
    slug: "clv",
    name: "CLV (Closing Line Value)",
    definition:
      "Diferencia entre la cuota a la que apostaste y la cuota de cierre del mercado antes del partido. El CLV positivo sostenido es el mejor indicador de que el modelo bate al mercado.",
    tag: "Mercado",
  },
  {
    slug: "distribucion-de-poisson",
    name: "Distribución de Poisson",
    definition:
      "Modelo estadístico que describe la probabilidad de que ocurra un número de eventos (goles) en un intervalo fijo, asumiendo independencia. Base matemática del motor de predicción de SportsPicks.",
    tag: "Estadística",
  },
]

// ── JSON-LD: DefinedTermSet ───────────────────────────────────────────────────

const definedTermSet = {
  "@context": "https://schema.org",
  "@type": "DefinedTermSet",
  "@id": `${BASE}/glosario#termset`,
  name: "Glosario de Apuestas Deportivas y Estadística",
  url: `${BASE}/glosario`,
  publisher: { "@id": `${BASE}/#organization` },
  hasDefinedTerm: TERMS.map((t) => ({
    "@type": "DefinedTerm",
    "@id": `${BASE}/glosario#${t.slug}`,
    name: t.name,
    description: t.definition,
    url: `${BASE}/glosario#${t.slug}`,
    inDefinedTermSet: `${BASE}/glosario#termset`,
  })),
}

const jsonLdString = JSON.stringify(definedTermSet)

// ── Tag colors ────────────────────────────────────────────────────────────────

const TAG_COLORS: Record<string, string> = {
  Rentabilidad: "bg-emerald-500/10 text-emerald-400 border-emerald-700/30",
  Modelo:       "bg-cyan-500/10    text-cyan-400    border-cyan-700/30",
  Mercado:      "bg-amber-500/10   text-amber-400   border-amber-700/30",
  Estadística:  "bg-violet-500/10  text-violet-400  border-violet-700/30",
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GlosarioPage() {
  return (
    <>
      {/* JSON-LD — Server-rendered, 0 JS cliente */}
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: jsonLdString }}
      />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10 safe-x pb-24">

        {/* ── Header — mismo patrón semántico que <PageHeader> ── */}
        <div className="flex items-start gap-3 mb-8">
          <span className="grid place-items-center w-9 h-9 rounded-[10px] bg-gradient-to-br from-violet-500/18 to-cyan-500/10 border border-violet-700/38 text-violet-400 shadow-[0_0_10px_rgba(139,92,246,0.12)] shrink-0 mt-0.5">
            {/* book-open icon (Lucide) */}
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
          </span>
          <div className="min-w-0">
            <h1 className="text-[22px] sm:text-[26px] font-black text-white tracking-tight leading-tight">
              Glosario
            </h1>
            <p className="text-[13px] text-zinc-500 mt-1.5 leading-relaxed max-w-prose">
              Definiciones técnicas de los términos que usa el modelo. Sin ambigüedad, sin vendehúmos.
            </p>
          </div>
        </div>

        {/* ── Grid de términos ─────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {TERMS.map((term) => (
            <article
              key={term.slug}
              id={term.slug}
              className="bg-zinc-900/40 rounded-2xl border border-white/[0.05] px-5 py-4 flex flex-col gap-3 scroll-mt-20"
            >
              {/* Term name + tag */}
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-[15px] font-bold text-white leading-tight">{term.name}</h2>
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 ${TAG_COLORS[term.tag] ?? "bg-zinc-800 text-zinc-400 border-zinc-700"}`}
                >
                  {term.tag}
                </span>
              </div>

              {/* Definition */}
              <p className="text-[13px] text-zinc-400 leading-relaxed">{term.definition}</p>

              {/* Anchor link */}
              <a
                href={`#${term.slug}`}
                className="text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors self-start font-mono"
                aria-label={`Enlace directo a ${term.name}`}
              >
                #{term.slug}
              </a>
            </article>
          ))}
        </div>

        {/* ── Footer note ─────────────────────────────────────────── */}
        <p className="text-[11px] text-zinc-700 mt-8 text-center">
          El glosario se amplía conforme el modelo incorpora nuevas métricas. Todos los cálculos usan datos verificables de ESPN.
        </p>
      </main>
    </>
  )
}
