/**
 * /guias/value-picks — Pilar de contenido SEO
 *
 * Server Component puro, estático, 0 JS cliente.
 * Article JSON-LD + estructura semántica estricta para autoridad temática.
 */

import Link from "next/link"

const BASE = "https://www.sportspicks.es"
const PUBLISHED = "2026-06-04"
const MODIFIED  = "2026-06-04"

// ── Article JSON-LD ───────────────────────────────────────────────────────────

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  "@id": `${BASE}/guias/value-picks#article`,
  headline: "Qué son las Value Picks: Guía Matemática y Cálculo de Esperanza",
  description:
    "Cómo identificar cuotas mal ajustadas, calcular el Expected Value y por qué el volumen es la única forma de materializar el edge a largo plazo.",
  url: `${BASE}/guias/value-picks`,
  datePublished: PUBLISHED,
  dateModified:  MODIFIED,
  inLanguage: "es-ES",
  author: {
    "@type": "Organization",
    "@id": `${BASE}/#organization`,
    name: "SportsPicks Analytics",
  },
  publisher: {
    "@type": "Organization",
    "@id": `${BASE}/#organization`,
    name: "SportsPicks Analytics",
    logo: {
      "@type": "ImageObject",
      url: `${BASE}/logo.png`,
      width: 512,
      height: 512,
    },
  },
  mainEntityOfPage: { "@type": "WebPage", "@id": `${BASE}/guias/value-picks` },
  image: { "@type": "ImageObject", url: `${BASE}/opengraph-image.png`, width: 1200, height: 630 },
  articleSection: "Guías de apuestas deportivas",
  keywords: "value picks, expected value, probabilidad implícita, edge matemático, yield",
}

const jsonLdString = JSON.stringify(articleSchema)

// ── Prose helpers ─────────────────────────────────────────────────────────────

const H2 = ({ id, children }: { id: string; children: React.ReactNode }) => (
  <h2
    id={id}
    className="text-[20px] sm:text-[24px] font-black text-white tracking-tight leading-tight mt-12 mb-4 scroll-mt-20"
  >
    {children}
  </h2>
)

const H3 = ({ id, children }: { id: string; children: React.ReactNode }) => (
  <h3
    id={id}
    className="text-[16px] sm:text-[18px] font-bold text-zinc-200 tracking-tight mt-8 mb-3 scroll-mt-20"
  >
    {children}
  </h3>
)

const P = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[15px] text-zinc-400 leading-[1.75] mb-4">{children}</p>
)

const Formula = ({ children }: { children: React.ReactNode }) => (
  <div className="my-6 rounded-xl bg-zinc-900/60 border border-white/[0.07] px-5 py-4 font-mono text-[14px] sm:text-[15px] text-emerald-300 leading-relaxed overflow-x-auto">
    {children}
  </div>
)

const Callout = ({ variant = "info", children }: { variant?: "info" | "warn"; children: React.ReactNode }) => {
  const colors = variant === "warn"
    ? "border-amber-700/40 bg-amber-500/[0.06] text-amber-300/90"
    : "border-cyan-700/40 bg-cyan-500/[0.06] text-cyan-300/90"
  return (
    <div className={`my-6 rounded-xl border px-5 py-4 text-[13.5px] leading-relaxed ${colors}`}>
      {children}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ValuePicksGuidePage() {
  return (
    <>
      {/* Article JSON-LD */}
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: jsonLdString }}
      />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14 pb-28">

        {/* ── Breadcrumb ──────────────────────────────────────────── */}
        <nav className="flex items-center gap-1.5 mb-8 text-[11px] text-zinc-600" aria-label="Ruta de navegación">
          <Link href="/" className="hover:text-zinc-400 transition-colors">Inicio</Link>
          <span>/</span>
          <Link href="/guias" className="hover:text-zinc-400 transition-colors">Guías</Link>
          <span>/</span>
          <span className="text-zinc-400">Value Picks</span>
        </nav>

        {/* ── Header ──────────────────────────────────────────────── */}
        <header className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-700/30 px-2.5 py-1 rounded-full">
              Guía técnica
            </span>
            <span className="text-[11px] text-zinc-600">{new Date(PUBLISHED).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}</span>
          </div>
          <h1 className="text-[clamp(1.75rem,5vw,2.75rem)] font-black text-white tracking-tight leading-[1.1] mb-4">
            Qué son las Value Picks:<br />
            <span className="text-emerald-400">Guía Matemática</span> y Cálculo de Esperanza
          </h1>
          <p className="text-[16px] text-zinc-400 leading-relaxed max-w-[560px]">
            Una apuesta con valor no es la que más te gusta. Es aquella cuya probabilidad real supera la probabilidad implícita en la cuota. Todo lo demás es azar disfrazado de análisis.
          </p>
        </header>

        {/* ── Tabla de contenidos ──────────────────────────────────── */}
        <nav aria-label="Contenidos" className="mb-10 rounded-2xl bg-zinc-900/40 border border-white/[0.05] px-5 py-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 mb-3">En esta guía</p>
          <ol className="space-y-1.5 text-[13px]">
            {[
              ["#cuota-de-valor",        "1. La cuota de valor: una ineficiencia del mercado"],
              ["#expected-value",        "2. Expected Value (EV): la fórmula"],
              ["#probabilidad-implicita","3. Probabilidad implícita vs. probabilidad real"],
              ["#volumen-y-varianza",    "4. Volumen y varianza: los únicos aliados del EV"],
            ].map(([href, label]) => (
              <li key={href}>
                <a href={href} className="text-zinc-500 hover:text-zinc-200 transition-colors">
                  {label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article>

          {/* ── 1. Cuota de valor ───────────────────────────────────── */}
          <H2 id="cuota-de-valor">1. La cuota de valor: una ineficiencia del mercado</H2>

          <P>
            Los mercados de apuestas no son perfectos. Las casas de apuestas fijan cuotas combinando sus propios modelos estadísticos, la distribución del dinero apostado y un margen de beneficio (el <em>overround</em> o <em>vig</em>). Cuando la cuota resultante no refleja con precisión la probabilidad real de un resultado, se produce una ineficiencia: la <strong className="text-zinc-200">cuota de valor</strong> o <em>value bet</em>.
          </P>
          <P>
            Una cuota de valor existe cuando la probabilidad que estima tu modelo es mayor que la probabilidad que implica la cuota del mercado. Dicho de otro modo: el mercado infravalora la probabilidad de ese resultado y te ofrece más dinero del que estadísticamente merece el riesgo.
          </P>

          <Callout variant="info">
            <strong>Definición operativa:</strong> Una apuesta tiene valor si{" "}
            <code className="font-mono bg-white/[0.06] px-1 rounded">p_modelo {">"} p_implícita_cuota</code>.
            Cualquier apuesta que no cumpla esta condición tiene esperanza negativa por definición.
          </Callout>

          <H3 id="ineficiencia-del-mercado">Por qué los mercados generan ineficiencias</H3>
          <P>
            Las casas de apuestas reciben millones de apuestas de usuarios con distintos niveles de información. El dinero fluye hacia los equipos populares, los últimos campeones o los favoritos mediáticos, lo que a veces comprime sus cuotas por debajo de su probabilidad real. El equipo menos popular puede quedar sobrevaluado en cuota aunque su probabilidad sea genuinamente alta.
          </P>
          <P>
            Adicionalmente, en partidos con menor volumen de apuestas, los modelos internos de las casas son menos precisos y los errores de pricing son más frecuentes. Ahí es donde un modelo cuantitativo calibrado con datos reales puede detectar y explotar esas brechas.
          </P>

          {/* ── 2. Expected Value ───────────────────────────────────── */}
          <H2 id="expected-value">2. Expected Value (EV): la fórmula</H2>

          <P>
            El <strong className="text-zinc-200">Expected Value</strong> o Esperanza Matemática es la ganancia media que obtendrías si repitieras la misma apuesta un número infinito de veces. Es el único número que importa cuando se razona sobre apuestas desde una perspectiva matemática.
          </P>

          <H3 id="formula-ev">La fórmula paso a paso</H3>

          <Formula>
            EV = (p × ganancia_neta) − (1 − p) × stake
          </Formula>

          <P>
            Donde <code className="font-mono text-sm text-zinc-300 bg-white/[0.05] px-1.5 py-0.5 rounded">p</code> es la probabilidad real estimada por el modelo (no la implícita en la cuota), y <code className="font-mono text-sm text-zinc-300 bg-white/[0.05] px-1.5 py-0.5 rounded">ganancia_neta = stake × (cuota − 1)</code>.
          </P>
          <P>
            Sustituyendo:
          </P>

          <Formula>
            EV = stake × [ p × (cuota − 1) − (1 − p) ]<br />
            EV = stake × [ p × cuota − 1 ]
          </Formula>

          <H3 id="ejemplo-numerico">Ejemplo numérico concreto</H3>
          <P>
            Supón que el modelo estima que el equipo A tiene un 55 % de probabilidad de ganar. La casa ofrece cuota 2.10 para esa victoria. La apuesta es de 10 €.
          </P>

          <Formula>
            p = 0.55 | cuota = 2.10 | stake = 10 €<br /><br />
            EV = 10 × [ 0.55 × 2.10 − 1 ]<br />
            EV = 10 × [ 1.155 − 1 ]<br />
            EV = 10 × 0.155 = <strong>+1.55 €</strong>
          </Formula>

          <P>
            El EV positivo de +1.55 € significa que, en promedio y a largo plazo, cada apuesta de 10 € en esa selección generará 1.55 € de beneficio. <strong className="text-zinc-200">Ese es el edge matemático.</strong>
          </P>

          <Callout variant="warn">
            Un EV positivo no garantiza ganar la próxima apuesta. Garantiza que la estrategia es rentable si se aplica con suficiente volumen. La varianza a corto plazo puede producir rachas negativas incluso con edge real.
          </Callout>

          {/* ── 3. Probabilidad implícita ───────────────────────────── */}
          <H2 id="probabilidad-implicita">3. Probabilidad implícita vs. probabilidad real</H2>

          <P>
            Toda cuota lleva embebida una probabilidad. Es lo que la casa cree (o quiere que creas) sobre las posibilidades de un resultado. Se calcula invirtiendo la cuota decimal:
          </P>

          <Formula>
            p_implícita = 1 / cuota<br /><br />
            Ejemplo: cuota 2.10 → p_implícita = 1 / 2.10 = 0.476 (47.6%)
          </Formula>

          <H3 id="overround">El overround: el margen silencioso</H3>
          <P>
            En un partido con dos resultados posibles, si sumas las probabilidades implícitas de ambas cuotas obtendrás siempre un número mayor que 1.0 (por ejemplo, 1.06 o 1.08). Ese exceso es el <strong className="text-zinc-200">overround</strong>, el margen garantizado de la casa. Representa el porcentaje de tu dinero que pierdes estadísticamente por el simple hecho de apostar, sin importar qué resultado eliges.
          </P>

          <Formula>
            Overround = (1/cuota_local) + (1/cuota_visitante) − 1<br /><br />
            Ejemplo: cuota_A = 1.90, cuota_B = 2.05<br />
            Overround = (1/1.90) + (1/2.05) − 1 = 0.526 + 0.488 − 1 = 0.014 (1.4%)
          </Formula>

          <H3 id="diferencia-clave">La diferencia que define el value</H3>
          <P>
            Si tu modelo estima que el equipo A tiene un 55 % de probabilidad real de ganar, pero la cuota ofrece una probabilidad implícita del 47.6 %, existe un gap de 7.4 puntos porcentuales a tu favor. Ese gap es el <strong className="text-zinc-200">edge</strong>. Sin ese gap, no hay value.
          </P>
          <P>
            El reto es construir un modelo cuyas estimaciones sean más precisas que las de la casa. SportsPicks usa un modelo de distribución de Poisson calibrado con datos reales de ESPN: goles esperados ajustados por rival, forma reciente, motivación contextual y shrinkage estadístico para muestras pequeñas.
          </P>

          {/* ── 4. Volumen y varianza ────────────────────────────────── */}
          <H2 id="volumen-y-varianza">4. Volumen y varianza: los únicos aliados del EV</H2>

          <P>
            El EV positivo no se manifiesta en una apuesta. Se manifiesta en miles. La varianza inherente al resultado de un partido —un gol en el minuto 94, un penalti polémico, una lesión en el primer tiempo— genera ruido que puede ocultar el edge durante semanas o meses.
          </P>

          <H3 id="ley-de-grandes-numeros">La ley de los grandes números en las apuestas</H3>
          <P>
            Si tienes un edge real del 3 % por apuesta, el porcentaje de veces que ese edge se traduce en beneficio neto converge al 3 % de tu volumen total apostado a medida que aumenta el número de picks. Con 50 picks, la varianza puede hacerte perder. Con 500, el ruido se atenúa. Con 5.000, los números mandan.
          </P>
          <P>
            Esto explica por qué el yield de un tipster con 30 picks es estadísticamente irrelevante. La <strong className="text-zinc-200">muestra mínima significativa</strong> en la literatura académica sobre apuestas deportivas suele situarse entre 300 y 500 picks con cuota media similar.
          </P>

          <H3 id="drawdown">El drawdown: rachas negativas con edge positivo</H3>
          <P>
            Incluso con un edge real del 5 %, una racha de 20 picks perdedores consecutivos es estadísticamente posible. El <em>drawdown</em> —la caída máxima del bankroll desde un máximo— es inevitable; la cuestión es si el bankroll puede absorberlo. Por eso la gestión del bankroll (flat stake, Kelly fraccionado) es tan importante como el edge mismo.
          </P>

          <Callout variant="info">
            <strong>Regla práctica:</strong> nunca apuestes más del 2-3 % de tu bankroll por pick, independientemente del edge estimado. La varianza puede destruir un bankroll correcto matemáticamente si el tamaño de las apuestas no está controlado.
          </Callout>

          <H3 id="clv-como-validacion">El CLV como validación del modelo</H3>
          <P>
            Una forma de validar el edge sin esperar 500 picks es el <strong className="text-zinc-200">Closing Line Value (CLV)</strong>: la diferencia entre la cuota a la que apostaste y la cuota de cierre del mercado justo antes del partido. Si tu modelo consistentemente apuesta antes de que la cuota caiga (el mercado converge hacia la probabilidad real a medida que llega más dinero informado), el CLV positivo es evidencia de que el modelo está detectando valor antes que el mercado.
          </P>
          <P>
            En SportsPicks, el CLV de cada pick es trazable en el histórico. No como un número inventado, sino como la diferencia medible entre la cuota en el momento de emisión y la cuota de cierre de ESPN.
          </P>

        </article>

        {/* ── Separador ───────────────────────────────────────────── */}
        <hr className="border-white/[0.06] my-12" />

        {/* ── CTA ─────────────────────────────────────────────────── */}
        <section className="rounded-2xl bg-emerald-500/[0.05] border border-emerald-700/30 px-6 py-7" aria-label="Próximo paso">
          <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-500/70 mb-2">
            Siguiente paso
          </p>
          <h2 className="text-[18px] sm:text-[20px] font-black text-white tracking-tight mb-3">
            Ve el modelo en acción
          </h2>
          <p className="text-[13.5px] text-zinc-400 leading-relaxed mb-5 max-w-[460px]">
            Los value picks diarios de SportsPicks se calculan con exactamente este proceso: probabilidad Poisson sobre cuota real de ESPN, filtro de edge mínimo del 3 % y publicación con histórico inmutable.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/value"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 font-semibold text-[13px] hover:bg-emerald-500/25 transition-all"
            >
              Ver picks de hoy
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </Link>
            <Link
              href="/historico"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-800/60 border border-white/[0.07] text-zinc-300 font-medium text-[13px] hover:bg-zinc-700/60 transition-all"
            >
              Histórico de resultados
            </Link>
          </div>
        </section>

        {/* ── Related ─────────────────────────────────────────────── */}
        <section className="mt-10" aria-label="Continúa aprendiendo">
          <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-600 mb-4">
            Continúa aprendiendo
          </p>
          <div className="flex flex-col gap-2">
            {[
              { href: "/glosario#clv",   label: "CLV (Closing Line Value) — definición técnica" },
              { href: "/glosario#yield", label: "Yield — qué es y cómo interpretarlo" },
              { href: "/glosario#edge",  label: "Edge matemático — cómo cuantificarlo" },
              { href: "/glosario#distribucion-de-poisson", label: "Distribución de Poisson — la base del modelo" },
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
      </main>
    </>
  )
}
