/**
 * /partidos — Vista diaria de partidos y estadísticas.
 *
 * Server Component. Consume getFixtures() (read-through: caché Supabase →
 * API-Football). Diseño analítico/brutalista: tabla de datos densa, alto
 * contraste, bordes duros, números tabulares. Cero decoración superflua.
 */

import type { Metadata } from "next"
import { getFixtures, type Fixture } from "@/lib/infrastructure/footballApi"
import { PremiumGate } from "@/components/paywall/PremiumGate"
import { FixturesAccordion } from "@/components/partidos/FixturesAccordion"

// La vista depende de datos en vivo por fecha → render dinámico, sin prerender.
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export const metadata: Metadata = {
  // `absolute` evita el sufijo del template del root layout.
  title: { absolute: "Partidos y Estadísticas | SportsPicks" },
  description:
    "Partidos del día con hora, estado y resumen estadístico. Datos cacheados de API-Football para análisis cuantitativo.",
  alternates: { canonical: "/partidos" },
}

// ── Helpers de formato ────────────────────────────────────────────────────────

const TZ = "Europe/Madrid"

function todayMadrid(): string {
  // YYYY-MM-DD en zona Europe/Madrid (es-CA da formato ISO-like).
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone: TZ,
  }).format(new Date())
}

/** Mapea el código corto de estado de API-Football a etiqueta + tono. */
function statusLabel(status: string | null): { text: string; tone: "live" | "done" | "scheduled" } {
  const s = (status ?? "").toUpperCase()
  if (["1H", "2H", "HT", "ET", "P", "LIVE", "BT"].includes(s)) return { text: "EN JUEGO", tone: "live" }
  // "FINISHED" = valor de nuestro cron de resultados; FT/AET/PEN = API-Football.
  if (["FT", "AET", "PEN", "FINISHED"].includes(s)) return { text: "FINALIZADO", tone: "done" }
  if (["PST", "CANC", "ABD", "SUSP"].includes(s)) return { text: "SUSPENDIDO", tone: "done" }
  return { text: "PROGRAMADO", tone: "scheduled" }
}


// ── Página ────────────────────────────────────────────────────────────────────

export default async function PartidosPage() {
  const date = todayMadrid()

  let fixtures: Fixture[] = []
  let loadError = false
  try {
    fixtures = await getFixtures(date)
  } catch {
    loadError = true
  }

  const live      = fixtures.filter((f) => statusLabel(f.status).tone === "live").length
  const finished  = fixtures.filter((f) => statusLabel(f.status).tone === "done").length
  const scheduled = fixtures.length - live - finished

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10 pb-24">

      {/* ── Cabecera ──────────────────────────────────────────────────── */}
      <header className="mb-6">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <p className="apple-eyebrow text-zinc-600 mb-2">Datos · API-Football</p>
            <h1 className="text-[22px] sm:text-[26px] font-black text-white tracking-tight leading-tight">
              Partidos del Día
            </h1>
          </div>
          <p className="text-[13px] text-zinc-500 tabular-nums">{date}</p>
        </div>
      </header>

      {/* ── Barra de métricas ─────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total",       value: fixtures.length },
          { label: "En juego",    value: live },
          { label: "Programados", value: scheduled },
          { label: "Finalizados", value: finished },
        ].map((m) => (
          <div key={m.label} className="min-w-0 bg-zinc-900/40 rounded-2xl border border-white/[0.05] px-3 py-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-1 truncate whitespace-nowrap">{m.label}</p>
            <p className="text-2xl font-bold text-white tabular-nums leading-none">{m.value}</p>
          </div>
        ))}
      </div>

      {/* ── Acordeón de partidos (ligas TOP + "Ver más", pronóstico lazy) ── */}
      {fixtures.length > 0 ? (
        <FixturesAccordion fixtures={fixtures} />
      ) : (
        <div className="bg-zinc-900/40 rounded-2xl border border-white/[0.05] px-6 py-16 text-center">
          <p className="text-[13px] text-zinc-500">
            {loadError
              ? "No se pudieron cargar los partidos en este momento."
              : "No hay partidos registrados para esta fecha."}
          </p>
        </div>
      )}

      {/* ── Análisis cuantitativo (gateado Premium) ───────────────────── */}
      {fixtures.length > 0 && (
        <section className="mt-8" aria-label="Análisis cuantitativo">
          <PremiumGate
            feature="Análisis cuantitativo del día"
            hint="Distribución de partidos con datos estadísticos completos y cobertura del modelo. Disponible con Premium."
          >
            <div className="bg-zinc-900/40 rounded-2xl border border-white/[0.05] overflow-hidden">
              <div className="border-b border-white/[0.05] px-4 py-2.5">
                <span className="apple-eyebrow text-zinc-500">Análisis cuantitativo del día</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3">
                {[
                  { label: "Partidos con stats", value: fixtures.filter((f) => f.stats != null).length },
                  { label: "En juego ahora",     value: live },
                  { label: "Cobertura datos",    value: `${Math.round((fixtures.filter((f) => f.stats != null).length / fixtures.length) * 100)}%` },
                ].map((m, i) => (
                  <div key={m.label} className={`px-4 py-4 ${i > 0 ? "border-l border-white/[0.05]" : ""}`}>
                    <p className="apple-eyebrow text-zinc-600 mb-1">{m.label}</p>
                    <p className="text-2xl font-bold tabular-nums leading-none text-white">{m.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </PremiumGate>
        </section>
      )}

      {/* ── Pie técnico ───────────────────────────────────────────────── */}
      <p className="mt-4 text-[11px] text-zinc-600">
        Datos verificados de API-Football · caché propia · zona {TZ}
      </p>
    </main>
  )
}
