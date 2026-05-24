"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { usePlan } from "@/lib/plan"
import { Icon } from "@/components/ui/icons"

type Status = "loading" | "ok" | "error"

export default function CheckoutSuccessPage() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get("session_id")
  const { setPlan } = usePlan()
  const [status, setStatus] = useState<Status>("loading")
  const [planActivated, setPlanActivated] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId) { setStatus("error"); return }

    fetch(`/api/checkout/verify?session_id=${sessionId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.verified && data.plan) {
          setPlan(data.plan)
          setPlanActivated(data.plan)
          setStatus("ok")
        } else {
          setStatus("error")
        }
      })
      .catch(() => setStatus("error"))
  }, [sessionId, setPlan])

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        {status === "loading" && (
          <div className="animate-fade-in">
            <div className="grid place-items-center w-20 h-20 rounded-3xl bg-zinc-800 mx-auto mb-5">
              <Icon name="settings" className="w-9 h-9 text-emerald-400 animate-spin" />
            </div>
            <p className="text-lg font-black text-white">Verificando tu pago…</p>
            <p className="text-sm text-zinc-500 mt-1">Un momento, estamos activando tu plan.</p>
          </div>
        )}

        {status === "ok" && (
          <div className="animate-scale-in">
            {/* Glow circle */}
            <div className="relative mx-auto w-24 h-24 mb-6">
              <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-glow-pulse" />
              <div className="relative grid place-items-center w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500">
                <Icon name="check" className="w-11 h-11 text-zinc-950" strokeWidth={3} />
              </div>
            </div>

            <p className="text-2xl font-black text-white mb-1">
              ¡Bienvenido a{" "}
              <span className="gradient-text capitalize">{planActivated ?? "Premium"}</span>!
            </p>
            <p className="text-sm text-zinc-400 mb-8 leading-relaxed">
              Tu plan está activo. Ahora tienes acceso completo al motor cuantitativo
              — todos los picks, análisis completo y bot IA ilimitado.
            </p>

            <div className="grid grid-cols-1 gap-3 mb-6">
              <Link href="/value"
                className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-zinc-950 font-bold text-sm tap">
                <Icon name="value" className="w-4.5 h-4.5" strokeWidth={2.2} />
                Ver todos los value picks
              </Link>
              <Link href="/bot"
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-sm tap transition-colors">
                <Icon name="bot" className="w-4.5 h-4.5" strokeWidth={2.2} />
                Probar el Bot IA ilimitado
              </Link>
            </div>

            <p className="text-[11px] text-zinc-600">
              Recibirás un email de confirmación de Stripe.
              Gestiona tu suscripción desde <Link href="/account" className="text-zinc-500 hover:text-zinc-300 transition-colors underline">Mi cuenta</Link>.
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="animate-fade-in">
            <div className="grid place-items-center w-20 h-20 rounded-3xl bg-amber-500/15 border border-amber-700/50 mx-auto mb-5">
              <Icon name="shield" className="w-9 h-9 text-amber-400" />
            </div>
            <p className="text-lg font-black text-white mb-1">No pudimos verificar el pago</p>
            <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
              Si completaste el pago, es posible que tarde unos segundos en procesarse.
              Intenta recargar la página o contacta con soporte.
            </p>
            <div className="flex flex-col gap-2">
              <button onClick={() => window.location.reload()}
                className="w-full py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-sm tap transition-colors">
                Reintentar
              </button>
              <Link href="/pricing"
                className="w-full py-2.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors text-center">
                Volver a los planes
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
