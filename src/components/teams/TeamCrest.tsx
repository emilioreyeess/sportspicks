"use client"

/**
 * TeamCrest — escudo/insignia de equipo a prueba de balas (regla R2).
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Resiliencia ante APIs (ESPN / API-Football):
 *   · `isInternational === true` → IGNORA `logoUrl` (aunque la API mande uno
 *     genérico inútil) y renderiza bandera emoji o siglas FIFA directamente.
 *   · Club con `logoUrl` válida → <img> con interceptor onError que cae al
 *     fallback tipográfico si la imagen se rompe. Cero imágenes rotas.
 *   · Sin logo y sin código → iniciales derivadas del nombre.
 *
 * Estética Apple-like: contenedor circular perfecto, fondo ultra sutil
 * (`bg-white/5`), borde tenue (`border-white/10`), siglas en texto limpio.
 */

import { useState } from "react"
import { getTeamCrest } from "@/lib/teams/crest"

type CrestSize = "sm" | "md" | "lg"

interface TeamCrestProps {
  /** Nombre del equipo — fuente del fallback (siglas FIFA o iniciales). */
  teamName: string
  /** URL del logo (club). `null`/vacío → fallback. Ignorado si isInternational. */
  logoUrl?: string | null
  /** Flag explícito: si true, jamás se intenta renderizar `logoUrl`. */
  isInternational?: boolean
  /** Tamaño del contenedor circular. Default "md" (w-8 h-8). */
  size?: CrestSize
  /** Clases extra opcionales para el contenedor. */
  className?: string
}

const SIZE_MAP: Record<CrestSize, { box: string; text: string; flag: string }> = {
  sm: { box: "w-6 h-6",  text: "text-[10px]", flag: "text-sm"   },
  md: { box: "w-8 h-8",  text: "text-xs",     flag: "text-base" },
  lg: { box: "w-10 h-10", text: "text-sm",    flag: "text-lg"   },
}

function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ")
}

/** Fallback circular Apple-like: bandera emoji si existe, si no las siglas. */
function CrestFallback({
  teamName, size, className,
}: { teamName: string; size: CrestSize; className?: string }) {
  const crest = getTeamCrest(teamName)
  const s = SIZE_MAP[size]
  return (
    <span
      className={cx(
        "inline-flex items-center justify-center rounded-full shrink-0",
        "bg-white/5 border border-white/10",
        s.box, className,
      )}
      role="img"
      aria-label={teamName}
      title={teamName}
    >
      {crest.emoji ? (
        <span className={cx("leading-none", s.flag)} aria-hidden="true">{crest.emoji}</span>
      ) : (
        <span className={cx("font-medium text-white/70 leading-none tracking-wide", s.text)} aria-hidden="true">
          {crest.initials}
        </span>
      )}
    </span>
  )
}

export function TeamCrest({
  teamName,
  logoUrl,
  isInternational = false,
  size = "md",
  className,
}: TeamCrestProps) {
  const [imgFailed, setImgFailed] = useState(false)

  // ── Interceptación internacional ───────────────────────────────────────────
  // Si es selección, ignoramos logoUrl SIEMPRE (incluso si la API lo manda).
  if (isInternational) {
    return <CrestFallback teamName={teamName} size={size} className={className} />
  }

  // ── Club sin logo válido o con imagen rota → fallback tipográfico ──────────
  const hasValidLogo =
    typeof logoUrl === "string" &&
    logoUrl.startsWith("http") &&
    !imgFailed
  if (!hasValidLogo) {
    return <CrestFallback teamName={teamName} size={size} className={className} />
  }

  // ── Club con logo válido → <img> con interceptor onError ───────────────────
  const s = SIZE_MAP[size]
  return (
    <span
      className={cx(
        "inline-flex items-center justify-center rounded-full shrink-0 overflow-hidden",
        "bg-white/5 border border-white/10",
        s.box, className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logoUrl!}
        alt={teamName}
        title={teamName}
        loading="lazy"
        className="w-full h-full object-contain p-0.5"
        onError={() => setImgFailed(true)}
      />
    </span>
  )
}

export default TeamCrest
