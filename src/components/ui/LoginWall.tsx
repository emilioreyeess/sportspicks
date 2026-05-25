"use client"
import { useState } from "react"
import { useAuth } from "@/lib/auth"
import { Icon } from "@/components/ui/icons"

export function LoginWall({ children }: { children: React.ReactNode }) {
  const { user, login, ready } = useAuth()
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  if (!ready) return null
  if (user) return <>{children}</>

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    const trimmed = email.trim().toLowerCase()
    if (!trimmed.includes("@") || !trimmed.includes(".")) {
      setError("Introduce un email válido.")
      return
    }
    setSubmitting(true)
    login(trimmed, name.trim() || undefined)
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 z-[100] bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="grid place-items-center w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-700/50">
            <Icon name="value" className="w-8 h-8 text-emerald-400" strokeWidth={2} />
          </div>
          <h1 className="text-2xl font-black text-white">SportsPicks</h1>
          <p className="text-sm text-zinc-500 mt-1">Análisis deportivo cuantitativo</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <h2 className="text-lg font-black text-white mb-1">Accede a la plataforma</h2>
          <p className="text-xs text-zinc-500 mb-5 leading-snug">
            Introduce tu email para acceder. Lo usaremos para gestionar tu suscripción.
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError("") }}
                placeholder="tu@email.com"
                autoFocus
                inputMode="email"
                autoComplete="email"
                required
                className="w-full bg-zinc-800 border border-zinc-700 focus:border-emerald-600 rounded-xl px-4 py-3 text-sm text-white outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">
                Nombre <span className="text-zinc-700 font-normal normal-case">(opcional)</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre"
                autoComplete="name"
                className="w-full bg-zinc-800 border border-zinc-700 focus:border-zinc-600 rounded-xl px-4 py-3 text-sm text-white outline-none transition-colors"
              />
            </div>

            {error && (
              <p className="text-xs text-red-400">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting || !email.trim()}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-cyan-500 disabled:opacity-40 text-zinc-950 font-bold rounded-xl text-sm tap"
            >
              {submitting ? "Accediendo…" : "Acceder →"}
            </button>
          </form>

          <p className="text-[11px] text-zinc-600 text-center mt-4 leading-relaxed">
            Sin contraseña. Tu email solo se usa para la suscripción y nunca se comparte.
          </p>
        </div>

        <p className="text-center text-[11px] text-zinc-700 mt-4">
          +18 · Análisis informativo · No constituye recomendación de apuesta
        </p>
      </div>
    </div>
  )
}
