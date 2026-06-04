import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Glosario de Apuestas Deportivas y Estadística",
  description:
    "Definiciones técnicas de los términos clave en apuestas deportivas cuantitativas: yield, edge matemático, CLV, modelo de Poisson y más. Basado en estadística real.",
  alternates: { canonical: "/glosario" },
  openGraph: {
    title: "Glosario Técnico — SportsPicks Analytics",
    description:
      "Yield, edge, CLV, distribución de Poisson y más. Definiciones precisas para analizar apuestas con rigor matemático.",
    url: "/glosario",
    type: "website",
  },
}

export default function GlosarioLayout({ children }: { children: React.ReactNode }) {
  return children
}
