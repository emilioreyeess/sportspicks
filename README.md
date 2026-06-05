# SportsPicks Analytics

Plataforma SaaS de análisis deportivo cuantitativo (fútbol). Genera *value picks*
diarios con un modelo Poisson calibrado sobre datos reales. Sin datos inventados.

**Stack:** Next.js 15 (App Router) · React 18 · TypeScript · Tailwind CSS 3 ·
Supabase (PostgreSQL + RLS) · NextAuth (Google OAuth) · Stripe · Anthropic SDK ·
Vercel KV · Sentry.

---

## 🚀 Despliegue en Vercel — Variables de entorno

> Configúralas en **Vercel Dashboard → Project → Settings → Environment Variables**
> (entorno *Production*). **Nunca** las pongas en `NEXT_PUBLIC_` salvo donde se indique.

### ⚠️ CRÍTICAS — Supabase (sin estas, la app no arranca)

| Variable | Tipo | Descripción |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Pública | URL del proyecto Supabase (`https://<ref>.supabase.co`). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Pública | Anon key — segura en navegador, limitada por RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | **SECRETA** | Service-role key — **bypasa RLS**. Solo backend. Jamás en `NEXT_PUBLIC_` ni en el cliente. |

Las tres son la prioridad de configuración. El resto de variables habilitan
features concretas (pagos, IA, datos de fútbol, crons).

### Resto de variables requeridas en producción

| Variable | Usada por | Notas |
|---|---|---|
| `ANTHROPIC_API_KEY` | Bot IA, análisis, combinadas | Modelo `claude-sonnet-4-5-20250929`. |
| `STRIPE_SECRET_KEY` | Checkout / webhooks | Secreta. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Checkout (cliente) | Pública. |
| `STRIPE_WEBHOOK_SECRET` | `/api/webhooks/stripe` | Verifica firma; fail-closed si falta. |
| `STRIPE_PRICE_*` | Checkout | IDs de precios (premium/pro, mensual/anual). |
| `FOOTBALL_API_KEY` | `lib/infrastructure/footballApi` | API-Football v3. Sin ella, `/partidos` degrada. |
| `ADMIN_TOKEN` | `/api/admin/*` | Token de admin (comparación constant-time). Secreto. |
| `ADMIN_EMAILS` | `requireAdmin()` | Lista de emails admin separados por coma (fallback de `is_admin`). |
| `CRON_SECRET` | `/api/cron/*` | Protege los crons; fail-closed si falta o es corto. |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Vercel KV (caché) | Opcional — sin ellas, degrada a no-cache. |
| `SENTRY_*` | Monitoring | Opcional. |

---

## 🔒 Seguridad

- **RLS habilitada** en todas las tablas; el backend usa `service_role`, el
  cliente solo `anon` (limitado por políticas `deny_anon`).
- **Sin secretos en el repo**: todas las claves vienen de `process.env`.
  `.env.local` está en `.gitignore` y nunca se commitea.
- **Rutas admin** protegidas server-side: `requireAdmin()` (sesión) o
  `ADMIN_TOKEN` con comparación de tiempo constante (CN-004).
- **Endpoints de debug** desactivados en producción (devuelven 404).
- Errores de DB nunca se exponen al cliente (mensajes genéricos, CN-026).

---

## 🛠️ Desarrollo local

```bash
npm install
# Crea .env.local con las variables de arriba (NO se commitea)
npm run dev          # http://localhost:3000
npm run build        # build de producción
```

`.env.local` (gitignored) — mínimo para arrancar:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
ANTHROPIC_API_KEY=<...>
FOOTBALL_API_KEY=<...>
# + Stripe, ADMIN_TOKEN, CRON_SECRET según las features que pruebes
```

---

## 📁 Estructura

```
src/
├── app/                  # App Router: páginas + rutas API
│   ├── api/              # Route handlers (picks, bets, admin, cron, leads…)
│   ├── guias/            # Pilares de contenido SEO (value-picks, modelo-poisson)
│   ├── glosario/         # Hub de glosario técnico (DefinedTermSet JSON-LD)
│   ├── herramientas/     # Calculadora EV (lead magnet)
│   ├── comparativa/      # Landing tipster-vs-algoritmo
│   ├── partidos/         # Vista diaria de fixtures (API-Football)
│   └── admin/            # Panel admin (gated)
├── components/           # UI, picks, paywall, teams, seo, herramientas
└── lib/
    ├── infrastructure/   # llmCache, footballApi, footballFilter
    ├── supabase/         # cliente + migraciones SQL
    └── ...
```

---

## ⚙️ Notas operativas

- **Vercel Hobby**: los crons solo corren **1×/día**. El *lazy refresh on-read*
  (`/api/picks/history` con `after()`) liquida pendientes vencidos entre crons.
- **Snapshot del modelo Claude**: `claude-sonnet-4-5-20250929` es la única fecha
  válida; cualquier otra produce un 500 silencioso.
- **Migraciones SQL** en `src/lib/supabase/*.sql` — aplícalas en Supabase antes
  de desplegar (tablas `leads`, `llm_cache`, `fixtures`, etc.).
