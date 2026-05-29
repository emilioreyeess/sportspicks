"use client"

import { useState, useEffect } from "react"
import { hasCookieConsent, saveConsent, getConsent, revokeConsent } from "@/lib/compliance"
import Link from "next/link"

export function CookieConsent() {
  const [visible, setVisible] = useState(false)
  const [advanced, setAdvanced] = useState(false)
  const [analytics, setAnalytics] = useState(false)
  const [marketing, setMarketing] = useState(false)

  useEffect(() => {
    if (!hasCookieConsent()) setVisible(true)
    else {
      const c = getConsent()
      setAnalytics(c.cookies_analytics)
      setMarketing(c.cookies_marketing)
    }
  }, [])

  function acceptAll() {
    saveConsent({ cookies_analytics: true, cookies_marketing: true, cookies_necessary: true })
    setVisible(false)
  }

  function acceptNecessary() {
    saveConsent({ cookies_analytics: false, cookies_marketing: false, cookies_necessary: true })
    setVisible(false)
  }

  function saveCustom() {
    saveConsent({ cookies_analytics: analytics, cookies_marketing: marketing, cookies_necessary: true })
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[90] p-4 lg:p-6">
      <div className="max-w-3xl mx-auto bg-zinc-900/95 border border-white/[0.07] rounded-2xl
        shadow-2xl overflow-hidden backdrop-blur-xl">
        {!advanced ? (
          <div className="p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <span className="text-2xl shrink-0">🍪</span>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-white mb-1">Usamos cookies</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Usamos cookies necesarias para el funcionamiento de la plataforma y, con tu
                  consentimiento, cookies analíticas para mejorar la experiencia. No usamos
                  cookies de publicidad de terceros relacionadas con apuestas.{" "}
                  <Link href="/legal/cookies" className="text-zinc-300 underline">
                    Política de cookies
                  </Link>
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              <button
                onClick={() => setAdvanced(true)}
                className="text-xs px-3 py-2 rounded-xl bg-zinc-800 text-zinc-400
                  hover:text-white transition-colors border border-white/[0.07]"
              >
                Gestionar preferencias
              </button>
              <button
                onClick={acceptNecessary}
                className="text-xs px-3 py-2 rounded-xl bg-zinc-800 text-zinc-300
                  hover:bg-zinc-700 transition-colors border border-white/[0.07]"
              >
                Solo necesarias
              </button>
              <button
                onClick={acceptAll}
                className="text-xs px-4 py-2 rounded-xl bg-emerald-500 text-zinc-950
                  font-bold hover:bg-emerald-400 transition-colors"
              >
                Aceptar todas
              </button>
            </div>
          </div>
        ) : (
          <div className="p-5 sm:p-6 space-y-4">
            <h3 className="text-sm font-bold text-white">Gestión de cookies</h3>
            <div className="space-y-3">
              <CookieToggle
                label="Cookies necesarias"
                desc="Sesión, autenticación, seguridad. No se pueden desactivar."
                checked={true}
                disabled
                onChange={() => {}}
              />
              <CookieToggle
                label="Cookies analíticas"
                desc="Nos ayudan a entender cómo se usa la plataforma (sin datos personales identificables)."
                checked={analytics}
                onChange={setAnalytics}
              />
              <CookieToggle
                label="Cookies de marketing"
                desc="Para mostrar contenido personalizado. Nunca usamos datos para publicidad de apuestas."
                checked={marketing}
                onChange={setMarketing}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setAdvanced(false)}
                className="text-xs px-3 py-2 rounded-xl bg-zinc-800 text-zinc-400
                  hover:text-white border border-white/[0.07] transition-colors"
              >
                ← Volver
              </button>
              <button
                onClick={saveCustom}
                className="flex-1 text-xs py-2 rounded-xl bg-emerald-500 text-zinc-950
                  font-bold hover:bg-emerald-400 transition-colors"
              >
                Guardar preferencias
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function CookieToggle({
  label, desc, checked, disabled, onChange,
}: {
  label: string; desc: string; checked: boolean
  disabled?: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start gap-3 bg-zinc-800/50 rounded-xl p-3">
      <button
        onClick={() => !disabled && onChange(!checked)}
        className={`relative shrink-0 h-5 w-9 rounded-full transition-colors mt-0.5
          ${checked ? "bg-emerald-500" : "bg-zinc-600"}
          ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform
          ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
      </button>
      <div>
        <p className="text-xs font-semibold text-zinc-200">{label}{disabled && " (Siempre activas)"}</p>
        <p className="text-[10px] text-zinc-500 mt-0.5">{desc}</p>
      </div>
    </div>
  )
}
