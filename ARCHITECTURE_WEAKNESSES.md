# ARCHITECTURE WEAKNESSES — SportsPicks Analytics
**Fecha:** 2026-05-27

---

## RESUMEN ARQUITECTÓNICO

```
[Browser]
   ↓ HTTPS
[Vercel Edge/Serverless]
   → Next.js 14 App Router
   → NextAuth (JWT strategy, Google OAuth)
   → API Routes (nodejs runtime)
   ↓
[Supabase PostgreSQL]   [Anthropic Claude API]   [Stripe]
```

---

## DEBILIDADES ESTRUCTURALES

### W-01 — Plan de usuario almacenado solo en JWT (no en DB)
**Severidad:** 🟠 HIGH  
**Descripción:**
```typescript
// auth-options.ts
token.plan = grant ?? "free" // ← se inyecta en JWT al login
```
El plan del usuario vive en el JWT firmado por NextAuth. La tabla `users_log` tiene columna `plan` pero no se consulta en cada request. Esto significa:
1. Si un usuario paga Premium hoy → su JWT sigue siendo "free" hasta que haga logout+login
2. Si se degrada un plan manualmente → el usuario retiene acceso hasta que expire su sesión
3. La tabla `user_profiles` referenciada en `upsertUserPlan()` **no existe** en el schema

**Fix propuesto:** En el callback JWT, consultar el plan actual de Supabase en cada token refresh (cada sesión activa) o implementar un endpoint `/api/auth/refresh-plan` que invalide el JWT.

---

### W-02 — Rate Limiting in-process (no distribuido)
**Severidad:** 🟠 HIGH  
**Descripción:**
```typescript
// rate-limit.ts
const buckets = new Map<string, Bucket>() // ← memoria del proceso
```
Vercel serverless crea múltiples instancias en paralelo. Cada instancia tiene su propio `Map`. Un atacante con 10 IPs puede hacer 3×10×N_instances = muchas llamadas a Claude Opus antes del primer throttle global.

**Fix propuesto:** Migrar a Upstash Redis (ya en docker-compose según comentario en rate-limit.ts):
```typescript
import { Redis } from "@upstash/redis"
// Token bucket distribuido con Redis INCR + TTL
```

---

### W-03 — Webhook de Stripe con TODOs críticos
**Severidad:** 🟠 HIGH  
**Descripción:** Los handlers de `checkout.session.completed` y `customer.subscription.deleted` son NOPs (solo `break`). La firma Stripe se verifica correctamente pero no se persiste nada. Un usuario que paga:
1. Recibe el cargo en Stripe ✅
2. Redirige a `/checkout/success` ✅  
3. Su `plan` en DB/JWT sigue siendo "free" ❌

**Fix propuesto:**
```typescript
case "checkout.session.completed": {
  const sess = event.data.object as Stripe.Checkout.Session
  const email = sess.metadata?.email
  const plan = sess.metadata?.plan as "premium" | "pro"
  if (email && plan) {
    const sb = createServiceClient()
    await sb.from("users_log").update({ plan }).eq("email", email)
  }
  break
}
```
**Prerequisito:** El checkout debe incluir `metadata: { email, plan }` al crear la session.

---

### W-04 — Tabla `user_profiles` fantasma
**Severidad:** 🟡 MEDIUM  
**Descripción:** `src/lib/supabase/client.ts` exporta `upsertUserPlan()` y `getUserPlan()` que referencian `user_profiles`. Esta tabla no existe en el schema actual. El plan real se almacena en `users_log.plan`.

**Fix:** Actualizar las funciones para usar `users_log`:
```typescript
export async function getUserPlan(email: string): Promise<"free" | "premium" | "pro"> {
  const sb = createServiceClient()
  const { data } = await sb.from("users_log").select("plan").eq("email", email).maybeSingle()
  return (data?.plan as "free" | "premium" | "pro") ?? "free"
}
```

---

### W-05 — VIP tipster status en localStorage (inseguro)
**Severidad:** 🟡 MEDIUM  
**Descripción:**
```typescript
// src/app/page.tsx — TipsterQuickAccess
const isVip = localStorage.getItem("sp_vip_unlocked") === "1"
```
El acceso al panel de tipster en el home se controla por localStorage. Cualquier usuario puede abrir DevTools y escribir `localStorage.setItem("sp_vip_unlocked", "1")` para ver el panel. Los endpoints API tienen validación real, pero la UI es engañosa.

**Impacto:** El panel de creadores es visible para cualquiera → posible confusión y soporte innecesario.

**Fix propuesto:** Verificar `is_vip_tipster` via `/api/auth/plan` en lugar de localStorage.

---

### W-06 — Embeddings sin vectores reales (waste de API calls)
**Severidad:** 🔵 LOW  
**Descripción:** El cron almacena "aprendizaje" en `ai_learning_embeddings` pero el campo `embedding vector(1536)` siempre es NULL. Se llama a Claude Haiku para generar un resumen de 1 frase, se guarda el texto, pero nunca se vectoriza. La búsqueda semántica futura requeriría el vector. Sin él, la tabla es texto no estructurado sin ninguna ventaja de RAG.

**Fix propuesto:** Usar la Embeddings API de Anthropic o OpenAI para generar el vector real antes de insertar, o eliminar el campo y simplificar.

---

### W-07 — Falta implementación de `/api/auth/plan`
**Severidad:** 🟡 MEDIUM  
**Descripción:** El archivo `/api/auth/plan/route.ts` existe (listado en el file tree) pero no se usa para mantener el plan sincronizado con Supabase. El plan en JWT puede quedar desactualizado indefinidamente.

---

### W-08 — Sin paginación en endpoints que retornan listas grandes
**Severidad:** 🟡 MEDIUM  
**Endpoints afectados:**
- `GET /api/bets` → retorna TODAS las apuestas del usuario sin límite
- `GET /api/groups/[id]/messages` → retorna mensajes sin paginación
- `GET /api/cron/settle-picks` → procesa TODOS los bounties pendientes en memoria

**Risk:** Con usuarios muy activos (100+ apuestas, 1000+ mensajes), estas queries pueden ser lentas y costosas.

**Fix propuesto:**
```typescript
// Paginación básica
const page = parseInt(req.nextUrl.searchParams.get("page") ?? "1")
const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "50"), 100)
const offset = (page - 1) * limit
await sb.from("bets").select("...").range(offset, offset + limit - 1)
```

---

## DIAGRAMA DE RIESGO RESIDUAL

```
CRÍTICO ██████░░░░ 0/5 activos (todos corregidos)
ALTO    ████░░░░░░ 2/6 pendientes (Stripe webhook, Rate limit Redis)
MEDIO   █████░░░░░ 4/8 pendientes (JWT plan sync, user_profiles, VIP localStorage, paginación)
BAJO    ██░░░░░░░░ 4/4 documentados (no críticos para producción actual)
```
