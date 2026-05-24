import { LegalPage, LegalSection } from "@/components/legal/LegalPage"
export const metadata = { title: "Política de Cookies | Sports Picks Analytics" }
export default function CookiesPage() {
  return (
    <LegalPage title="Política de Cookies" lastUpdated="22 de mayo de 2026">
      <LegalSection title="¿Qué son las cookies?">
        <p>Las cookies son pequeños archivos de texto que se guardan en tu dispositivo cuando visitas nuestra plataforma. Usamos cookies para garantizar el funcionamiento correcto del servicio y mejorar tu experiencia.</p>
      </LegalSection>
      <LegalSection title="Cookies que usamos">
        <div className="space-y-3">
          {[
            { type: "Necesarias", examples: "Sesión de usuario, token de autenticación, preferencias de idioma", canDisable: false },
            { type: "Funcionales", examples: "Filtros guardados, preferencias de dashboard, tema visual", canDisable: true },
            { type: "Analíticas", examples: "Páginas visitadas, tiempo en plataforma, funciones más usadas (sin identificación personal)", canDisable: true },
            { type: "Marketing", examples: "Personalización de contenido. Nunca usamos cookies de publicidad de apuestas.", canDisable: true },
          ].map((c) => (
            <div key={c.type} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-bold text-zinc-300">{c.type}</p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${c.canDisable ? "bg-amber-500/15 text-amber-500" : "bg-emerald-500/15 text-emerald-500"}`}>
                  {c.canDisable ? "Opcional" : "Obligatoria"}
                </span>
              </div>
              <p className="text-xs text-zinc-500">{c.examples}</p>
            </div>
          ))}
        </div>
      </LegalSection>
      <LegalSection title="Gestionar cookies">
        <p>Puedes gestionar tus preferencias de cookies en cualquier momento haciendo clic en el botón inferior o desde la configuración de tu navegador.</p>
        <button className="mt-2 px-4 py-2 bg-zinc-800 border border-zinc-700 text-sm text-zinc-300 rounded-xl hover:bg-zinc-700 transition-colors">
          Gestionar preferencias de cookies
        </button>
      </LegalSection>
    </LegalPage>
  )
}
