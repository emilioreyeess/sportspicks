import Link from "next/link"

export const metadata = {
  title: "Página no encontrada",
  robots: { index: false },
}

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6 py-12 safe-x">
      <div className="max-w-md w-full rounded-2xl border border-zinc-800 bg-zinc-900/70 backdrop-blur-sm shadow-xl p-6 text-center">
        <div className="text-5xl mb-3">🧭</div>
        <h2 className="text-xl font-black text-white tracking-tight">
          Esta ruta no existe
        </h2>
        <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
          Es posible que el enlace haya cambiado. Desde el inicio llegas a
          todas las herramientas.
        </p>
        <Link
          href="/"
          className="block mt-5 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-zinc-950 font-black text-sm tap shadow-lg shadow-emerald-900/30"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  )
}
