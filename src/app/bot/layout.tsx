import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Bot IA — Análisis de Boletos",
  description:
    "Sube tu boleto y deja que el bot IA con visión lo analice: detecta value, calcula probabilidades reales y evalúa cada selección con datos verificables. +18.",
  alternates: { canonical: "/bot" },
  openGraph: {
    title: "Bot IA — Análisis de Boletos con Visión",
    description:
      "Analiza cualquier boleto con IA: probabilidades reales, detección de value y evaluación por modelo cuantitativo.",
    url: "/bot",
    type: "website",
  },
}

export default function BotLayout({ children }: { children: React.ReactNode }) {
  return children
}
