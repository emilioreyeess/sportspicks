# REMAINING RISKS — SportsPicks Analytics
**Fecha:** 2026-05-27  
**Nota:** Riesgos conocidos que NO fueron corregidos en esta sesión, con justificación y plan de acción.

---

## 🟠 HIGH — ACCIÓN REQUERIDA ANTES DE ESCALAR USUARIOS

### R-01 — Stripe Webhook: plan updates NO implementados
**Impacto:** Usuarios pagan → no reciben plan
**Acción:**
1. En `/api/checkout/route.ts`, añadir metadata al session de Stripe:
   ```typescript
   metadata: { email: session.user.email, plan: "premium" }
   ```
2. En `/api/webhooks/stripe/route.ts`, handler `checkout.session.completed`:
   ```typescript
   const email = sess.metadata?.email
   const plan = sess.metadata?.plan
   await sb.from("users_log").update({ plan }).eq("email", email)
   ```
3. Handler `customer.subscription.deleted`:
   ```typescript
   // Downgrade to free via customer email lookup
   ```
4. Corregir `upsertUserPlan()` para usar `users_log` no `user_profiles`

---

### R-02 — Rate Limiting distribuido (Redis/Upstash)
**Impacto:** Rate limit ineficaz en Vercel multi-instancia
**Acción:**
1. Crear cuenta Upstash (https://upstash.com) — free tier suficiente
2. Añadir `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` en Vercel
3. Instalar: `npm install @upstash/ratelimit @upstash/redis`
4. Reemplazar `src/lib/rate-limit.ts`:
   ```typescript
   import { Ratelimit } from "@upstash/ratelimit"
   import { Redis } from "@upstash/redis"
   
   const redis = Redis.fromEnv()
   const ratelimit = new Ratelimit({
     redis,
     limiter: Ratelimit.tokenBucket(3, "3m", 3),
   })
   ```

---

### R-03 — Sentry SDK no integrado
**Impacto:** Cero visibilidad de errores en producción
**Acción:**
```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```
Añadir en Vercel env vars:
- `SENTRY_DSN` = DSN de proyecto en emilio-0f.sentry.io
- `SENTRY_ORG` = emilio-0f
- `SENTRY_PROJECT` = sportspicks
- `SENTRY_AUTH_TOKEN` = token de API (para source maps)

---

## 🟡 MEDIUM — BACKLOG TÉCNICO

### R-04 — VIP status check en UI (localStorage vs Supabase)
**Descripción:** `TipsterQuickAccess` en home lee `localStorage.getItem("sp_vip_unlocked")`. Cualquiera puede activarlo con DevTools.
**Acción:** Leer el estado desde `/api/auth/plan` al montar el componente:
```typescript
useEffect(() => {
  fetch("/api/auth/plan").then(r => r.json()).then(d => setIsVip(d.is_vip_tipster))
}, [])
```

### R-05 — JWT plan refresh automático
**Descripción:** El plan no se refresca si cambia en Supabase entre sesiones.
**Acción:** En el callback JWT, añadir consulta periódica:
```typescript
async jwt({ token, user, trigger }) {
  if (trigger === "update" || !user) {
    // Refresh plan from DB every ~5min
    const plan = await getUserPlan(token.email as string)
    token.plan = plan
  }
  // ...
}
```

### R-06 — N+1 en grupos ranking
**Descripción:** `/api/groups/[id]/ranking` hace 1 query por miembro.
**Acción:** Reemplazar con una query SQL con GROUP BY (ver PERFORMANCE_REPORT.md).

### R-07 — Tabla `user_profiles` fantasma
**Descripción:** Funciones `upsertUserPlan` y `getUserPlan` apuntan a tabla inexistente.
**Acción:** Unificar en `users_log.plan`.

### R-08 — Paginación ausente en bets y messages
**Descripción:** Sin paginación, usuarios con muchas apuestas/mensajes cargan todo.
**Acción:** Añadir `?page=1&limit=50` con `.range()` en Supabase queries.

---

## 🔵 LOW — MEJORAS FUTURAS

### R-09 — Códigos VIP en git history
**Descripción:** Los códigos TIPSTER1/2/3, DEMO99, SPVIP01 están en el historial git.
**Acción:**
1. Desde Supabase Dashboard: `UPDATE vip_access_codes SET is_active = false WHERE code IN ('TIPSTER1','TIPSTER2','TIPSTER3','DEMO99','SPVIP01')`
2. Generar nuevos códigos con valores aleatorios seguros
3. No volver a commitear códigos en SQL files

### R-10 — Embeddings sin vectores reales
**Descripción:** El campo `embedding vector(1536)` se almacena como NULL.
**Acción:** Implementar vectorización con OpenAI Embeddings API o eliminar el campo hasta que se use.

### R-11 — Sentry deprecation warnings en Supabase
**Descripción:** `GOTRUE_JWT_DEFAULT_GROUP_NAME` y `GOTRUE_JWT_ADMIN_GROUP_NAME` deprecados.
**Acción:** Limpiar desde Supabase Dashboard → Settings → Auth → Advanced.

### R-12 — `npm audit` pendiente
**Descripción:** No se realizó auditoría de dependencias en esta sesión.
**Acción:** `npm audit --production` y `npm audit fix` para vulnerabilidades conocidas en paquetes.

---

## PRIORIZACIÓN RECOMENDADA

```
SEMANA 1 (crítico para negocio):
├── R-01: Stripe webhook → plan update
└── R-03: Integrar Sentry

SEMANA 2 (estabilidad):
├── R-02: Rate limit Redis/Upstash
└── R-05: JWT plan refresh

SEMANA 3 (tech debt):
├── R-04: VIP UI fix
├── R-06: N+1 ranking fix
└── R-07: user_profiles → users_log

FUTURO:
├── R-08: Paginación
├── R-09: Rotar VIP codes
├── R-10: Real embeddings
└── R-12: npm audit
```
