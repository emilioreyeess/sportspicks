import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Estadísticas de Equipos",
  description:
    "Estadísticas reales de equipos de fútbol: forma, goles, córners y tarjetas extraídas de datos verificables. La base del modelo Poisson de SportsPicks. +18.",
  alternates: { canonical: "/stats" },
  openGraph: {
    title: "Estadísticas de Equipos — SportsPicks Analytics",
    description:
      "Forma, goles, córners y tarjetas con datos reales. Las cifras que alimentan el modelo cuantitativo.",
    url: "/stats",
    type: "website",
  },
}

export default function StatsLayout({ children }: { children: React.ReactNode }) {
  return children
}
