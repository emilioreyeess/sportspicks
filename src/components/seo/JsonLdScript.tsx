/**
 * JsonLdScript — utilidad reutilizable para inyectar Schema.org (JSON-LD).
 *
 * Server Component puro (0 JS cliente). Serializa el objeto schema y lo emite
 * como <script type="application/ld+json"> en el lugar donde se renderice.
 *
 * Uso:
 *   <JsonLdScript schema={{ "@context": "https://schema.org", "@type": "Article", ... }} />
 *
 * Helpers de esquema frecuentes incluidos (Article / SoftwareApplication /
 * Dataset) para mantener consistencia semántica entre páginas técnicas.
 */

const BASE = "https://sportspicks.app"
const ORG_REF = { "@id": `${BASE}/#organization` }

export function JsonLdScript({ schema }: { schema: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

// ── Builders de esquema reutilizables ──────────────────────────────────────────

/** Article — para guías metodológicas y posts del blog. */
export function buildArticleSchema(args: {
  slug: string
  headline: string
  description: string
  datePublished: string
  dateModified?: string
  image?: string
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${BASE}${args.slug}#article`,
    headline: args.headline,
    description: args.description,
    url: `${BASE}${args.slug}`,
    datePublished: args.datePublished,
    dateModified: args.dateModified ?? args.datePublished,
    inLanguage: "es-ES",
    ...(args.image ? { image: { "@type": "ImageObject", url: `${BASE}${args.image}` } } : {}),
    author: { "@type": "Organization", ...ORG_REF, name: "SportsPicks Analytics" },
    publisher: {
      "@type": "Organization", ...ORG_REF, name: "SportsPicks Analytics",
      logo: { "@type": "ImageObject", url: `${BASE}/logo.png`, width: 512, height: 512 },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": `${BASE}${args.slug}` },
  }
}

/** SoftwareApplication — para superficies de previsiones/herramientas numéricas. */
export function buildSoftwareAppSchema(args: {
  name: string
  description: string
  url: string
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: args.name,
    description: args.description,
    url: `${BASE}${args.url}`,
    applicationCategory: "SportsApplication",
    operatingSystem: "Web",
    inLanguage: "es-ES",
    publisher: { "@type": "Organization", ...ORG_REF, name: "SportsPicks Analytics" },
  }
}

/** Dataset — para conjuntos de previsiones/estadísticas estructuradas. */
export function buildDatasetSchema(args: {
  name: string
  description: string
  url: string
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: args.name,
    description: args.description,
    url: `${BASE}${args.url}`,
    inLanguage: "es-ES",
    creator: { "@type": "Organization", ...ORG_REF, name: "SportsPicks Analytics" },
  }
}
