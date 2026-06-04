import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Retos",
  description:
    "Retos de gestión de bankroll con disciplina cuantitativa. Sigue tu progreso con métricas reales de yield y acierto. Apuesta con cabeza, no con impulso. +18.",
  alternates: { canonical: "/retos" },
  openGraph: {
    title: "Retos de Bankroll — SportsPicks Analytics",
    description:
      "Pon a prueba tu disciplina con retos de gestión de bankroll y métricas reales de rendimiento.",
    url: "/retos",
    type: "website",
  },
}

export default function RetosLayout({ children }: { children: React.ReactNode }) {
  return children
}
