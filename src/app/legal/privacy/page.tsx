import { LegalPage, LegalSection } from "@/components/legal/LegalPage"
export const metadata = { title: "Política de Privacidad | Sports Picks Analytics" }
export default function PrivacyPage() {
  return (
    <LegalPage title="Política de Privacidad" lastUpdated="22 de mayo de 2026">
      <LegalSection title="1. Responsable del Tratamiento">
        <p>Sports Picks Analytics Ltd. Email de contacto: legal@sportspicks.app</p>
      </LegalSection>
      <LegalSection title="2. Datos que Recogemos">
        <ul className="list-disc pl-4 space-y-1 text-zinc-500">
          <li><strong className="text-zinc-300">Cuenta:</strong> email, nombre, contraseña (hash bcrypt)</li>
          <li><strong className="text-zinc-300">Uso:</strong> historial de consultas, picks visualizados, filtros usados</li>
          <li><strong className="text-zinc-300">Pago:</strong> gestionado íntegramente por Stripe. No almacenamos datos de tarjeta.</li>
          <li><strong className="text-zinc-300">Técnicos:</strong> IP, navegador, zona horaria (para seguridad)</li>
          <li><strong className="text-zinc-300">Imágenes del bot:</strong> procesadas en tiempo real y no almacenadas</li>
        </ul>
      </LegalSection>
      <LegalSection title="3. Finalidad y Base Legal">
        <p>Tratamos tus datos para: prestación del servicio (base: ejecución de contrato), seguridad y prevención de fraude (interés legítimo), comunicaciones sobre el servicio (consentimiento), mejora del servicio mediante analytics (consentimiento).</p>
        <p>No vendemos datos a terceros. No compartimos datos con operadores de apuestas o casas de apuestas.</p>
      </LegalSection>
      <LegalSection title="4. Tus Derechos (GDPR)">
        <p>Tienes derecho a: acceso, rectificación, supresión ("derecho al olvido"), portabilidad, limitación, oposición y retirada del consentimiento. Ejércelos en legal@sportspicks.app o en la sección GDPR de tu perfil.</p>
        <p>Respondemos en 30 días. Puedes reclamar ante la AEPD (España) si consideras que no atendemos tus derechos.</p>
      </LegalSection>
      <LegalSection title="5. Conservación">
        <p>Datos de cuenta: hasta que solicites la eliminación. Datos de pago (en Stripe): según normativa fiscal (6 años). Logs técnicos: 90 días.</p>
      </LegalSection>
      <LegalSection title="6. Transferencias Internacionales">
        <p>Usamos Stripe (EEUU, acogido a Data Privacy Framework), Anthropic/Claude (procesamiento en tiempo real, sin retención), Vercel (infraestructura UE cuando disponible). Todas las transferencias cuentan con salvaguardas adecuadas.</p>
      </LegalSection>
    </LegalPage>
  )
}
