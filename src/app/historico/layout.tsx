import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Histórico de Picks",
  description:
    "Historial completo de picks del modelo, agrupados por día y verificados contra resultados reales de ESPN. Transparencia total: aciertos y fallos a la vista. +18.",
  alternates: { canonical: "/historico" },
  openGraph: {
    title: "Histórico de Picks Verificados — SportsPicks Analytics",
    description:
      "Todos los picks del modelo con resultados reales verificados. Transparencia sin filtros: lo bueno y lo malo.",
    url: "/historico",
    type: "website",
  },
}

export default function HistoricoLayout({ children }: { children: React.ReactNode }) {
  return children
}
