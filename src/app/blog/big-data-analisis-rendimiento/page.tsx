/**
 * /blog/big-data-analisis-rendimiento
 *
 * Artículo importado desde Markdown → página coded (Server Component, 0 JS).
 * Contenido verbatim en content.ts; render vía MarkdownArticle (sin deps).
 */

import Link from "next/link"
import { MarkdownArticle } from "@/components/blog/MarkdownArticle"
import { CONTENT } from "./content"

const BASE = "https://sportspicks.app"
const SLUG = "big-data-analisis-rendimiento"
const TITLE = "Big data y análisis del rendimiento deportivo"
const DESCRIPTION =
  "Cómo el big data transforma millones de datos en decisiones tácticas: wearables GPS, visión artificial, modelos predictivos y plataformas unificadas en el deporte moderno."
const PUBLISHED = "2026-06-08"
const HERO = "/images/blog/big-data-rendimiento-1.jpeg"

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  "@id": `${BASE}/blog/${SLUG}#article`,
  headline: TITLE,
  description: DESCRIPTION,
  url: `${BASE}/blog/${SLUG}`,
  datePublished: PUBLISHED,
  dateModified: PUBLISHED,
  inLanguage: "es-ES",
  image: { "@type": "ImageObject", url: `${BASE}${HERO}` },
  author: { "@type": "Organization", "@id": `${BASE}/#organization`, name: "SportsPicks Analytics" },
  publisher: {
    "@type": "Organization", "@id": `${BASE}/#organization`, name: "SportsPicks Analytics",
    logo: { "@type": "ImageObject", url: `${BASE}/logo.png`, width: 512, height: 512 },
  },
  mainEntityOfPage: { "@type": "WebPage", "@id": `${BASE}/blog/${SLUG}` },
}

export default function BigDataPost() {
  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14 pb-28">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 mb-8 text-[11px] text-zinc-600" aria-label="Ruta de navegación">
          <Link href="/" className="hover:text-zinc-400 transition-colors">Inicio</Link>
          <span>/</span>
          <span>Blog</span>
          <span>/</span>
          <span className="text-zinc-400">Big data</span>
        </nav>

        {/* Cabecera */}
        <header className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-700/30 px-2.5 py-1 rounded-full">
              Análisis deportivo
            </span>
            <span className="text-[11px] text-zinc-600">
              {new Date(PUBLISHED).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
            </span>
          </div>
          <h1 className="text-[clamp(1.75rem,5vw,2.75rem)] font-black text-white tracking-tight leading-[1.1]">
            {TITLE}
          </h1>
        </header>

        {/* Imagen hero */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={HERO} alt="Especialista en análisis deportivo evaluando datos de GPS y revisando informes técnicos"
          className="mb-8 w-full rounded-2xl border border-white/[0.06] bg-zinc-900" />

        {/* Cuerpo del artículo (Markdown → JSX) */}
        <article>
          <MarkdownArticle content={CONTENT} />
        </article>
      </main>
    </>
  )
}
