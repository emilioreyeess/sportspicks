import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Qué son las Value Picks: Guía Matemática y Cálculo de Esperanza",
  description:
    "Aprende a identificar cuotas mal ajustadas por el mercado, calcular el Expected Value (EV) de una apuesta y por qué solo el volumen materializa el edge a largo plazo. Guía técnica sin humo.",
  alternates: { canonical: "/guias/value-picks" },
  openGraph: {
    title: "Qué son las Value Picks: Guía Matemática — SportsPicks Analytics",
    description:
      "EV, probabilidad implícita y borde matemático explicados paso a paso. La base de cualquier apuesta inteligente.",
    url: "/guias/value-picks",
    type: "article",
  },
}

export default function ValuePicksGuideLayout({ children }: { children: React.ReactNode }) {
  return children
}
