import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Value Picks",
  description:
    "Value picks diarios calculados con modelo Poisson sobre cuotas reales de mercado. Solo apuestas con edge matemático positivo. Cero datos inventados. +18.",
  alternates: { canonical: "/value" },
  openGraph: {
    title: "Value Picks con edge real — SportsPicks Analytics",
    description:
      "Picks del día con valor matemático calculado por modelo Poisson sobre cuotas reales. Evidencia, no intuición.",
    url: "/value",
    type: "website",
  },
}

export default function ValueLayout({ children }: { children: React.ReactNode }) {
  return children
}
