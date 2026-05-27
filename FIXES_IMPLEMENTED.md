# FIXES IMPLEMENTED — SportsPicks Analytics
**Fecha de aplicación:** 2026-05-27  
**Engineer:** Staff Engineer + DevSecOps audit

---

## RESUMEN: 10 FIXES APLICADOS

| Fix | Severidad | Archivo | Estado |
|-----|-----------|---------|--------|
| F-01 | 🔴 CRITICAL | `api/admin/audit/route.ts` | ✅ Applied |
| F-02 | 🔴 CRITICAL | `api/admin/route.ts` | ✅ Applied |
| F-03 | 🔴 CRITICAL | `api/debug/supabase-check/route.ts` | ✅ Applied |
| F-04 | 🔴 CRITICAL | `api/tipster/claim-bounty/route.ts` | ✅ Applied |
| F-05 | 🔴 CRITICAL | `api/bets/[id]/route.ts` | ✅ Applied |
| F-06 | 🟠 HIGH | `api/bets/route.ts` | ✅ Applied |
| F-07 | 🟠 HIGH | `api/combinadas/ai/route.ts` | ✅ Applied |
| F-08 | 🟠 HIGH | `middleware.ts` | ✅ Applied |
| F-09 | 🟠 HIGH | `api/cron/settle-picks/route.ts` | ✅ Applied |
| F-10 | 🟡 MEDIUM | Supabase DB (SQL) | ✅ Applied |

---

## DETALLE DE CADA FIX

---

### F-01 — Autenticación en `/api/admin/audit`
**Archivo:** `src/app/api/admin/audit/route.ts`

**Antes:**
```typescript
export async function GET() {
  const store = getStore()
  return NextResponse.json({ ... }) // ← sin auth
}
```

**Después:**
```typescript
function isAuthorized(req: NextRequest): boolean {
  if (!ADMIN_TOKEN) return false
  const t = req.headers.get("x-admin-token") ?? ""
  if (t.length !== ADMIN_TOKEN.length) return false
  let diff = 0
  for (let i = 0; i < t.length; i++) diff |= t.charCodeAt(i) ^ ADMIN_TOKEN.charCodeAt(i)
  return diff === 0 // constant-time comparison
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  // ...
}
```

---

### F-02 — Eliminar token de URL en `/api/admin`
**Archivo:** `src/app/api/admin/route.ts`

**Antes:**
```typescript
const t = req.headers.get("x-admin-token") || new URL(req.url).searchParams.get("token") || ""
```

**Después:**
```typescript
// SECURITY: solo desde header — no query param (visible en logs, historial, referer)
const t = req.headers.get("x-admin-token") ?? ""
```

---

### F-03 — Deshabilitar endpoint de debug en producción
**Archivo:** `src/app/api/debug/supabase-check/route.ts`

**Antes:** Endpoint activo que insertaba `debug@test.com` en DB y exponía estado de env vars.

**Después:**
```typescript
export async function GET() {
  return Response.json({ error: "Not found" }, { status: 404 })
}
```

---

### F-04 — Validación VIP + URL + bet_id obligatorio en bounty claim
**Archivo:** `src/app/api/tipster/claim-bounty/route.ts`

**Cambios aplicados:**
1. Verifica `is_vip_tipster = true` antes de cualquier operación
2. `bet_id` ahora **obligatorio** (no puede ser null)
3. Validación de formato UUID para `bet_id`
4. Validación de URL Twitter/X con regex: `/^https?:\/\/(twitter\.com|x\.com)\/.+/i`
5. Límite de longitud de URL (500 chars)
6. Nuevo check de duplicado por `bet_id` (un bounty por apuesta ganadora)

```typescript
// VIP check
const { data: userLog } = await sb.from("users_log")
  .select("is_vip_tipster").eq("email", email).single()
if (!userLog?.is_vip_tipster)
  return Response.json({ error: "Solo los tipsters VIP pueden reclamar bounties" }, { status: 403 })

// bet_id obligatorio
if (!body.bet_id)
  return Response.json({ error: "Debes vincular una apuesta ganadora" }, { status: 400 })

// Duplicado por bet_id
const { data: dupBet } = await sb.from("tipster_bounties")
  .select("id").eq("bet_id", body.bet_id).single()
if (dupBet)
  return Response.json({ error: "Esta apuesta ya tiene un bounty reclamado" }, { status: 409 })
```

---

### F-05 — Race condition en settlement de apuestas (atomic update)
**Archivo:** `src/app/api/bets/[id]/route.ts`

**Antes (2 queries = race condition):**
```typescript
// Query 1: check ownership
const { data: existing } = await sb.from("bets").select("id, user_email").eq("id", params.id).single()
if (!existing || existing.user_email !== session.user.email) return 404

// Query 2: update (race condition window entre query 1 y 2)
const { data } = await sb.from("bets").update({ status: body.status }).eq("id", params.id).select().single()
```

**Después (1 query atómica):**
```typescript
// UUID validation
if (!/^[0-9a-f]{8}-...-[0-9a-f]{12}$/i.test(params.id))
  return Response.json({ error: "ID inválido" }, { status: 400 })

// Atomic: update SOLO si user_email == session email AND status == "pending"
const { data, error } = await sb.from("bets")
  .update({ status: body.status, settled_at: new Date().toISOString() })
  .eq("id", params.id)
  .eq("user_email", session.user.email)
  .eq("status", "pending")   // ← previene re-settlement
  .select().single()
```

---

### F-06 — Input validation completa en POST /api/bets
**Archivo:** `src/app/api/bets/route.ts`

**Constantes añadidas:**
```typescript
const MAX_STAKE = 100_000   // €100k max
const MIN_STAKE = 0.01      // €0.01 min
const MAX_ODDS  = 10_000    // @10k max
const MIN_ODDS  = 1.01      // @1.01 min
const MAX_LEGS  = 20        // max selecciones
const VALID_SPORTS = ["football","basketball","tennis","baseball","hockey","other"]
```

**Validaciones añadidas:**
- `title`: string requerido, máx 200 chars
- `stake`: finite number, 0.01–100,000
- `combined_odds`: finite number, 1.01–10,000
- `sport`: debe estar en whitelist
- `legs`: array, máx 20 items
- Cada leg: `match` y `selection` máx 200 chars, `odds` 1.01–10,000
- `notes`: máx 1000 chars
- Todas las strings se trimean antes de insertar en DB

---

### F-07 — Auth de sesión + per-user rate limit en `/api/combinadas/ai`
**Archivo:** `src/app/api/combinadas/ai/route.ts`

**Añadido:**
```typescript
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"

// Requiere sesión autenticada
const session = await getServerSession(authOptions)
if (!session?.user?.email) return Response.json({ error: "No autorizado" }, { status: 401 })

// Rate limit por IP Y por usuario (doble barrera)
if (!consume(`ai-combi:${ip}`, 3, 0.4)) return tooManyRequests(180)
if (!consume(`ai-combi-user:${session.user.email}`, 5, 1)) return tooManyRequests(120)
```

---

### F-08 — CSP completa en middleware
**Archivo:** `src/middleware.ts`

**Antes:** Solo `frame-ancestors 'none'`

**Después:** CSP completa con:
- `script-src 'self' 'unsafe-inline' 'unsafe-eval'` (requerido por Next.js)
- `style-src 'self' 'unsafe-inline'` (requerido por Tailwind)
- `img-src 'self' data: blob: https:`
- `connect-src 'self' https://*.supabase.co https://api.stripe.com wss://*.supabase.co`
- `frame-src 'none'` + `frame-ancestors 'none'`
- `object-src 'none'` + `base-uri 'self'`
- `upgrade-insecure-requests`
- Header adicional: `X-Permitted-Cross-Domain-Policies: none`
- HSTS con `preload` añadido

---

### F-09 — CRON_SECRET empty-string protection
**Archivo:** `src/app/api/cron/settle-picks/route.ts`

**Antes:**
```typescript
if (auth !== `Bearer ${process.env.CRON_SECRET}`) { ... }
// Si CRON_SECRET="" → check "Bearer " bypasseable
```

**Después:**
```typescript
const cronSecret = process.env.CRON_SECRET
if (!cronSecret || cronSecret.trim().length < 16) {
  console.error("[cron] CRON_SECRET not configured or too short — rejecting")
  return Response.json({ error: "Unauthorized" }, { status: 401 })
}
if (auth !== `Bearer ${cronSecret}`) { ... }
```

---

### F-10 — Supabase DB: índices + constraints (SQL ejecutado)

**Índices creados:**
```sql
CREATE INDEX bounties_tipster_email ON tipster_bounties (tipster_email);
CREATE INDEX bounties_bet_id ON tipster_bounties (bet_id);
CREATE INDEX bounties_twitter_url ON tipster_bounties (twitter_url);
CREATE INDEX bets_status_user ON bets (user_email, status);
CREATE INDEX embeddings_created_at ON ai_learning_embeddings (created_at DESC);
CREATE UNIQUE INDEX bounties_unique_bet_id ON tipster_bounties (bet_id) WHERE bet_id IS NOT NULL;
```

**CHECK constraints añadidos:**
```sql
ALTER TABLE group_messages ADD CONSTRAINT msg_content_length
  CHECK (content IS NULL OR length(content) <= 2000);

ALTER TABLE bets
  ADD CONSTRAINT bet_stake_positive CHECK (stake IS NULL OR (stake >= 0.01 AND stake <= 100000)),
  ADD CONSTRAINT bet_odds_positive CHECK (combined_odds IS NULL OR (combined_odds >= 1.01 AND combined_odds <= 10000));

ALTER TABLE bet_legs
  ADD CONSTRAINT leg_odds_positive CHECK (odds >= 1.01 AND odds <= 10000);
```
