import { MetadataRoute } from "next"

const BASE = "https://sportspicks.app"

// Fechas estáticas por sección — `new Date()` en build-time es ignorado por
// Google (siempre ve la misma fecha = hoy). Usamos fechas de última revisión
// real para que la señal de frescura sea honesta y estable entre deploys.
const DATES = {
  home:        "2026-06-04",
  product:     "2026-06-04",  // value, bot, combinadas — actualizados esta sesión
  tools:       "2026-06-04",  // stats, retos, historico
  seasonal:    "2026-06-04",  // world-cup-2026
  marketing:   "2026-06-04",  // pricing, about
  content:     "2026-06-08",  // guías, glosario, comparativa, herramienta, blog
  legal:       "2026-05-01",  // raramente cambian
} as const

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    // ─── Core producto (diario) ───────────────────────────────────────────
    {
      url: BASE,
      lastModified: DATES.home,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${BASE}/value`,           // ruta real de picks — /picks no existe
      lastModified: DATES.product,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${BASE}/combinadas`,
      lastModified: DATES.product,
      changeFrequency: "daily",
      priority: 0.90,
    },
    {
      url: `${BASE}/bot`,
      lastModified: DATES.product,
      changeFrequency: "weekly",
      priority: 0.90,
    },
    {
      url: `${BASE}/world-cup-2026`,
      lastModified: DATES.seasonal,
      changeFrequency: "daily",
      priority: 0.85,
    },
    // ─── Herramientas y análisis ──────────────────────────────────────────
    {
      url: `${BASE}/stats`,
      lastModified: DATES.tools,
      changeFrequency: "weekly",
      priority: 0.80,
    },
    {
      url: `${BASE}/retos`,
      lastModified: DATES.tools,
      changeFrequency: "weekly",
      priority: 0.75,
    },
    {
      url: `${BASE}/historico`,
      lastModified: DATES.tools,
      changeFrequency: "daily",
      priority: 0.70,
    },
    // ─── Marketing ───────────────────────────────────────────────────────
    {
      url: `${BASE}/pricing`,
      lastModified: DATES.marketing,
      changeFrequency: "monthly",
      priority: 0.80,
    },
    {
      url: `${BASE}/about`,
      lastModified: DATES.marketing,
      changeFrequency: "monthly",
      priority: 0.50,
    },
    // ─── Contenido SEO (guías, glosario, comparativa, herramienta, blog) ──
    {
      url: `${BASE}/guias/value-picks`,
      lastModified: DATES.content,
      changeFrequency: "monthly",
      priority: 0.70,
    },
    {
      url: `${BASE}/guias/modelo-poisson`,
      lastModified: DATES.content,
      changeFrequency: "monthly",
      priority: 0.70,
    },
    {
      url: `${BASE}/glosario`,
      lastModified: DATES.content,
      changeFrequency: "monthly",
      priority: 0.60,
    },
    {
      url: `${BASE}/comparativa/tipster-telegram-vs-algoritmo`,
      lastModified: DATES.content,
      changeFrequency: "monthly",
      priority: 0.65,
    },
    {
      url: `${BASE}/herramientas/calculadora-ev`,
      lastModified: DATES.content,
      changeFrequency: "monthly",
      priority: 0.65,
    },
    {
      url: `${BASE}/blog/big-data-analisis-rendimiento`,
      lastModified: DATES.content,
      changeFrequency: "monthly",
      priority: 0.55,
    },

    // ─── Legal ───────────────────────────────────────────────────────────
    {
      url: `${BASE}/legal/privacy`,
      lastModified: DATES.legal,
      changeFrequency: "yearly",
      priority: 0.20,
    },
    {
      url: `${BASE}/legal/terms`,
      lastModified: DATES.legal,
      changeFrequency: "yearly",
      priority: 0.20,
    },
    {
      url: `${BASE}/legal/cookies`,
      lastModified: DATES.legal,
      changeFrequency: "yearly",
      priority: 0.15,
    },
    {
      url: `${BASE}/legal/responsible-gaming`,
      lastModified: DATES.legal,
      changeFrequency: "yearly",
      priority: 0.20,
    },
    {
      url: `${BASE}/legal/gdpr`,
      lastModified: DATES.legal,
      changeFrequency: "yearly",
      priority: 0.15,
    },
  ]
}
