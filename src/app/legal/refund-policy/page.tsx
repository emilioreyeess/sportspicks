import { LegalPage, LegalSection } from "@/components/legal/LegalPage"
export const metadata = { title: "Política de Reembolsos | Sports Picks Analytics" }
export default function RefundPolicyPage() {
  return (
    <LegalPage title="Política de Suscripción y Reembolsos" lastUpdated="22 de mayo de 2026">
      <LegalSection title="Planes de suscripción">
        <p>Sports Picks Analytics ofrece suscripciones mensuales de acceso a funcionalidades de análisis estadístico deportivo. Los planes disponibles son:</p>
        <div className="grid sm:grid-cols-3 gap-3 mt-3">
          {[
            { name: "Free", price: "0€/mes", features: "2–3 picks, combinadas básicas, bot 3/día" },
            { name: "Premium ⭐", price: "9.99€/mes", features: "Todo desbloqueado, bot 15/día, IA combinadas" },
            { name: "Pro 👑", price: "19.99€/mes", features: "Sin límites, retos, watchlist, modo trader" },
          ].map((p) => (
            <div key={p.name} className="bg-zinc-900/60 border border-white/[0.07] rounded-xl p-3">
              <p className="font-bold text-white text-sm">{p.name}</p>
              <p className="text-emerald-400 font-black text-lg">{p.price}</p>
              <p className="text-xs text-zinc-500 mt-1">{p.features}</p>
            </div>
          ))}
        </div>
      </LegalSection>
      <LegalSection title="Renovación automática">
        <p>Las suscripciones se renuevan automáticamente cada mes. Recibirás un email 3 días antes de cada renovación. Puedes cancelar en cualquier momento antes de la fecha de renovación sin cargo adicional.</p>
        <p className="font-medium text-zinc-300">La cancelación es inmediata y sencilla desde tu perfil → Suscripción → Cancelar.</p>
      </LegalSection>
      <LegalSection title="Política de reembolso">
        <p><strong className="text-zinc-300">Garantía de 7 días:</strong> Si cancelas dentro de los primeros 7 días tras tu primera suscripción, te devolvemos el 100% del importe sin preguntas.</p>
        <p><strong className="text-zinc-300">Después de 7 días:</strong> No ofrecemos reembolsos proporcionales por el período no utilizado, salvo error técnico de nuestra parte que impida el acceso al servicio.</p>
        <p><strong className="text-zinc-300">Error técnico:</strong> Si la plataforma no estaba disponible más de 48 horas continuas en un mes de facturación, aplicamos un crédito proporcional.</p>
        <p>Para solicitar un reembolso: billing@sportspicks.app</p>
      </LegalSection>
      <LegalSection title="Lo que NO reembolsamos">
        <ul className="list-disc pl-4 space-y-1 text-zinc-500">
          <li>Pérdidas en apuestas deportivas realizadas con operadores externos</li>
          <li>Insatisfacción con los resultados de los análisis estadísticos</li>
          <li>Cambios de opinión después del período de garantía</li>
        </ul>
        <p className="text-zinc-400 mt-2">Recordamos que Sports Picks no garantiza ningún resultado económico. Los análisis son informativos.</p>
      </LegalSection>
    </LegalPage>
  )
}
