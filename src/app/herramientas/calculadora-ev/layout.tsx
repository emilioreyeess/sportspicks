import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Calculadora de Valor Esperado (EV) | SportsPicks",
  description:
    "Calcula si una cuota tiene valor real: introduce la cuota de la casa, tu probabilidad estimada y el stake. Obtén el EV en euros y sabe si la apuesta es matemáticamente rentable.",
  alternates: { canonical: "/herramientas/calculadora-ev" },
  openGraph: {
    title: "Calculadora de Valor Esperado (EV) — SportsPicks Analytics",
    description:
      "¿Esa cuota tiene EV positivo? Descúbrelo en 3 segundos con la calculadora matemática gratuita.",
    url: "/herramientas/calculadora-ev",
    type: "website",
  },
}

export default function CalculadoraEvLayout({ children }: { children: React.ReactNode }) {
  return children
}
