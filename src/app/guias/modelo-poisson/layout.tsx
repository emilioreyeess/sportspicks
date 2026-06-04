import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Modelo de Poisson en Apuestas: Predicción de Goles y Cuotas",
  description:
    "Cómo calcular la Fuerza de Ataque y Defensa de un equipo, obtener el lambda de goles esperados y convertir probabilidades exactas de marcador en cuotas 1X2 para detectar ineficiencias de mercado.",
  alternates: { canonical: "/guias/modelo-poisson" },
  openGraph: {
    title: "Modelo de Poisson en Apuestas de Fútbol — SportsPicks Analytics",
    description:
      "Fuerza de Ataque, Fuerza de Defensa, lambda (λ) y la fórmula P(x) = λˣ·e⁻λ / x! aplicados al fútbol. Guía técnica paso a paso.",
    url: "/guias/modelo-poisson",
    type: "article",
  },
}

export default function ModeloPoissonLayout({ children }: { children: React.ReactNode }) {
  return children
}
