"use client"

type Variant = "ai" | "picks" | "combinadas" | "stats" | "retos" | "bot"

const CONTENT: Record<Variant, { icon: string; text: string }> = {
  ai: {
    icon: "🤖",
    text: "Los análisis de IA son estimaciones probabilísticas. No constituyen asesoramiento financiero. La IA puede equivocarse. Usa esta información únicamente como referencia informativa.",
  },
  picks: {
    icon: "📊",
    text: "Los picks son predicciones estadísticas, no garantías de resultado. La plataforma no ejecuta apuestas. Contenido informativo para mayores de 18 años.",
  },
  combinadas: {
    icon: "🎯",
    text: "Las combinadas generadas son sugerencias estadísticas basadas en modelos de IA. No garantizamos ningún resultado económico. No realizamos apuestas en tu nombre.",
  },
  stats: {
    icon: "📈",
    text: "Las estadísticas mostradas son datos históricos e indicativos. El rendimiento pasado no garantiza resultados futuros.",
  },
  retos: {
    icon: "🏆",
    text: "Los retos son desafíos comunitarios de análisis estadístico. No implican dinero real, apuestas ni premios económicos. Son simulaciones de tracking estadístico.",
  },
  bot: {
    icon: "🤖",
    text: "El análisis del bot es estimativo y no constituye asesoramiento financiero ni de apuestas. Las probabilidades pueden fallar. La IA puede equivocarse. Uso exclusivamente informativo.",
  },
}

export function DisclaimerBanner({ variant }: { variant: Variant }) {
  const { icon, text } = CONTENT[variant]
  return (
    <div className="flex items-start gap-2.5 bg-zinc-900/60 border border-white/[0.07] rounded-xl px-4 py-3 text-[11px] text-zinc-500 leading-relaxed">
      <span className="shrink-0 mt-0.5">{icon}</span>
      <p>
        <strong className="text-zinc-400">Aviso informativo:</strong> {text}
      </p>
    </div>
  )
}
