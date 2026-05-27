# PERFORMANCE REPORT — SportsPicks Analytics
**Fecha:** 2026-05-27

---

## RESUMEN DE PERFORMANCE

| Área | Estado | Riesgo |
|------|--------|--------|
| Índices DB | ✅ Completos | Bajo |
| N+1 queries | 🟡 Parciales | Medio |
| Rate limiting | 🟠 In-memory (no distribuido) | Alto |
| AI model cost | ✅ Mitigado con auth | Bajo |
| Edge cold starts | 🟡 Sin warm-up previo | Medio |
| Payload sizes | 🟡 Pool completo a Claude | Medio |

---

## ANÁLISIS DETALLADO

### 1. DATABASE PERFORMANCE

#### Índices — Estado tras fix F-10
```
✅ bets.user_email               → queries de "mis apuestas"
✅ bets.created_at DESC          → ordenación temporal
✅ bets.status                   → filtrado por estado
✅ bets.(user_email, status)     → NEW — filtrado compuesto eficiente
✅ bet_legs.bet_id               → join con apuestas
✅ group_members.(group_id)      → consultas de miembros
✅ group_members.(user_email)    → grupos de un usuario
✅ group_messages.(group_id, created_at DESC) → chat paginado
✅ tipster_bounties.tipster_email → NEW — bounties por usuario
✅ tipster_bounties.bet_id       → NEW — dedup por apuesta
✅ tipster_bounties.twitter_url  → NEW — dedup por tweet
✅ tipster_bounties.status       → filtrado por estado
✅ users_log.email               → lookups de usuario
✅ ai_learning_embeddings.created_at → NEW — embeddings recientes
```

#### N+1 Queries detectadas

**`/api/groups/[id]/ranking` — N+1 clásico:**
```typescript
// Para cada miembro del grupo (N):
for (const member of members) {
  const { data: bets } = await sb.from("bets").select(...)
    .eq("user_email", member.user_email) // ← query por cada usuario
}
```
**Impacto:** Con 20 miembros = 21 queries (1 get_members + 20 get_bets)
**Fix recomendado:**
```sql
-- Una sola query con JOIN
SELECT b.user_email, COUNT(*) filter (WHERE b.status = 'won') as won, ...
FROM bets b
INNER JOIN group_members gm ON gm.user_email = b.user_email
WHERE gm.group_id = $1
GROUP BY b.user_email;
```

**`/api/cron/settle-picks` — loop secuencial:**
```typescript
for (const b of pendingBounties ?? []) {
  await sb.from("tipster_bounties").update(...).eq("id", b.id) // ← 1 update por bounty
}
```
**Fix recomendado:** Bulk update con `IN (ids)`

### 2. AI ENGINE PERFORMANCE

#### Token usage — `/api/combinadas/ai`
- **Modelo actual:** `claude-opus-4-5` (más caro — $15/1M output)
- **Tokens por request:** ~1200 prompt + ~500 output ≈ 1700 tokens
- **Costo estimado por request:** ~$0.023 (prompt) + ~$0.0075 (output) = ~$0.030
- **Con 100 usuarios/día:** ~$3/día = ~$90/mes solo combinadas AI
- **Recomendación:** Migrar a `claude-sonnet-4-5` (~5x más barato) para el selector de picks — la calidad es suficiente para elegir 3-5 picks de un pool ya filtrado.

#### Cron embeddings — modelo redundante
- El cron usa Claude Haiku para generar un resumen de 1 frase por apuesta ganadora para luego almacenarlo sin vector. El campo `embedding` es `vector` pero se guarda como NULL (sin embeddings reales). Las llamadas a Haiku en el cron consumen tokens sin beneficio real hasta que se implemente la búsqueda vectorial.

### 3. EDGE COLD STARTS

- **Función:** Vercel Serverless (nodejs runtime) — no Edge
- **maxDuration:** 60s (combinadas/ai), 180s (admin), 60s (bot)
- **Cold start typical:** 500ms-2s en Node.js serverless
- **Mitigation existente:** `ensureWarm()` en combinadas/ai → precarga el store
- **Issue:** El pipeline diario corre a las 10:00 UTC. Si la primera request del día llega antes del warm-up, `getStore()` retorna estado vacío.

### 4. PAYLOAD SIZES

#### Combinadas AI — pool completo a Claude
```typescript
const items = pool.map((p: any, i: number) => ({
  i, match, league, market, selection, odd, prob, reasoning: p.reasoning?.slice(0, 100),
}))
// Si hay 200 picks en el pool → ~20KB de JSON enviados a Claude
```
**Consideración:** Con pool de 200+ partidos, el contexto puede ser grande. Filtrar el pool antes de enviarlo a Claude según la intención detectada (ya tiene `filterPoolByIntent` pero solo se usa en el fallback, no antes de la llamada a Claude).

### 5. DATABASE CONNECTION POOLING

La config de Supabase muestra:
```
config_max_pool_size: 10
server_max_conns: 60
strategy: fixed
```
Con Vercel serverless, cada función puede abrir nuevas conexiones. Con ~10 funciones concurrentes y pool de 10 → riesgo de agotamiento en picos de tráfico. Recomendado: usar Supabase con `?pgbouncer=true` en la connection string.

---

## MÉTRICAS TARGET

| Métrica | Actual (estimado) | Target |
|---------|-------------------|--------|
| TTFB API (bets/GET) | ~200-400ms | <150ms |
| Ranking query (20 miembros) | ~2000ms (N+1) | <100ms |
| Combinadas AI response | ~3-8s | <5s |
| DB pool exhaustion risk | Medio | Bajo |
| AI cost/day (100 users) | ~$3 | <$1 |
