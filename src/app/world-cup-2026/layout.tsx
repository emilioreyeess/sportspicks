import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Mundial 2026",
  description:
    "Análisis cuantitativo del Mundial 2026: favoritos, grupos y selecciones evaluados con modelo Elo y datos reales. Cuotas, probabilidades y dark horses. +18.",
  alternates: { canonical: "/world-cup-2026" },
  openGraph: {
    title: "Mundial 2026 — Análisis Cuantitativo | SportsPicks Analytics",
    description:
      "Favoritos, grupos y dark horses del Mundial 2026 con modelo Elo y probabilidades reales. Sin humo.",
    url: "/world-cup-2026",
    type: "website",
  },
}

export default function WorldCup2026Layout({ children }: { children: React.ReactNode }) {
  return children
}
