import { MetadataRoute } from "next"

const BASE = "https://sportspicks.app"

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  return [
    // ─── Páginas principales ──────────────────────────────────────────────
    {
      url: BASE,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${BASE}/picks`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.95,
    },
    {
      url: `${BASE}/retos`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${BASE}/world-cup-2026`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.90,
    },
    {
      url: `${BASE}/combinadas`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.80,
    },
    // ─── Marketing ───────────────────────────────────────────────────────
    {
      url: `${BASE}/pricing`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.75,
    },
    {
      url: `${BASE}/about`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.50,
    },
    // ─── Legal ───────────────────────────────────────────────────────────
    {
      url: `${BASE}/legal/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.20,
    },
    {
      url: `${BASE}/legal/terms`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.20,
    },
    {
      url: `${BASE}/legal/cookies`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.15,
    },
    {
      url: `${BASE}/legal/responsible-gaming`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.20,
    },
    {
      url: `${BASE}/legal/gdpr`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.15,
    },
  ]
}
