"use client"

import { useState, useEffect } from "react"
import { hasAgeVerified, saveConsent } from "@/lib/compliance"

export function AgeGate({ children }: { children: React.ReactNode }) {
  const [verified, setVerified] = useState<boolean | null>(null)
  const [declined, setDeclined] = useState(false)

  useEffect(() => {
    setVerified(hasAgeVerified())
  }, [])

  function confirm() {
    saveConsent({ age_verified: true })
    setVerified(true)
  }

  // Still loading
  if (verified === null) return null

  if (declined) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <div className="max-w-sm text-center space-y-4">
          <p className="text-4xl">🔞</p>
          <h1 className="text-xl font-black text-white">Acceso restringido</h1>
          <p className="text-sm text-zinc-400">
            Esta plataforma es solo para mayores de 18 años.
            Si crees que ha habido un error, cierra y vuelve a abrir el navegador.
          </p>
          <p className="text-xs text-zinc-700">
            Si tienes problemas con el juego, llama al{" "}
            <strong className="text-zinc-500">900 200 300</strong> (España, gratuito)
          </p>
        </div>
      </div>
    )
  }

  if (!verified) {
    return (
      <div className="fixed inset-0 z-[100] bg-zinc-950/98 backdrop-blur-sm flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-700 rounded-3xl p-8 text-center space-y-6">
          {/* Logo */}
          <div className="space-y-2">
            <div className="text-4xl">⚽</div>
            <h1 className="text-2xl font-black text-white">Sports Picks Analytics</h1>
            <p className="text-sm text-zinc-500">Plataforma de análisis estadístico deportivo</p>
          </div>

          <div className="h-px bg-zinc-800" />

          {/* Age check */}
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-700/50
              rounded-full px-4 py-1.5">
              <span className="text-amber-400 text-sm font-bold">+18</span>
              <span className="text-xs text-amber-400/80">Solo para mayores de edad</span>
            </div>

            <p className="text-sm text-zinc-300 leading-relaxed">
              Esta plataforma proporciona <strong className="text-white">análisis estadístico deportivo</strong> con
              fines informativos. Aunque no realizamos ni gestionamos apuestas, el análisis
              de probabilidades puede estar relacionado con el ámbito de las apuestas deportivas.
            </p>

            <div className="bg-zinc-800/60 rounded-xl p-3 text-xs text-zinc-500 text-left space-y-1">
              <p>✓ Plataforma de análisis e inteligencia artificial</p>
              <p>✓ No ejecutamos ni gestionamos apuestas</p>
              <p>✓ Contenido exclusivamente informativo</p>
              <p>✓ Las predicciones son probabilísticas, no garantizadas</p>
            </div>
          </div>

          <p className="text-sm font-semibold text-white">
            ¿Confirmas que eres mayor de 18 años?
          </p>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setDeclined(true)}
              className="py-3 rounded-xl bg-zinc-800 text-zinc-400 text-sm font-medium
                hover:bg-zinc-700 transition-colors"
            >
              No, soy menor
            </button>
            <button
              onClick={confirm}
              className="py-3 rounded-xl bg-emerald-500 text-zinc-950 text-sm font-bold
                hover:bg-emerald-400 transition-colors"
            >
              Sí, soy mayor de 18
            </button>
          </div>

          <p className="text-[10px] text-zinc-700 leading-relaxed">
            Al confirmar aceptas nuestros{" "}
            <a href="/legal/terms" className="underline hover:text-zinc-500">Términos de Servicio</a>
            {" "}y{" "}
            <a href="/legal/privacy" className="underline hover:text-zinc-500">Política de Privacidad</a>.
            Sports Picks Analytics no es una casa de apuestas y no está regulado como operador de juego.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
