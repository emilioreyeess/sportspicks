"use client"

import { useEffect, useState } from "react"

/**
 * Imagen con lightbox: al pincharla se abre a pantalla completa (modal) para
 * leer bien el boleto. Se usa en Mis Apuestas y en el feed de Grupos.
 * stopPropagation evita disparar el toggle de la tarjeta contenedora.
 */
export function ZoomableImage({
  src, alt = "", className = "", thumbClassName = "",
}: { src: string; alt?: string; className?: string; thumbClassName?: string }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = "" }
  }, [open])

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onClick={(e) => { e.stopPropagation(); setOpen(true) }}
        className={`${className} ${thumbClassName} cursor-zoom-in`}
      />

      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-4 safe-top safe-bottom"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
          />
          <button
            onClick={() => setOpen(false)}
            aria-label="Cerrar imagen"
            className="absolute top-4 right-4 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white text-2xl leading-none hover:bg-white/20"
          >
            ×
          </button>
        </div>
      )}
    </>
  )
}
