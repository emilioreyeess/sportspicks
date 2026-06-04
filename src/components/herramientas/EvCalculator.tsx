"use client"

/**
 * EvCalculator — Calculadora de Valor Esperado (EV) interactiva.
 *
 * Client Component: usa useState para cálculo en tiempo real sin round-trip.
 * Lead magnet: formulario de email con consentimiento explícito RGPD al final.
 *
 * Fórmula: EV = Stake × (Cuota × (ProbReal / 100) − 1)
 *
 * Integración de email: el POST a /api/leads/ev-calculator está preparado
 * pero el endpoint debe implementarse (Resend / Mailchimp / Supabase tabla).
 */

import { useState, useId } from "react"
import Link from "next/link"

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseNum(raw: string): number {
  return parseFloat(raw.replace(",", "."))
}

function calcEv(cuota: number, prob: number, stake: number): number | null {
  if (!isFinite(cuota) || !isFinite(prob) || !isFinite(stake)) return null
  if (cuota < 1.01 || prob <= 0 || prob > 100 || stake <= 0) return null
  return stake * (cuota * (prob / 100) - 1)
}

function fmtEv(ev: number): string {
  const sign = ev >= 0 ? "+" : ""
  return `${sign}${ev.toFixed(2)} €`
}

// ── Subcomponents ────────────────────────────────────────────────────────────

function InputField({
  id, label, value, onChange, placeholder, hint, min, max, step,
}: {
  id: string; label: string; value: string; onChange: (v: string) => void
  placeholder: string; hint: string; min?: number; max?: number; step?: number
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-[11px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        placeholder={placeholder}
        value={value}
        min={min}
        max={max}
        step={step ?? "any"}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[16px] text-white font-mono placeholder-zinc-700 outline-none transition focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/30"
      />
      <p className="text-[11px] text-zinc-600 mt-1.5">{hint}</p>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export function EvCalculator() {
  const uid = useId()

  // ── Calculator state ────────────────────────────────────────────────────────
  const [cuotaRaw, setCuotaRaw] = useState("2.10")
  const [probRaw,  setProbRaw]  = useState("55")
  const [stakeRaw, setStakeRaw] = useState("10")

  const cuota = parseNum(cuotaRaw)
  const prob  = parseNum(probRaw)
  const stake = parseNum(stakeRaw)
  const ev    = calcEv(cuota, prob, stake)

  const probImplicita = isFinite(cuota) && cuota >= 1.01
    ? (1 / cuota) * 100
    : null

  const edge = (isFinite(prob) && probImplicita !== null)
    ? prob - probImplicita
    : null

  const isPositive  = ev !== null && ev > 0
  const isNegative  = ev !== null && ev < 0
  const isZero      = ev !== null && ev === 0
  const hasValidEv  = ev !== null

  // ── Lead magnet state ───────────────────────────────────────────────────────
  const [email,    setEmail]    = useState("")
  const [consent,  setConsent]  = useState(false)
  const [sending,  setSending]  = useState(false)
  const [leadDone, setLeadDone] = useState(false)
  const [leadErr,  setLeadErr]  = useState<string | null>(null)

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!consent || !email.includes("@")) return
    setSending(true)
    setLeadErr(null)
    try {
      const res = await fetch("/api/leads/ev-calculator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, consent: true, source: "ev-calculator" }),
      })
      if (!res.ok) throw new Error("error")
      setLeadDone(true)
    } catch {
      setLeadErr("No se pudo registrar. Inténtalo de nuevo.")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-10">

      {/* ── Calculadora ────────────────────────────────────────────────── */}
      <section aria-label="Calculadora de EV">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <InputField
            id={`${uid}-cuota`}
            label="Cuota de la casa"
            value={cuotaRaw}
            onChange={setCuotaRaw}
            placeholder="2.10"
            hint="Cuota decimal ≥ 1.01"
            min={1.01}
            step={0.01}
          />
          <InputField
            id={`${uid}-prob`}
            label="Tu probabilidad real (%)"
            value={probRaw}
            onChange={setProbRaw}
            placeholder="55"
            hint="Entre 1 y 100"
            min={1}
            max={100}
            step={0.1}
          />
          <InputField
            id={`${uid}-stake`}
            label="Stake (€)"
            value={stakeRaw}
            onChange={setStakeRaw}
            placeholder="10"
            hint="Cantidad a apostar"
            min={0.01}
            step={0.01}
          />
        </div>

        {/* ── Resultado principal ──────────────────────────────────────── */}
        <div
          className={[
            "rounded-2xl border px-6 py-5 transition-all",
            isPositive
              ? "bg-emerald-500/[0.08] border-emerald-500/30"
              : isNegative
              ? "bg-rose-500/[0.08] border-rose-500/30"
              : "bg-zinc-900/40 border-white/[0.07]",
          ].join(" ")}
          aria-live="polite"
        >
          {hasValidEv ? (
            <>
              <div className="flex items-baseline gap-3 mb-3 flex-wrap">
                <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">
                  Valor Esperado (EV)
                </span>
                <span
                  className={[
                    "text-[clamp(2rem,6vw,3rem)] font-black leading-none tracking-tight",
                    isPositive ? "text-emerald-400" : isNegative ? "text-rose-400" : "text-zinc-400",
                  ].join(" ")}
                >
                  {fmtEv(ev!)}
                </span>
                <span
                  className={[
                    "text-[13px] font-bold px-3 py-1 rounded-full border",
                    isPositive
                      ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                      : isNegative
                      ? "bg-rose-500/15 border-rose-500/40 text-rose-300"
                      : "bg-zinc-800 border-zinc-700 text-zinc-400",
                  ].join(" ")}
                >
                  {isPositive ? "EV+" : isNegative ? "EV−" : "Neutro"}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-[13px]">
                <div>
                  <span className="text-zinc-600">Prob. implícita: </span>
                  <span className="text-zinc-300 font-mono">{probImplicita?.toFixed(1)}%</span>
                </div>
                <div>
                  <span className="text-zinc-600">Tu probabilidad: </span>
                  <span className="text-zinc-300 font-mono">{prob.toFixed(1)}%</span>
                </div>
                {edge !== null && (
                  <div>
                    <span className="text-zinc-600">Edge: </span>
                    <span
                      className={[
                        "font-mono font-semibold",
                        edge > 0 ? "text-emerald-400" : "text-rose-400",
                      ].join(" ")}
                    >
                      {edge > 0 ? "+" : ""}{edge.toFixed(1)} pp
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-zinc-600">Retorno si gana: </span>
                  <span className="text-zinc-300 font-mono">
                    +{(stake * (cuota - 1)).toFixed(2)} €
                  </span>
                </div>
                <div>
                  <span className="text-zinc-600">Retorno si pierde: </span>
                  <span className="text-rose-400 font-mono">−{stake.toFixed(2)} €</span>
                </div>
              </div>

              {isPositive && (
                <p className="text-[12px] text-emerald-500/70 mt-4 leading-relaxed">
                  Esta apuesta tiene valor matemático. En promedio y a largo plazo, cada{" "}
                  {stake.toFixed(2)} € apostados en estas condiciones generarán {fmtEv(ev!)} de beneficio neto.
                </p>
              )}
              {isNegative && (
                <p className="text-[12px] text-rose-500/70 mt-4 leading-relaxed">
                  Esta apuesta tiene esperanza negativa. La casa está pagando menos de lo que el riesgo estadístico merece según tu estimación.
                </p>
              )}
            </>
          ) : (
            <p className="text-[14px] text-zinc-600">
              Introduce cuota (≥ 1.01), probabilidad (1–100%) y stake para calcular el EV.
            </p>
          )}
        </div>
      </section>

      {/* ── Explicación rápida ──────────────────────────────────────────── */}
      <section className="rounded-2xl bg-zinc-900/30 border border-white/[0.05] px-5 py-4" aria-label="Fórmula">
        <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-600 mb-2">La fórmula</p>
        <code className="block font-mono text-[13px] text-emerald-300 leading-relaxed">
          EV = Stake × (Cuota × (ProbReal / 100) − 1)
        </code>
        <p className="text-[12px] text-zinc-600 mt-2 leading-relaxed">
          Si EV {">"} 0 la apuesta tiene valor. Si EV {"<"} 0 es matemáticamente desfavorable, independientemente del resultado individual.{" "}
          <Link href="/guias/value-picks" className="text-zinc-500 hover:text-zinc-300 underline underline-offset-2 transition-colors">
            Guía completa →
          </Link>
        </p>
      </section>

      {/* ── Lead Magnet ─────────────────────────────────────────────────── */}
      <section
        className="rounded-2xl border border-white/[0.07] bg-zinc-900/40 px-6 py-6"
        aria-label="Alertas de cuotas EV positivo"
      >
        {leadDone ? (
          <div className="text-center py-4">
            <p className="text-2xl mb-2">✓</p>
            <p className="text-[15px] font-bold text-white mb-1">¡Registrado!</p>
            <p className="text-[13px] text-zinc-500">
              Te avisaremos cuando el modelo detecte cuotas con EV+ en LaLiga, Champions y más ligas.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">
                Lead magnet gratuito
              </p>
              <h2 className="text-[18px] sm:text-[20px] font-black text-white tracking-tight mb-2">
                Recibe alertas de cuotas con EV+
              </h2>
              <p className="text-[13.5px] text-zinc-500 leading-relaxed max-w-md">
                Cuando el modelo detecte una ineficiencia real de mercado (edge ≥ 3%), te lo enviamos antes de que la cuota cierre. Sin spam, sin picks inventados. Cancelación inmediata.
              </p>
            </div>

            <form onSubmit={handleLeadSubmit} className="space-y-4" noValidate>
              <div>
                <label
                  htmlFor={`${uid}-email`}
                  className="block text-[11px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5"
                >
                  Tu email
                </label>
                <input
                  id={`${uid}-email`}
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="tu@email.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setLeadErr(null) }}
                  disabled={sending}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[15px] text-white placeholder-zinc-700 outline-none transition focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/30 disabled:opacity-50"
                />
              </div>

              {/* GDPR explicit consent */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={e => setConsent(e.target.checked)}
                  disabled={sending}
                  className="mt-0.5 w-4 h-4 shrink-0 accent-emerald-500 cursor-pointer"
                  aria-required="true"
                />
                <span className="text-[12px] text-zinc-500 leading-relaxed group-hover:text-zinc-400 transition-colors">
                  Acepto recibir alertas de cuotas con EV+ y comunicaciones relacionadas con SportsPicks Analytics.
                  He leído y acepto la{" "}
                  <Link
                    href="/legal/privacy"
                    className="text-zinc-400 underline underline-offset-2 hover:text-white transition-colors"
                    target="_blank"
                    rel="noopener"
                  >
                    política de privacidad
                  </Link>
                  . Puedo darme de baja en cualquier momento.
                  <span className="block mt-1 text-zinc-700 text-[11px]">
                    Base legal: consentimiento explícito (RGPD art. 6.1.a). Tratamiento: alertas de valor de cuotas. Sin cesión a terceros.
                  </span>
                </span>
              </label>

              {leadErr && (
                <p className="text-[12px] text-rose-400 font-medium">{leadErr}</p>
              )}

              <button
                type="submit"
                disabled={!consent || !email.includes("@") || sending}
                className={[
                  "w-full sm:w-auto px-8 py-3 rounded-xl font-bold text-[14px] border transition-all",
                  consent && email.includes("@") && !sending
                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25"
                    : "bg-zinc-900/40 border-white/[0.05] text-zinc-600 cursor-not-allowed opacity-50",
                ].join(" ")}
              >
                {sending ? "Enviando…" : "Quiero las alertas EV+"}
              </button>
            </form>
          </>
        )}
      </section>

      {/* ── Links internos ──────────────────────────────────────────────── */}
      <section aria-label="Continúa aprendiendo">
        <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-600 mb-3">
          Profundiza
        </p>
        <div className="flex flex-col gap-2">
          {[
            { href: "/guias/value-picks",   label: "Guía: Value Picks — Expected Value explicado" },
            { href: "/guias/modelo-poisson", label: "Guía: Modelo de Poisson — cómo se calculan las probabilidades" },
            { href: "/glosario#edge",        label: "Glosario: Edge matemático" },
            { href: "/glosario#clv",         label: "Glosario: CLV (Closing Line Value)" },
            { href: "/value",               label: "Ver los picks con EV+ del modelo hoy" },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2 text-[13px] text-zinc-500 hover:text-zinc-200 transition-colors group"
            >
              <span className="text-zinc-700 group-hover:text-emerald-500 transition-colors">→</span>
              {label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
