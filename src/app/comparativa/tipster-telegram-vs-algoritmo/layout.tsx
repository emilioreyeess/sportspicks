import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Tipsters de Telegram vs Modelos Matemáticos | SportsPicks",
  description:
    "¿Sigues un tipster de Telegram con picks borrados y promesas de dinero fácil? Compara: yield real verificable, histórico inmutable y cero sesgo emocional vs. el caos de los canales de pago.",
  alternates: { canonical: "/comparativa/tipster-telegram-vs-algoritmo" },
  openGraph: {
    title: "Tipsters de Telegram vs Modelos Matemáticos — SportsPicks Analytics",
    description:
      "Yield real, CLV trazable e histórico público vs. picks borrados y promesas vacías. La diferencia es matemática.",
    url: "/comparativa/tipster-telegram-vs-algoritmo",
    type: "website",
  },
}

export default function ComparativaLayout({ children }: { children: React.ReactNode }) {
  return children
}
