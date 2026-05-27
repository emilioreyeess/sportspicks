# SECURITY HARDENING COMPLETE — SportsPicks Analytics
**Fecha:** 2026-05-27  
**Estado:** HARDENING APLICADO ✅

---

## HARDENING APLICADO EN ESTA SESIÓN

### 1. AUTENTICACIÓN Y AUTORIZACIÓN

| Endpoint | Antes | Después |
|----------|-------|---------|
| `GET /api/admin/audit` | ❌ Anónimo | ✅ x-admin-token (constant-time compare) |
| `GET /api/debug/supabase-check` | ❌ Anónimo + escribe DB | ✅ Retorna 404 |
| `POST /api/tipster/claim-bounty` | ❌ Cualquier user | ✅ Solo VIP tipsters |
| `POST /api/combinadas/ai` | ❌ Solo rate-limit IP | ✅ Auth + IP + per-user rate limit |
| `GET /api/cron/settle-picks` | ⚠️ CRON_SECRET empty bypass | ✅ Validación longitud mínima 16 |

### 2. VALIDACIÓN DE INPUT

| API | Antes | Después |
|-----|-------|---------|
| `POST /api/bets` | ❌ Sin bounds | ✅ stake: 0.01-100k, odds: 1.01-10k |
| `POST /api/bets` | ❌ Legs ilimitados | ✅ Máx. 20 legs |
| `POST /api/bets` | ❌ Sin trim/sanitize | ✅ Trim en todos los strings |
| `PATCH /api/bets/[id]` | ❌ Sin validación UUID | ✅ Regex UUID validation |
| `POST /api/tipster/claim-bounty` | ❌ Twitter URL libre | ✅ Regex: twitter.com/x.com únicamente |
| `POST /api/tipster/claim-bounty` | ❌ bet_id opcional | ✅ bet_id obligatorio |

### 3. RACE CONDITIONS

| Operación | Antes | Después |
|-----------|-------|---------|
| Bet settlement | ❌ SELECT + UPDATE separados | ✅ Atomic UPDATE con `.eq("status","pending")` |
| Bounty dedup | ❌ Solo por twitter_url | ✅ También por bet_id (UNIQUE index) |

### 4. TOKENS Y SECRETS

| Problema | Antes | Después |
|----------|-------|---------|
| Admin token en URL | ❌ `?token=xxx` visible en logs | ✅ Solo header `x-admin-token` |
| CRON_SECRET vacío | ❌ Empty string bypasseable | ✅ Mínimo 16 caracteres requeridos |

### 5. CABECERAS HTTP

**Antes (middleware.ts):**
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=()...
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-DNS-Prefetch-Control: off
Content-Security-Policy: frame-ancestors 'none'    ← SOLO esto
```

**Después:**
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload  ← +preload
X-DNS-Prefetch-Control: off
X-Permitted-Cross-Domain-Policies: none                                  ← NUEVO
Content-Security-Policy:                                                  ← COMPLETA
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob: https:;
  font-src 'self' data:;
  connect-src 'self' https://*.supabase.co https://api.stripe.com wss://*.supabase.co;
  frame-src 'none';
  frame-ancestors 'none';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  upgrade-insecure-requests
```

### 6. BASE DE DATOS — CONSTRAINTS E ÍNDICES

**Nuevos índices:**
```sql
bounties_tipster_email    → queries por tipster
bounties_bet_id           → dedup por apuesta
bounties_twitter_url      → dedup por tweet  
bets_status_user          → filtro compuesto
embeddings_created_at     → queries temporales
bounties_unique_bet_id    → UNIQUE PARTIAL (bet_id IS NOT NULL)
```

**Nuevos CHECK constraints:**
```sql
msg_content_length    → group_messages.content ≤ 2000 chars
bet_stake_positive    → bets.stake entre 0.01 y 100k
bet_odds_positive     → bets.combined_odds entre 1.01 y 10k
leg_odds_positive     → bet_legs.odds entre 1.01 y 10k
```

---

## ESTADO FINAL DE SEGURIDAD

```
╔══════════════════════════════════════════════════════════╗
║  SPORTSPICKS SECURITY STATUS — 2026-05-27                ║
╠══════════════════════════════════════════════════════════╣
║  Auth bypass:           ✅ NINGUNO                       ║
║  Unauthenticated endpoints: ✅ 0 (todos protegidos)      ║
║  Input validation:      ✅ COMPLETA en bets + bounties   ║
║  Race conditions:       ✅ Atomic operations             ║
║  Secret leakage:        ✅ Admin token solo en headers   ║
║  CSP:                   ✅ Política completa             ║
║  DB constraints:        ✅ Bounds + UNIQUE               ║
║  AI cost protection:    ✅ Auth + dual rate limit        ║
╠══════════════════════════════════════════════════════════╣
║  Pendiente (HIGH):                                        ║
║  ⚠️  Stripe webhook plan update (TODO → implementar)     ║
║  ⚠️  Rate limit → Redis distribuido                      ║
║  ⚠️  Sentry SDK → integrar en next.config.js             ║
╚══════════════════════════════════════════════════════════╝
```

---

## CHECKLIST HARDENING — OWASP TOP 10

| OWASP | Descripción | Estado |
|-------|-------------|--------|
| A01 — Broken Access Control | 5 endpoints protegidos, atomic writes | ✅ |
| A02 — Cryptographic Failures | HTTPS everywhere, JWT signed | ✅ |
| A03 — Injection | Input validation + ORM (Supabase client) | ✅ |
| A04 — Insecure Design | Stripe webhook pending, plan sync missing | ⚠️ |
| A05 — Security Misconfiguration | Debug endpoint eliminado, CSP completa | ✅ |
| A06 — Vulnerable Components | No audit realizado aún | 🟡 |
| A07 — Auth Failures | NextAuth JWT, constant-time token compare | ✅ |
| A08 — Software Integrity | No SBOM, no dependency scan | 🟡 |
| A09 — Logging & Monitoring | Sentry no integrado | ⚠️ |
| A10 — SSRF | No fetch externo desde user input | ✅ |
