import { LegalPage, LegalSection } from "@/components/legal/LegalPage"
export const metadata = { title: "Contacto Legal | Sports Picks Analytics" }
export default function ContactPage() {
  return (
    <LegalPage title="Contacto y Aviso Legal">
      <LegalSection title="Datos identificativos">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2 text-sm">
          <p><span className="text-zinc-500">Denominación social:</span> <span className="text-zinc-300">Sports Picks Analytics Ltd.</span></p>
          <p><span className="text-zinc-500">Actividad:</span> <span className="text-zinc-300">Plataforma SaaS de análisis estadístico deportivo</span></p>
          <p><span className="text-zinc-500">Email general:</span> <span className="text-zinc-300">hello@sportspicks.app</span></p>
          <p><span className="text-zinc-500">Email legal/GDPR:</span> <span className="text-zinc-300">legal@sportspicks.app</span></p>
          <p><span className="text-zinc-500">Email facturación:</span> <span className="text-zinc-300">billing@sportspicks.app</span></p>
          <p><span className="text-zinc-500">Soporte técnico:</span> <span className="text-zinc-300">support@sportspicks.app</span></p>
        </div>
      </LegalSection>
      <LegalSection title="Canales de contacto por tipo">
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { icon: "⚖️", type: "Legal / GDPR", email: "legal@sportspicks.app", time: "30 días" },
            { icon: "💳", type: "Facturación / Reembolsos", email: "billing@sportspicks.app", time: "3 días hábiles" },
            { icon: "🛠️", type: "Soporte técnico", email: "support@sportspicks.app", time: "24-48h" },
            { icon: "📢", type: "Prensa / Partnerships", email: "press@sportspicks.app", time: "5 días hábiles" },
          ].map((c) => (
            <div key={c.type} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
              <p className="text-sm font-bold text-zinc-300">{c.icon} {c.type}</p>
              <p className="text-xs text-emerald-400 mt-1">{c.email}</p>
              <p className="text-[10px] text-zinc-600 mt-0.5">Tiempo de respuesta: {c.time}</p>
            </div>
          ))}
        </div>
      </LegalSection>
      <LegalSection title="Aviso sobre el servicio">
        <p>Sports Picks Analytics es una plataforma tecnológica de análisis estadístico deportivo. No actuamos como intermediario de apuestas, no gestionamos fondos de usuarios destinados a apuestas y no estamos regulados como operador de juego en ninguna jurisdicción.</p>
        <p>Para reportar uso indebido de la plataforma o contenido inapropiado: legal@sportspicks.app</p>
      </LegalSection>
    </LegalPage>
  )
}
