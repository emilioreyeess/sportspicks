# SENTRY RUNTIME REPORT — SportsPicks Analytics
**Fecha:** 2026-05-27  
**Organización Sentry:** emilio-0f  
**Región:** https://de.sentry.io  

---

## ESTADO DE INTEGRACIÓN

### ⚠️ SENTRY NO ESTÁ INSTRUMENTADO EN EL CÓDIGO

**Resultado de búsqueda en Sentry (últimos 7 días):**
- Errores unresolved: **0**
- Eventos de error: **0**
- Spans/traces: **0**

**Causa:** Sentry está conectado como organización pero `@sentry/nextjs` **no está instalado** ni configurado en el proyecto. Ningún error de runtime está siendo capturado.

---

## LOGS DE SUPABASE (últimas 24h)

### Auth Logs
| Evento | Detalle |
|--------|---------|
| `user_signedup` | emilioreyescabrera@gmail.com — método email (via invite) |
| `Login` | user_id `f5c9e54e-...` — login implicit |
| `user_invited` | Invitación enviada por service_role a emilioreyescabrera@gmail.com |
| `mail.send` | Invite email enviado — noreply@mail.app.supabase.io |

### API Logs
| Endpoint | Count | Estado |
|----------|-------|--------|
| `POST /admin/v1/network-bans/retrieve` | 15+ | 200 OK — checks rutinarios de Supabase infra |
| `GET /auth/v1/health` | 8+ | 200 OK |
| `HEAD /rest-admin/v1/ready` | 8+ | 200 OK |
| `GET /auth/v1/verify` | 1 | 303 (redirect tras invite click) |

### Deprecation Warnings en Auth Logs
```
DEPRECATION NOTICE: GOTRUE_JWT_DEFAULT_GROUP_NAME not supported
DEPRECATION NOTICE: GOTRUE_JWT_ADMIN_GROUP_NAME not supported
```
→ Configuración legacy del proyecto Supabase. No es crítico pero debe limpiarse.

---

## ERRORES RUNTIME CONOCIDOS (análisis estático)

Sin Sentry activo, los siguientes errores son **inferidos** del análisis de código y son los más probables en producción:

### Error #1 — `upsertUserPlan` falla silenciosamente
```
Error: relation "user_profiles" does not exist
```
- **Origen:** `src/lib/supabase/client.ts` → `upsertUserPlan()` / `getUserPlan()`
- **Trigger:** Cuando se implemente el webhook de Stripe
- **Frecuencia esperada:** No activo todavía

### Error #2 — Rate limiter reset en cold start
- **Origen:** `src/lib/rate-limit.ts` — Map en memoria
- **Efecto:** Después de un cold start, todos los buckets se vacían. Un usuario podría hacer 3+ requests de IA seguidos después de cada cold start.

### Error #3 — `getStore()` vacío en warm-up
- **Origen:** `src/app/api/combinadas/ai/route.ts` — `getStore().combinadaPool`
- **Efecto:** Si el pipeline no ha corrido, devuelve 422 con mensaje genérico

### Error #4 — `getServerSession` lento en Edge
- **Origen:** Todos los route handlers que usan `getServerSession(authOptions)`
- **Efecto:** En Vercel serverless, cada request paga el coste de verificación del JWT. Sin caché de sesión esto puede ser 50-100ms por request.

---

## ACCIÓN RECOMENDADA: INTEGRAR SENTRY

```bash
# 1. Instalar SDK
npm install @sentry/nextjs

# 2. Configurar con wizard
npx @sentry/wizard@latest -i nextjs

# 3. Configurar DSN en Vercel env vars:
SENTRY_DSN=https://xxx@de.ingest.sentry.io/xxx
SENTRY_ORG=emilio-0f
SENTRY_PROJECT=sportspicks
```

**Archivos a crear tras wizard:**
- `sentry.client.config.ts` — browser error tracking
- `sentry.server.config.ts` — server error tracking  
- `sentry.edge.config.ts` — edge runtime tracking
- `next.config.js` — withSentryConfig wrapper

**Beneficio inmediato:** Captura de errores de Supabase, NextAuth, Stripe y AI en producción con stack traces completos.
