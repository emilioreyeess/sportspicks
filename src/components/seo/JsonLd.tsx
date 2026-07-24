/**
 * JsonLd — inyecta el schema.org base en el <head> de todas las páginas.
 *
 * Server Component puro: cero JavaScript en el cliente, sin hidratación.
 * Colocado en el root layout para que Google lo vea en cualquier URL.
 *
 * Schemas incluidos:
 *   · Organization — identidad de la empresa (nombre, URL, logo)
 *   · WebSite      — entidad del sitio web, conectada a Organization
 *
 * Google usa @graph para resolver referencias cruzadas entre entidades.
 * Para rich results adicionales (FAQ, SoftwareApplication, BreadcrumbList)
 * créalos en los layouts de sección correspondientes.
 */

const BASE = "https://www.sportspicks.es"

const schema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${BASE}/#organization`,
      name: "SportsPicks Analytics",
      url: BASE,
      logo: {
        "@type": "ImageObject",
        "@id": `${BASE}/#logo`,
        url: `${BASE}/logo.png`,
        contentUrl: `${BASE}/logo.png`,
        width: 512,
        height: 512,
        caption: "SportsPicks Analytics",
      },
      description:
        "Plataforma de análisis deportivo cuantitativo. Value picks con modelo Poisson calibrado con datos reales, cero datos inventados.",
      inLanguage: "es-ES",
    },
    {
      "@type": "WebSite",
      "@id": `${BASE}/#website`,
      name: "SportsPicks Analytics",
      url: BASE,
      publisher: { "@id": `${BASE}/#organization` },
      inLanguage: "es-ES",
      potentialAction: {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: `${BASE}/stats?q={search_term_string}` },
        "query-input": "required name=search_term_string",
      },
    },
  ],
}

// JSON.stringify produce texto seguro — solo datos, sin inputs de usuario.
// dangerouslySetInnerHTML es el patrón correcto en React para <script> JSON-LD.
const jsonLdString = JSON.stringify(schema)

export function JsonLd() {
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: jsonLdString }}
    />
  )
}
