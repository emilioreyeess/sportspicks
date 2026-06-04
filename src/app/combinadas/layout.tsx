import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Combinadas del Día",
  description:
    "Combinadas de fútbol construidas con criterio cuantitativo: cada selección pasa por el modelo Poisson y el filtro de edge. Valor real, no relleno de cuota. +18.",
  alternates: { canonical: "/combinadas" },
  openGraph: {
    title: "Combinadas Cuantitativas del Día — SportsPicks Analytics",
    description:
      "Combinadas con selecciones filtradas por modelo matemático y edge real. Equilibrio entre riesgo y valor.",
    url: "/combinadas",
    type: "website",
  },
}

export default function CombinadasLayout({ children }: { children: React.ReactNode }) {
  return children
}
