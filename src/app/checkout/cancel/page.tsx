import Link from "next/link"
import { Icon } from "@/components/ui/icons"

export default function CheckoutCancelPage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center animate-fade-in">
        <div className="grid place-items-center w-20 h-20 rounded-3xl bg-zinc-800 mx-auto mb-5">
          <Icon name="close" className="w-9 h-9 text-zinc-400" />
        </div>
        <p className="text-lg font-black text-white mb-1">Pago cancelado</p>
        <p className="text-sm text-zinc-400 mb-8 leading-relaxed">
          No se ha hecho ningún cargo. Puedes volver a los planes cuando quieras.
        </p>
        <Link href="/pricing"
          className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-zinc-950 font-bold text-sm tap w-full">
          <Icon name="crown" className="w-4.5 h-4.5" strokeWidth={2.2} />
          Ver planes premium
        </Link>
        <Link href="/"
          className="block mt-3 text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
          Volver al inicio
        </Link>
      </div>
    </div>
  )
}
