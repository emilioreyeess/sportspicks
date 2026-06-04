/**
 * /guias/modelo-poisson — Pilar de contenido SEO técnico
 *
 * Server Component puro, estático, 0 JS cliente.
 * Article JSON-LD + estructura semántica H1→H2→H3.
 */

import Link from "next/link"

const BASE       = "https://sportspicks.app"
const PUBLISHED  = "2026-06-04"
const MODIFIED   = "2026-06-04"

// ── Article JSON-LD ───────────────────────────────────────────────────────────

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  "@id": `${BASE}/guias/modelo-poisson#article`,
  headline: "Modelo de Poisson en Apuestas: Predicción de Goles y Cuotas",
  description:
    "Cómo calcular Fuerza de Ataque, Fuerza de Defensa y el lambda de goles esperados, y convertir probabilidades exactas de marcador en cuotas 1X2 detectables como value.",
  url: `${BASE}/guias/modelo-poisson`,
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
  mainEntityOfPage: { "@type": "WebPage", "@id": `${BASE}/guias/modelo-poisson` },
  image: { "@type": "ImageObject", url: `${BASE}/opengraph-image.png`, width: 1200, height: 630 },
  articleSection: "Guías de apuestas deportivas",
  keywords: "modelo Poisson fútbol, predicción goles, fuerza de ataque, lambda esperanza goles, cuotas 1X2",
}

const jsonLdString = JSON.stringify(articleSchema)

// ── Prose helpers (mismos que value-picks) ────────────────────────────────────

const H2 = ({ id, children }: { id: string; children: React.ReactNode }) => (
  <h2 id={id} className="text-[20px] sm:text-[24px] font-black text-white tracking-tight leading-tight mt-12 mb-4 scroll-mt-20">
    {children}
  </h2>
)

const H3 = ({ id, children }: { id: string; children: React.ReactNode }) => (
  <h3 id={id} className="text-[16px] sm:text-[18px] font-bold text-zinc-200 tracking-tight mt-8 mb-3 scroll-mt-20">
    {children}
  </h3>
)

const P = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[15px] text-zinc-400 leading-[1.75] mb-4">{children}</p>
)

const Formula = ({ children, label }: { children: React.ReactNode; label?: string }) => (
  <div className="my-6 rounded-xl bg-zinc-900/60 border border-white/[0.07] px-5 py-4 overflow-x-auto">
    {label && (
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-2">{label}</p>
    )}
    <code className="font-mono text-[14px] sm:text-[15px] text-emerald-300 leading-relaxed whitespace-pre">
      {children}
    </code>
  </div>
)

const Callout = ({ variant = "info", children }: { variant?: "info" | "warn"; children: React.ReactNode }) => {
  const c = variant === "warn"
    ? "border-amber-700/40 bg-amber-500/[0.06] text-amber-300/90"
    : "border-cyan-700/40 bg-cyan-500/[0.06] text-cyan-300/90"
  return (
    <div className={`my-6 rounded-xl border px-5 py-4 text-[13.5px] leading-relaxed ${c}`}>
      {children}
    </div>
  )
}

const Table = ({ headers, rows }: { headers: string[]; rows: (string | React.ReactNode)[][] }) => (
  <div className="my-6 overflow-x-auto rounded-xl border border-white/[0.07]">
    <table className="w-full text-[13px] border-collapse">
      <thead>
        <tr className="border-b border-white/[0.08] bg-zinc-900/60">
          {headers.map((h) => (
            <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className={`border-b border-white/[0.04] ${i % 2 === 1 ? "bg-white/[0.015]" : ""}`}>
            {row.map((cell, j) => (
              <td key={j} className="px-4 py-3 text-zinc-400 align-top">{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ModeloPoissonPage() {
  return (
    <>
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
          <span className="text-zinc-400">Modelo de Poisson</span>
        </nav>

        {/* ── Header ──────────────────────────────────────────────── */}
        <header className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-violet-400 bg-violet-500/10 border border-violet-700/30 px-2.5 py-1 rounded-full">
              Guía técnica · Estadística
            </span>
            <span className="text-[11px] text-zinc-600">
              {new Date(PUBLISHED).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
            </span>
          </div>
          <h1 className="text-[clamp(1.75rem,5vw,2.75rem)] font-black text-white tracking-tight leading-[1.1] mb-4">
            Modelo de Poisson en Fútbol:<br />
            <span className="text-violet-400">Cómo Predecir Goles</span> y Detectar Cuotas de Valor
          </h1>
          <p className="text-[16px] text-zinc-400 leading-relaxed max-w-[560px]">
            La distribución de Poisson convierte partidos de fútbol en probabilidades exactas de marcador. Así funciona el núcleo matemático de SportsPicks — y así puedes construir el tuyo.
          </p>
        </header>

        {/* ── ToC ─────────────────────────────────────────────────── */}
        <nav aria-label="Contenidos" className="mb-10 rounded-2xl bg-zinc-900/40 border border-white/[0.05] px-5 py-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 mb-3">En esta guía</p>
          <ol className="space-y-1.5 text-[13px]">
            {[
              ["#poisson-futbol",     "1. Por qué Poisson encaja en el fútbol"],
              ["#fuerzas",           "2. Fuerza de Ataque y Fuerza de Defensa"],
              ["#formula",           "3. La fórmula P(x) = λˣ·e⁻λ / x!"],
              ["#1x2",               "4. De probabilidad de goles a cuota 1X2"],
              ["#limites",           "5. Lo que Poisson no ve"],
            ].map(([href, label]) => (
              <li key={href}>
                <a href={href} className="text-zinc-500 hover:text-zinc-200 transition-colors">{label}</a>
              </li>
            ))}
          </ol>
        </nav>

        <article>

          {/* ── 1. Por qué Poisson encaja ───────────────────────── */}
          <H2 id="poisson-futbol">1. Por qué la distribución de Poisson encaja en el fútbol</H2>

          <P>
            La distribución de Poisson modela la probabilidad de que ocurra exactamente <em>x</em> eventos en un intervalo fijo, bajo dos supuestos: los eventos son <strong className="text-zinc-200">independientes</strong> entre sí y ocurren a una <strong className="text-zinc-200">tasa media constante</strong> (λ, lambda). El fútbol cumple ambas condiciones de forma razonablemente buena.
          </P>
          <P>
            Cada gol es, en primera aproximación, un evento independiente del anterior: que el equipo A marque en el minuto 20 no cambia significativamente la probabilidad de que marque en el 65. El fútbol es además un deporte de baja puntuación (1.3–1.8 goles por equipo por partido en ligas europeas), lo que hace que la distribución discreta de Poisson capture la realidad mejor que una distribución continua.
          </P>

          <Callout variant="info">
            <strong>Supuesto central:</strong> los goles del equipo local y del visitante siguen distribuciones de Poisson independientes con medias λ_local y λ_visitante. La dependencia bivariada (sobre todo en empates 0-0) es una debilidad conocida del modelo — véase la sección 5.
          </Callout>

          <H3 id="historia-poisson">Contexto histórico: de Dixon-Coles al estado del arte</H3>
          <P>
            Mark Dixon y Stuart Coles publicaron en 1997 el paper fundacional que formalizó el uso de Poisson en fútbol, añadiendo un factor de corrección para resultados de baja puntuación (0-0, 1-0, 0-1, 1-1) donde la independencia falla. Desde entonces, el modelo Poisson calibrado es el <em>benchmark</em> de la industria. Los modelos más sofisticados (Dixon-Coles extendido, Poisson bivariado, modelos de Dixon-Robinson) parten de esta base.
          </P>

          {/* ── 2. Fuerzas ──────────────────────────────────────── */}
          <H2 id="fuerzas">2. Fuerza de Ataque y Fuerza de Defensa: el cálculo paso a paso</H2>

          <P>
            Para estimar λ necesitas parametrizar la capacidad ofensiva y defensiva relativa de cada equipo respecto a la media de su liga. Los parámetros clave son cuatro:
          </P>

          <Table
            headers={["Parámetro", "Definición", "Fórmula"]}
            rows={[
              ["Fuerza de Ataque (FA)", "Cuántos goles marca el equipo respecto a la media de la liga como local o visitante", "FA = goles_marcados / goles_esperados_liga"],
              ["Fuerza de Defensa (FD)", "Cuántos goles encaja respecto a la media de la liga en el mismo contexto", "FD = goles_encajados / goles_esperados_contra"],
              ["Media ataque local (MgL)", "Media de goles marcados como local por todos los equipos de la liga", "ΣG_local / n_partidos_local"],
              ["Media ataque visitante (MgV)", "Media de goles marcados como visitante por todos los equipos", "ΣG_visita / n_partidos_visita"],
            ]}
          />

          <H3 id="calculo-lambda">Cálculo de lambda para cada equipo</H3>
          <P>
            Con esos parámetros, la expectativa de goles de cada equipo en un partido concreto es:
          </P>

          <Formula label="Lambda local (equipo A en casa)">
{`λ_A = FA_local_A × FD_visitante_B × MgL

λ_B = FA_visitante_B × FD_local_A × MgV`}
          </Formula>

          <H3 id="ejemplo-fuerzas">Ejemplo numérico: Athletic Club vs. Celta</H3>
          <P>
            Supongamos los siguientes valores calculados con las últimas 10 jornadas de LaLiga:
          </P>

          <Formula label="Valores de entrada">
{`MgL = 1.55  (media de goles local en la liga)
MgV = 1.12  (media de goles visitante en la liga)

Athletic Club (local):
  FA_local  = 1.21  (21% más goleador que la media en casa)
  FD_local  = 0.87  (13% menos goles encajados en casa)

Celta (visitante):
  FA_visita = 0.94  (6% menos goleador que la media fuera)
  FD_visita = 1.08  (8% más goles encajados fuera)`}
          </Formula>

          <Formula label="Lambdas resultantes">
{`λ_Athletic = 1.21 × 1.08 × 1.55 = 2.025 goles esperados
λ_Celta    = 0.94 × 0.87 × 1.12 = 0.916 goles esperados`}
          </Formula>

          {/* ── 3. Fórmula ──────────────────────────────────────── */}
          <H2 id="formula">3. La fórmula central de Poisson</H2>

          <P>
            Con los lambdas calculados, la probabilidad de que un equipo marque exactamente <em>x</em> goles es:
          </P>

          <Formula label="Distribución de Poisson — fórmula general">
{`P(X = x) = (λˣ × e⁻λ) / x!

Donde:
  λ  = media de goles esperados (calculada con FA × FD × Mg_liga)
  x  = número exacto de goles que queremos calcular
  e  = constante de Euler ≈ 2.71828
  x! = factorial de x  (0! = 1, 1! = 1, 2! = 2, 3! = 6 ...)`}
          </Formula>

          <H3 id="tabla-prob">Tabla de probabilidades: Athletic (λ=2.025) y Celta (λ=0.916)</H3>
          <P>
            Aplicando la fórmula para x = 0, 1, 2, 3, 4 goles de cada equipo:
          </P>

          <Table
            headers={["Goles (x)", "P(Athletic = x)", "P(Celta = x)"]}
            rows={[
              ["0", "e^−2.025 / 0! = 0.132  (13.2%)", "e^−0.916 / 0! = 0.400  (40.0%)"],
              ["1", "2.025¹ × e^−2.025 / 1! = 0.267  (26.7%)", "0.916¹ × e^−0.916 / 1! = 0.367  (36.7%)"],
              ["2", "2.025² × e^−2.025 / 2! = 0.271  (27.1%)", "0.916² × e^−0.916 / 2! = 0.168  (16.8%)"],
              ["3", "2.025³ × e^−2.025 / 3! = 0.183  (18.3%)", "0.916³ × e^−0.916 / 3! = 0.051  (5.1%)"],
              ["4+", "≈ 0.147  (14.7%)", "≈ 0.014  (1.4%)"],
            ]}
          />

          <Callout variant="info">
            La suma de todas las probabilidades debe ser 1.0 (o muy próxima, limitada por el truncamiento a goles finitos). En la práctica se calcula hasta x = 8 o 10 goles para garantizar convergencia.
          </Callout>

          {/* ── 4. De prob a cuota 1X2 ──────────────────────────── */}
          <H2 id="1x2">4. De probabilidad de marcador a cuota 1X2</H2>

          <P>
            Una vez tienes las distribuciones completas de goles para cada equipo, construyes una <strong className="text-zinc-200">matriz de resultados</strong>: cada celda (i, j) representa la probabilidad de que el marcador sea exactamente <em>i</em> – <em>j</em>, calculada como el producto de las dos probabilidades independientes.
          </P>

          <Formula label="Probabilidad de un marcador exacto">
{`P(Athletic i – Celta j) = P(Athletic = i) × P(Celta = j)

Ejemplo: P(2–1) = 0.271 × 0.367 = 0.0994  (≈ 9.9%)`}
          </Formula>

          <H3 id="agregacion-1x2">Agregando la matriz al mercado 1X2</H3>
          <P>
            Para obtener las probabilidades del mercado de resultado final sumas todos los marcadores que corresponden a cada resultado:
          </P>

          <Formula label="Probabilidades 1X2 de nuestro ejemplo">
{`P(1 · Victoria local) = Σ P(i–j) para i > j  ≈  0.591  (59.1%)
P(X · Empate)        = Σ P(i–i)               ≈  0.207  (20.7%)
P(2 · Victoria visita)= Σ P(i–j) para j > i   ≈  0.202  (20.2%)

Suma = 1.000 ✓`}
          </Formula>

          <H3 id="conversion-cuota">Conversión a cuota y detección de value</H3>
          <P>
            La cuota justa (sin margen) se calcula invirtiendo la probabilidad. Si la casa ofrece una cuota diferente, puedes calcular si existe edge:
          </P>

          <Formula label="Cuota justa vs. cuota de mercado">
{`Cuota_justa_local = 1 / 0.591 = 1.69

Si el mercado ofrece cuota 1.85 para local:
  p_implícita_mercado = 1 / 1.85 = 0.541 (54.1%)
  p_modelo            =             0.591 (59.1%)

  Edge = 59.1% − 54.1% = +5.0% → VALUE BET`}
          </Formula>

          <P>
            Un edge del +5 % significa que el modelo estima que la casa está pagando mejor de lo que debería. Esta es la señal que activa un pick en SportsPicks — el modelo no emite picks con edge inferior al 3 %.
          </P>

          {/* ── 5. Límites ──────────────────────────────────────── */}
          <H2 id="limites">5. Lo que Poisson no ve: los modos de fallo</H2>

          <P>
            Ningún modelo captura la realidad completa. Conocer los límites de Poisson es tan importante como entender sus ventajas — y es lo que diferencia un modelo honesto de uno que promete más de lo que puede dar.
          </P>

          <Table
            headers={["Modo de fallo", "Por qué ocurre", "Mitigación en SportsPicks"]}
            rows={[
              [
                "Dependencia bivariada en empates 0-0",
                "Poisson independiente sobreestima la probabilidad de empates a cero. Los equipos que buscan empate activamente ajustan su comportamiento.",
                "Corrección Dixon-Coles en resultados de baja puntuación (ponderación ρ)",
              ],
              [
                "Tarjetas rojas",
                "Un expulsado en el minuto 30 modifica radicalmente el λ real del equipo, pero el modelo lo ignora porque se calculó pre-partido.",
                "No mitigable desde pre-partido. El modelo es válido solo para apuestas pre-match.",
              ],
              [
                "Fatiga y rotaciones",
                "Un equipo que jugó Europa League dos días antes tiene un λ efectivo menor. El modelo histórico no discrimina la frescura física.",
                "Peso de motivación y contexto: el motor analiza calendario y alineaciones esperadas como factor de ajuste.",
              ],
              [
                "Efectos de partido especial",
                "Últimas jornadas con clasificación en juego, rivalidades históricas o condiciones atmosféricas extremas no se reflejan en promedios históricos.",
                "Variable de motivación contextual (escala 0-1) que modifica el λ en función de la posición en tabla y objetivos del equipo.",
              ],
              [
                "Cambios de entrenador recientes",
                "Un equipo puede cambiar radicalmente su perfil ofensivo/defensivo con un nuevo técnico; el histórico pondera mal estas transiciones.",
                "Ventana deslizante corta (últimas 8-12 jornadas) con shrinkage hacia la media de la liga para evitar sobreajuste.",
              ],
            ]}
          />

          <Callout variant="warn">
            Poisson es un modelo de primer orden: correcto en media pero ciego a la dinámica intra-partido. Úsalo para generar una probabilidad base, no como oráculo. El edge real emerge de la diferencia sistemática entre tu calibración y la del mercado, no de predicciones perfectas en cada partido.
          </Callout>

        </article>

        {/* ── Separador ───────────────────────────────────────────── */}
        <hr className="border-white/[0.06] my-12" />

        {/* ── CTA ─────────────────────────────────────────────────── */}
        <section className="rounded-2xl bg-violet-500/[0.05] border border-violet-700/30 px-6 py-7" aria-label="Modelo en producción">
          <p className="text-[11px] font-bold uppercase tracking-widest text-violet-500/70 mb-2">
            El modelo en producción
          </p>
          <h2 className="text-[18px] sm:text-[20px] font-black text-white tracking-tight mb-3">
            Poisson calibrado con datos reales de ESPN
          </h2>
          <p className="text-[13.5px] text-zinc-400 leading-relaxed mb-5 max-w-[460px]">
            SportsPicks aplica esta metodología diariamente sobre 16 ligas de ESPN: FA, FD, shrinkage bayesiano, corrección Dixon-Coles y filtro de edge ≥ 3 %. Los picks resultantes tienen histórico público e inmutable.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/value"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-500/15 border border-violet-500/35 text-violet-300 font-semibold text-[13px] hover:bg-violet-500/25 transition-all"
            >
              Ver picks de hoy
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
            <Link
              href="/stats"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-800/60 border border-white/[0.07] text-zinc-300 font-medium text-[13px] hover:bg-zinc-700/60 transition-all"
            >
              Estadísticas de equipos
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
              { href: "/guias/value-picks",            label: "Guía: Qué son las Value Picks y el Expected Value" },
              { href: "/glosario#distribucion-de-poisson", label: "Glosario: Distribución de Poisson — definición" },
              { href: "/glosario#edge",                label: "Glosario: Edge matemático — cómo cuantificarlo" },
              { href: "/glosario#clv",                 label: "Glosario: CLV (Closing Line Value)" },
              { href: "/glosario#yield",               label: "Glosario: Yield — qué es y cómo interpretarlo" },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2 text-[13px] text-zinc-500 hover:text-zinc-200 transition-colors group"
              >
                <span className="text-zinc-700 group-hover:text-violet-500 transition-colors">→</span>
                {label}
              </Link>
            ))}
          </div>
        </section>
      </main>
    </>
  )
}
