import type { Metadata } from "next"

// Frontmatter del artículo mapeado a Metadata (no hay parser MD: es página coded).
// title · date · description · slug = "big-data-analisis-rendimiento"
export const metadata: Metadata = {
  title: "Big data y análisis del rendimiento deportivo",
  description:
    "Cómo el big data transforma millones de datos en decisiones tácticas: wearables GPS, visión artificial, modelos predictivos y plataformas unificadas en el deporte moderno.",
  alternates: { canonical: "/blog/big-data-analisis-rendimiento" },
  openGraph: {
    title: "Big data y análisis del rendimiento deportivo — SportsPicks Analytics",
    description:
      "Sports analytics: wearables, visión artificial y modelos predictivos que revelan lo que el ojo humano no ve.",
    url: "/blog/big-data-analisis-rendimiento",
    type: "article",
    images: ["/images/blog/big-data-rendimiento-1.jpeg"],
  },
}

export default function BlogPostLayout({ children }: { children: React.ReactNode }) {
  return children
}
