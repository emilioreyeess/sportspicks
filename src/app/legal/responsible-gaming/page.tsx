import { LegalPage, LegalSection } from "@/components/legal/LegalPage"
export const metadata = { title: "Juego Responsable | Sports Picks Analytics" }
export default function ResponsibleGamingPage() {
  return (
    <LegalPage
      title="Juego Responsable"
      subtitle="Sports Picks no es un operador de juego, pero nos preocupa tu bienestar"
    >
      <div className="bg-rose-500/10 border border-rose-900/40 rounded-2xl p-5 space-y-3">
        <p className="text-sm font-bold text-rose-400">Mensaje importante</p>
        <p className="text-sm text-zinc-400 leading-relaxed">
          Sports Picks Analytics es una plataforma de análisis estadístico, <strong>no una casa de apuestas</strong>.
          Sin embargo, somos conscientes de que nuestros análisis pueden ser utilizados en el contexto
          de las apuestas deportivas. Por eso incluimos esta sección de recursos de juego responsable.
        </p>
        <p className="text-sm text-zinc-400">
          <strong className="text-white">Si las apuestas están afectando negativamente tu vida,
          busca ayuda de inmediato.</strong>
        </p>
      </div>

      <LegalSection title="Señales de alerta">
        <ul className="list-disc pl-4 space-y-1 text-zinc-500">
          <li>Apostar más dinero del que puedes permitirte perder</li>
          <li>Aumentar las apuestas para recuperar pérdidas ("tilt")</li>
          <li>Mentir a familiares sobre el dinero gastado en apuestas</li>
          <li>Descuidar responsabilidades laborales, familiares o sociales</li>
          <li>Sentir ansiedad, irritabilidad o depresión relacionados con las apuestas</li>
          <li>Pedir dinero prestado para apostar</li>
          <li>Imposibilidad de dejar de apostar aunque quieras</li>
        </ul>
      </LegalSection>

      <LegalSection title="Recursos de ayuda">
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { country: "🇪🇸 España", org: "Jugarbien.es", phone: "900 200 300", url: "https://www.jugarbien.es" },
            { country: "🇲🇽 México", org: "CONADIC", phone: "800 911 2000", url: "https://www.gob.mx/salud/conadic" },
            { country: "🇦🇷 Argentina", org: "CUDAP", phone: "0800 333 0800", url: "" },
            { country: "🌍 Internacional", org: "Gambling Therapy", phone: "", url: "https://www.gamblingtherapy.org" },
          ].map((r) => (
            <div key={r.country} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
              <p className="text-xs font-bold text-zinc-300">{r.country}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{r.org}</p>
              {r.phone && <p className="text-sm font-bold text-emerald-400 mt-1">{r.phone}</p>}
              {r.url && (
                <a href={r.url} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-zinc-600 hover:text-zinc-400 underline">
                  {r.url.replace("https://www.", "")}
                </a>
              )}
            </div>
          ))}
        </div>
      </LegalSection>

      <LegalSection title="Herramientas de autoprotección">
        <p>Si utilizas plataformas de apuestas externas, la mayoría ofrecen herramientas de autoexclusión, límites de depósito y tiempo de reflexión. Te recomendamos usarlas.</p>
        <ul className="list-disc pl-4 space-y-1 text-zinc-500 mt-2">
          <li>Establece un presupuesto máximo mensual y cúmplelo</li>
          <li>Nunca apuestes dinero que necesitas para gastos esenciales</li>
          <li>Tómate descansos regulares</li>
          <li>No apuestes bajo efectos del alcohol o en estados emocionales extremos</li>
          <li>Recuerda que el análisis estadístico no garantiza resultados</li>
        </ul>
      </LegalSection>

      <LegalSection title="Nuestro compromiso">
        <p>Sports Picks Analytics se compromete a: no promocionar el gambling compulsivo, incluir disclaimers claros en todas las secciones relevantes, verificar la mayoría de edad antes del acceso, y proporcionar estos recursos de ayuda de forma prominente.</p>
        <p>Si detectas que un menor está usando nuestra plataforma, notifícanoslo en legal@sportspicks.app.</p>
      </LegalSection>
    </LegalPage>
  )
}
