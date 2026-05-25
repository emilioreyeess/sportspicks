# SportsPicks Analytics — Guías de configuración manual

> Este documento cubre los servicios externos que **no se pueden configurar en código** y requieren pasos manuales en sus dashboards.

---

## 1. Variables de entorno en Vercel

Ve a **Vercel → tu proyecto → Settings → Environment Variables** y añade las siguientes en el entorno **Production**:

| Variable | Descripción | Dónde obtenerla |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anon pública | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave service_role **(solo Server)** | Supabase → Project Settings → API |
| `DATABASE_URL` | Postgres con pgbouncer | Supabase → Project Settings → Database → URI |
| `DIRECT_URL` | Postgres directo (migraciones) | Supabase → Project Settings → Database → Direct URI |
| `NEXT_PUBLIC_SENTRY_DSN` | DSN de Sentry | Sentry → tu proyecto → Settings → SDK Setup |
| `SENTRY_AUTH_TOKEN` | Token para source maps en CI | Sentry → Settings → Auth Tokens |
| `SENTRY_ORG` | Nombre de la org en Sentry | Sentry → Organization Settings |
| `SENTRY_PROJECT` | Nombre del proyecto en Sentry | Sentry → Projects |
| `NEXT_PUBLIC_UMAMI_WEBSITE_ID` | Website ID de Umami | Umami → Settings → Websites |
| `NEXT_PUBLIC_UMAMI_SCRIPT_URL` | URL del script (opcional si usas Cloud) | Por defecto: `https://analytics.umami.is/script.js` |

---

## 2. Supabase — Configuración inicial (10–15 min)

### 2.1 Crear proyecto
1. Ve a [supabase.com](https://supabase.com) → **New project**
2. Nombre: `sportspicks-prod`
3. Región: **West EU (Ireland)** — más cerca del hosting de Vercel en EU
4. Anota la contraseña de base de datos (solo se muestra una vez)

### 2.2 Obtener credenciales
- **Project Settings → API** → copiar:
  - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
  - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` (**nunca exponer en frontend**)
- **Project Settings → Database** → copiar:
  - `Connection string (URI)` con `?pgbouncer=true&connection_limit=1` → `DATABASE_URL`
  - `Direct connection` → `DIRECT_URL`

### 2.3 Ejecutar schema + RLS
En **Supabase → SQL Editor → New query**, pega el contenido de:
```
frontend/src/lib/supabase/rls.sql
```
Ejecuta con **Run**. Verifica que no haya errores.

### 2.4 Ejecutar migraciones Prisma
```bash
cd frontend
npx prisma db push      # primera vez (sin historial de migraciones)
# o, para producción con historial:
npx prisma migrate deploy
```

### 2.5 Autenticación (opcional — actualmente en NextAuth)
Si en el futuro migras de NextAuth a Supabase Auth:
- **Authentication → Providers → Google** → pegar Client ID + Client Secret (los mismos de Google Cloud)
- **Authentication → URL Configuration** → añadir: `https://sportspicks.app/auth/callback`

---

## 3. BetterStack — Monitor de uptime (5 min)

1. Crea cuenta en [betterstack.com/uptime](https://betterstack.com/uptime)
2. **New monitor**:
   - URL: `https://sportspicks.app/api/health`
   - Check interval: **3 minutos**
   - Regions: US East + EU West (doble verificación)
   - Expected HTTP status: `200`
3. **Alertas** → añadir email + webhook (Discord/Slack si tienes)
4. **Status page pública** → crear página en `status.sportspicks.app` o subdirectorio — enlaza desde el footer de la app

### Respuesta esperada del endpoint `/api/health`
```json
{
  "status": "ok",
  "checks": { "pipeline": "ok", "kv": "ok" },
  "uptime_s": 12345,
  "version": "1.0.0",
  "commit": "abc1234"
}
```
BetterStack marcará la incidencia si devuelve `503` o si el campo `"status"` no es `"ok"`.

---

## 4. Sentry — Error tracking (5 min)

1. Crea cuenta en [sentry.io](https://sentry.io) → **New Project → Next.js**
2. Nombre: `sportspicks-frontend`
3. Copia el **DSN** → añade como `NEXT_PUBLIC_SENTRY_DSN` en Vercel
4. **Settings → Auth Tokens → Create Token** → añade como `SENTRY_AUTH_TOKEN` en Vercel (para source maps)
5. Crea alertas:
   - **Alerts → New Alert → Issues**: trigger cuando `count > 5 en 5 min` → notifica email
   - **Alerts → New Alert → Issues**: trigger en errores no controlados → notifica inmediatamente

Los ficheros `sentry.*.config.ts` ya están creados y se cargan automáticamente al hacer deploy.

---

## 5. Umami — Analytics privadas (5 min)

### Opción A: Umami Cloud (recomendado para empezar — gratis hasta 10k eventos/mes)
1. Crea cuenta en [umami.is](https://umami.is) → **Add website**
2. Nombre: `SportsPicks Analytics` | URL: `sportspicks.app`
3. Copia el **Website ID** → añade como `NEXT_PUBLIC_UMAMI_WEBSITE_ID` en Vercel
4. No necesitas `NEXT_PUBLIC_UMAMI_SCRIPT_URL` (usa el valor por defecto)

### Opción B: Self-hosted en Railway (gratis)
1. Crea cuenta en [railway.app](https://railway.app) → **New Project → Deploy from template → Umami**
2. Railway provisiona automáticamente PostgreSQL + el servidor Umami
3. Una vez desplegado, ve a tu dominio de Railway → **Settings → Add website** → igual que Opción A
4. Copia la URL del script de Railway → añade como `NEXT_PUBLIC_UMAMI_SCRIPT_URL`

### Analytics: el script ya está condicionado al consentimiento
El componente `ConditionalAnalytics` (ya en `layout.tsx`) solo carga Umami si el usuario acepta cookies analíticas en el banner.

---

## 6. CodeRabbit — Code review con IA (2 min)

1. Ve a [github.com/marketplace/coderabbitai](https://github.com/marketplace/coderabbitai)
2. **Install for free** → selecciona el repositorio `sports-picks`
3. La configuración ya está en `.coderabbit.yaml` en la raíz del frontend
4. Crea un PR de prueba para verificar que comenta automáticamente

---

## 7. Checklist pre-lanzamiento

### ✅ Implementado en código
- [x] Stripe live mode con webhook verificado (`STRIPE_WEBHOOK_SECRET`)
- [x] Google OAuth configurado (Google Cloud Console + NextAuth)
- [x] Rate limiting en bot, checkout, stats/team, second-opinion
- [x] SSRF protection en stats/team (slug whitelist)
- [x] Input validation en todas las rutas API
- [x] AgeGate (+18) en layout
- [x] CookieConsent con GDPR compliant (necesarias/analíticas/marketing)
- [x] Páginas legales: privacy, terms, cookies, gdpr, responsible-gaming
- [x] Error boundary global + `error.tsx` con Sentry
- [x] `robots.txt` y `sitemap.ts`
- [x] CSP headers en `next.config.js`
- [x] Health endpoint con checks de pipeline + KV
- [x] Sentry SDK instalado y configurado
- [x] ConditionalAnalytics (Umami con consentimiento)
- [x] Supabase client (`src/lib/supabase/client.ts`)
- [x] RLS SQL (`src/lib/supabase/rls.sql`)
- [x] CodeRabbit config (`.coderabbit.yaml`)
- [x] World Cup 2026 Hub completo
- [x] Decision Engine (5 modelos + 3 gates)
- [x] Retos v2 (4 niveles con validación estricta)
- [x] Custom Reto Creator para PRO

### 🔲 Requiere pasos manuales (este documento)
- [ ] Supabase: crear proyecto + correr `prisma db push` + ejecutar `rls.sql`
- [ ] BetterStack: crear monitor en `/api/health`
- [ ] Sentry: crear proyecto + añadir DSN en Vercel
- [ ] Umami: crear website + añadir ID en Vercel
- [ ] Variables de entorno en Vercel (tabla completa en §1)
- [ ] CodeRabbit: instalar desde GitHub Marketplace

### 🔲 Post-lanzamiento
- [ ] Apple Sign-In (requiere Apple Developer Program — 99 USD/año)
- [ ] Migración KV → Supabase PostgreSQL para ML data
- [ ] TypeScript strict: true
- [ ] CSP sin `'unsafe-eval'` (nonces nativos de Next.js 14.1+)
- [ ] HSTS preload submission ([hstspreload.org](https://hstspreload.org))
