import { LegalPage, LegalSection } from "@/components/legal/LegalPage"
export const metadata = { title: "Descargo de IA | Sports Picks Analytics" }
export default function AiDisclaimerPage() {
  return (
    <LegalPage title="Descargo de Responsabilidad de IA" lastUpdated="22 de mayo de 2026">
      <LegalSection title="Naturaleza de las predicciones de IA">
        <p>Los modelos de inteligencia artificial y machine learning de Sports Picks Analytics generan predicciones probabilísticas basadas en datos históricos. Estas predicciones <strong>no son infalibles, no son garantías y pueden ser incorrectas.</strong></p>
        <p>Los modelos aprenden de patrones pasados. El deporte tiene factores impredecibles (lesiones de última hora, condiciones climáticas, decisiones arbitrales, motivación táctica) que ningún modelo puede anticipar con certeza.</p>
      </LegalSection>
      <LegalSection title="Limitaciones técnicas">
        <ul className="list-disc pl-4 space-y-1 text-zinc-500">
          <li>Los modelos tienen un porcentaje de error inherente</li>
          <li>Los datos de entrenamiento pueden contener sesgos no identificados</li>
          <li>Las condiciones de mercado (cuotas) no siempre reflejan probabilidades reales</li>
          <li>El análisis de imágenes puede cometer errores de interpretación</li>
          <li>Las estadísticas utilizadas dependen de fuentes externas que pueden contener errores</li>
          <li>Los modelos se reentrenan periódicamente y su comportamiento puede cambiar</li>
        </ul>
      </LegalSection>
      <LegalSection title="Uso responsable de la IA">
        <p>El análisis generado por IA debe usarse como <strong>una fuente de información más</strong>, no como la única base para tomar decisiones. Complementa siempre con tu propio análisis y criterio.</p>
        <p>Nunca tomes decisiones financieras importantes basándote exclusivamente en predicciones automatizadas.</p>
      </LegalSection>
      <LegalSection title="No asesoramiento financiero">
        <p>Nada de lo generado por la IA de Sports Picks constituye asesoramiento financiero, de inversión o de apuestas. Sports Picks no está registrado como asesor financiero en ninguna jurisdicción.</p>
      </LegalSection>
    </LegalPage>
  )
}
