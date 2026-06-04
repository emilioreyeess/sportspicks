import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Precios y Planes",
  description:
    "Planes Free, Premium y Pro de SportsPicks Analytics. Value picks, combinadas cuantitativas y bot IA sin anuncios. Análisis real con datos verificables. +18.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Precios y Planes — SportsPicks Analytics",
    description:
      "Elige tu plan: value picks, combinadas y bot IA con análisis cuantitativo real. Premium sin anuncios.",
    url: "/pricing",
    type: "website",
  },
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children
}
