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

function fmtTime(iso: string | null): string {
  if (!iso) return "--:--"
  try {
    return new Intl.DateTimeFormat("es-ES", {
      hour: "2-digit", minute: "2-digit", timeZone: TZ,
    }).format(new Date(iso))
  } catch {
    return "--:--"
  }
}

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
  if (["FT", "AET", "PEN"].includes(s)) return { text: "FINALIZADO", tone: "done" }
  if (["PST", "CANC", "ABD", "SUSP"].includes(s)) return { text: "SUSPENDIDO", tone: "done" }
  return { text: "PROGRAMADO", tone: "scheduled" }
}

/** Extrae un resumen estadístico compacto y seguro del jsonb arbitrario. */
function statSummary(stats: unknown): string {
  if (!stats) return "—"
  if (Array.isArray(stats)) return `${stats.length} métricas`
  if (typeof stats === "object") {
    const keys = Object.keys(stats as Record<string, unknown>)
    return keys.length ? `${keys.length} campos` : "—"
  }
  return "—"
}

// ── Subcomponentes ────────────────────────────────────────────────────────────

function StatusTag({ status }: { status: string | null }) {
  const { text, tone } = statusLabel(status)
  const cls =
    tone === "live"
      ? "text-black bg-emerald-400"
      : tone === "done"
      ? "text-zinc-500 bg-zinc-900 border border-zinc-700"
      : "text-zinc-300 bg-zinc-800 border border-zinc-700"
  return (
    <span className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${cls}`}>
      {text}
    </span>
  )
}

function FixtureRow({ f }: { f: Fixture }) {
  return (
    <tr className="border-b border-zinc-800 hover:bg-zinc-900/60 transition-colors">
      <td className="px-4 py-3 font-mono text-[13px] text-zinc-400 tabular-nums whitespace-nowrap border-r border-zinc-800/60">
        {fmtTime(f.match_date)}
      </td>
      <td className="px-4 py-3 border-r border-zinc-800/60">
        <StatusTag status={f.status} />
      </td>
      <td className="px-4 py-3 text-[14px] font-semibold text-white text-right border-r border-zinc-800/60">
        {f.home_team ?? "—"}
      </td>
      <td className="px-3 py-3 text-[11px] font-mono text-zinc-600 text-center border-r border-zinc-800/60">
        VS
      </td>
      <td className="px-4 py-3 text-[14px] font-semibold text-white border-r border-zinc-800/60">
        {f.away_team ?? "—"}
      </td>
      <td className="px-4 py-3 font-mono text-[12px] text-zinc-500 tabular-nums whitespace-nowrap">
        {statSummary(f.stats)}
      </td>
    </tr>
  )
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
      <header className="border-b-2 border-zinc-700 pb-5 mb-0">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-zinc-600 mb-2">
              Datos · API-Football
            </p>
            <h1 className="text-[clamp(1.75rem,5vw,2.5rem)] font-black text-white tracking-tighter leading-none uppercase">
              Partidos del Día
            </h1>
          </div>
          <p className="font-mono text-[13px] text-zinc-500 tabular-nums">{date}</p>
        </div>
      </header>

      {/* ── Barra de métricas ─────────────────────────────────────────── */}
      <div className="grid grid-cols-4 border-x border-b border-zinc-800">
        {[
          { label: "Total",      value: fixtures.length },
          { label: "En juego",   value: live },
          { label: "Programados", value: scheduled },
          { label: "Finalizados", value: finished },
        ].map((m, i) => (
          <div
            key={m.label}
            className={`px-4 py-4 ${i > 0 ? "border-l border-zinc-800" : ""}`}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-600 mb-1">
              {m.label}
            </p>
            <p className="font-mono text-2xl font-black text-white tabular-nums leading-none">
              {m.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Tabla de datos ────────────────────────────────────────────── */}
      {fixtures.length > 0 ? (
        <div className="overflow-x-auto border-x border-b border-zinc-800">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-zinc-900 border-b-2 border-zinc-700">
                {["Hora", "Estado", "Local", "", "Visitante", "Stats"].map((h, i) => (
                  <th
                    key={i}
                    className={`px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500 ${
                      i === 2 ? "text-right" : i === 3 ? "text-center" : "text-left"
                    } ${i < 5 ? "border-r border-zinc-800/60" : ""}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fixtures.map((f) => <FixtureRow key={f.fixture_id} f={f} />)}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="border-x border-b border-zinc-800 px-6 py-16 text-center">
          <p className="font-mono text-[13px] text-zinc-600 uppercase tracking-wide">
            {loadError
              ? "// error al cargar datos de la fuente"
              : "// sin partidos registrados para esta fecha"}
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
            <div className="border border-zinc-700 bg-zinc-950">
              <div className="border-b border-zinc-800 bg-zinc-900 px-4 py-2">
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                  Análisis cuantitativo del día
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3">
                {[
                  { label: "Partidos con stats", value: fixtures.filter((f) => f.stats != null).length },
                  { label: "En juego ahora",     value: live },
                  { label: "Cobertura datos",    value: `${Math.round((fixtures.filter((f) => f.stats != null).length / fixtures.length) * 100)}%` },
                ].map((m, i) => (
                  <div key={m.label} className={`px-4 py-4 ${i > 0 ? "border-l border-zinc-800" : ""}`}>
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-600">{m.label}</p>
                    <p className="font-mono text-2xl font-black tabular-nums leading-none text-white">{m.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </PremiumGate>
        </section>
      )}

      {/* ── Pie técnico ───────────────────────────────────────────────── */}
      <p className="mt-4 font-mono text-[10px] text-zinc-700 uppercase tracking-wider">
        Lectura read-through · caché Supabase (TTL 6h) → API-Football · zona {TZ}
      </p>
    </main>
  )
}
