import { LegalPage, LegalSection } from "@/components/legal/LegalPage"

export const metadata = { title: "Términos de Servicio | Sports Picks Analytics" }

export default function TermsPage() {
  return (
    <LegalPage
      title="Términos de Servicio"
      subtitle="Condiciones de uso de Sports Picks Analytics"
      lastUpdated="22 de mayo de 2026"
    >
      <LegalSection title="1. Naturaleza del Servicio">
        <p>
          Sports Picks Analytics (<strong>"la Plataforma"</strong>) es una herramienta de análisis estadístico
          deportivo basada en inteligencia artificial. La Plataforma <strong>no es una casa de apuestas,
          no está licenciada como operador de juego y no acepta, procesa ni gestiona apuestas deportivas.</strong>
        </p>
        <p>
          El servicio consiste exclusivamente en: análisis estadístico de equipos y partidos deportivos,
          generación de predicciones probabilísticas mediante modelos de machine learning, visualización
          de datos históricos y tendencias, análisis de imágenes de boletos mediante IA, herramientas
          informativas y dashboards estadísticos, retos comunitarios de seguimiento estadístico, y
          suscripciones de acceso a funcionalidades premium.
        </p>
      </LegalSection>

      <LegalSection title="2. Naturaleza Informativa del Contenido">
        <p>
          Todo el contenido generado por la Plataforma, incluyendo picks, predicciones, probabilidades,
          análisis de combinadas y recomendaciones del bot de IA, es de carácter exclusivamente
          <strong> informativo y estadístico</strong>. No constituye:
        </p>
        <ul className="list-disc pl-4 space-y-1 text-zinc-500">
          <li>Asesoramiento financiero o de inversión</li>
          <li>Garantía de resultados económicos</li>
          <li>Recomendación de realizar apuestas</li>
          <li>Gestión de fondos o patrimonios</li>
          <li>Actividad de intermediación en apuestas</li>
        </ul>
        <p>
          Las predicciones son modelos probabilísticos basados en datos históricos. El rendimiento
          pasado no garantiza resultados futuros. La Plataforma puede cometer errores.
        </p>
      </LegalSection>

      <LegalSection title="3. Requisitos de Acceso">
        <p>
          El acceso a la Plataforma está restringido a personas <strong>mayores de 18 años</strong>.
          Al registrarte confirmas que cumples este requisito. Nos reservamos el derecho de
          suspender cuentas si detectamos uso por menores de edad.
        </p>
        <p>
          El acceso está disponible en jurisdicciones donde el análisis estadístico deportivo no
          esté expresamente prohibido. Es responsabilidad del usuario verificar la legalidad del
          uso en su jurisdicción.
        </p>
      </LegalSection>

      <LegalSection title="4. Suscripciones y Pagos">
        <p>
          Los planes de suscripción dan acceso a funcionalidades premium de análisis estadístico.
          Los pagos se procesan a través de Stripe. Al suscribirte aceptas:
        </p>
        <ul className="list-disc pl-4 space-y-1 text-zinc-500">
          <li>La renovación automática mensual hasta que canceles</li>
          <li>Los precios vigentes en el momento de la suscripción</li>
          <li>La política de reembolsos descrita en la página correspondiente</li>
        </ul>
        <p>
          Puedes cancelar en cualquier momento desde tu perfil. La cancelación surte efecto al
          final del período facturado.
        </p>
      </LegalSection>

      <LegalSection title="5. Limitación de Responsabilidad">
        <p>
          La Plataforma no es responsable de pérdidas económicas derivadas del uso de sus análisis.
          El usuario asume la plena responsabilidad de cualquier decisión que tome, incluyendo la
          de realizar apuestas con operadores externos.
        </p>
        <p>
          La responsabilidad máxima de la Plataforma en cualquier caso estará limitada al importe
          abonado en los últimos 3 meses de suscripción.
        </p>
      </LegalSection>

      <LegalSection title="6. Propiedad Intelectual">
        <p>
          Los modelos de IA, algoritmos, datos procesados, diseño y código de la Plataforma son
          propiedad exclusiva de Sports Picks Analytics Ltd. Queda prohibida su reproducción,
          distribución o uso comercial sin autorización expresa por escrito.
        </p>
      </LegalSection>

      <LegalSection title="7. Modificaciones">
        <p>
          Podemos actualizar estos términos con 30 días de antelación. El uso continuado tras
          la notificación implica aceptación. Si no aceptas los nuevos términos, puedes cancelar
          tu suscripción sin penalización.
        </p>
      </LegalSection>

      <LegalSection title="8. Ley Aplicable">
        <p>
          Estos términos se rigen por la ley española. Cualquier disputa se someterá a los
          juzgados de Madrid, España, salvo que la normativa de protección al consumidor de tu
          país de residencia establezca otra jurisdicción.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
