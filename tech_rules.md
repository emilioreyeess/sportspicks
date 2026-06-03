# Tech Rules — Histórico + OCR de boleto

**Stack real verificado**

- Next.js **15.5.18** · App Router · TypeScript estricto (`strict: true`)
- Supabase Postgres (proyecto `qtsbmazqjdmwssplactj`, región eu-west-1) — pgvector + pg_trgm + RLS
- Vercel **Hobby plan** — limita crons a 1 ejecución/día por path
- ESPN public API (no API-Football)
- Anthropic SDK 0.98.0 · modelo Claude Vision `claude-haiku-4-5-20251001`
- Vercel KV (Redis-compatible) — opcional, degrada a no-cache si no está

---

## 1. Esquema de base de datos afectado

### `predictions_log` (existente — afectada por filtrado)

```sql
predictions_log (
  id            uuid pk,
  match_id      text,
  league        text,
  home_team     text,
  away_team     text,
  market        text,                                  -- 1x2|btts|goals_ou|corners_ou|cards_ou|handicap
  pick          text,
  odds          numeric,
  model_prob    numeric,                               -- 0..1
  edge          numeric,
  user_id       text,                                  -- NextAuth email (null = sistema)
  kickoff_iso   timestamptz,
  status        text  default 'pending'                -- pending|won|lost|void
                CHECK (status in ('pending','won','lost','void')),
  home_score    integer,
  away_score    integer,
  settled_at    timestamptz,
  created_at    timestamptz default now(),
  context       text  default 'club'                   -- club|international_friendly|international_competitive
                CHECK (context in (...)),
  source        text  default 'analysis_view'          -- value_pick|analysis_view
                CHECK (source in ('value_pick','analysis_view'))
)
```

Índices clave: `status`, `match_id`, `league`, `market`, `(source, status)`, `(context, status)`, `kickoff_iso`.

### `bets` (existente — extendida con OCR)

```sql
bets (
  id               uuid pk,
  user_email       text not null fk users_log(email) on delete cascade,
  title            text,
  stake            numeric(10,2),
  combined_odds    numeric(8,2),
  potential_return numeric(10,2),
  profit           numeric(10,2),
  status           text  default 'pending'             CHECK (...),
  is_pre_match     boolean default true,
  is_published     boolean default false,
  is_pro_exclusive boolean default false,
  ai_analyzed      boolean default false,
  sport            text  default 'football',
  notes            text,
  created_at       timestamptz default now(),
  settled_at       timestamptz,

  -- OCR pipeline (aplicadas por bets-ocr-migration.sql)
  image_url        text,                               -- URL pública Storage
  needs_review     boolean default false,              -- low-confidence flag
  ai_confidence    numeric(4,3),                       -- 0..1
  ai_extracted_at  timestamptz
)
-- Índice parcial:
CREATE INDEX bets_needs_review_idx ON bets (user_email, needs_review)
  WHERE needs_review = true;
```

### `bet_legs` (existente, sin cambios)

```sql
bet_legs (
  id          uuid pk,
  bet_id      uuid fk bets(id) on delete cascade,
  match       text not null,
  market      text,                                    -- nullable
  selection   text not null,
  odds        numeric(8,2) not null,
  status      text default 'pending',
  created_at  timestamptz default now()
)
```

### Funciones RPC (SECURITY DEFINER, grant solo a `service_role`)

| Función                         | Devuelve                                           |
|---------------------------------|----------------------------------------------------|
| `get_picks_global_stats(...)`   | `total_settled, wins, losses, voids, winrate_pct, avg_odd, roi_pct` |
| `get_picks_history_page(...)`   | filas de `predictions_log` orden DESC por kickoff |

Ambas aceptan filtros opcionales `p_context`, `p_user_id`, `p_source` (default `'value_pick'`), `p_since`/`p_before`, `p_limit` (clamp 1..200).

### Storage bucket

- `bet-images`: público en lectura, escritura solo con service_role. Path: `{base64url(email).slice(0,12)}/{timestamp}.{ext}`.

---

## 2. Manejo de nulos de la API (ESPN + Claude Vision)

### Regla maestra del proyecto

> Si un dato no existe, el campo se devuelve como `null`. Frontend muestra "N/A". **NUNCA se inventa.**

### En ESPN settlement (`settleGroundTruth`)

- Endpoint summary devuelve null/missing → `final = null` → status sigue `pending`, no se hace UPDATE.
- `completed: false` → pick sigue pending.
- `score` parsea con fallback a `0` solo cuando el evento ya está `completed` (no inventa marcadores pre-final).
- `boxscore.teams` ausente → `box.corners = null` y `box.cards = null` → mercados de corners/tarjetas devuelven `'void'` (no `won`/`lost`).

### En Claude Vision (`/api/bets/auto-extract`)

- Prompt explícito: stake/cuota no visibles → `null`.
- Cuotas individuales no legibles → `odds = 1.00` (placeholder marcado).
- `scoreExtraction()` penaliza placeholders y null:
  - `combinedOdds == null` → `-0.10`
  - `totalStake == null` → `-0.15`
  - `legs.length == 0` → `-0.40` (apuesta inútil)
  - `odds == 1` por leg → `-0.05` cada uno
- `needs_review = true` si `confidence < 0.7` o `stake/combinedOdds` faltan → la apuesta entra pero **no se publica** (`is_published = false`).
- Si Claude no devuelve JSON parseable → `HTTP 422` y la imagen subida queda huérfana solo si el `INSERT` falla (la limpiamos con `storage.from('bet-images').remove(...)`).

---

## 3. RLS y seguridad

### Tablas

| Tabla              | RLS | Política `select` anon | Política write |
|--------------------|-----|------------------------|----------------|
| `predictions_log`  | on  | ninguna                | service_role   |
| `model_performance`| on  | ninguna                | service_role   |
| `team_form_weights`| on  | ninguna                | service_role   |
| `bets`             | on  | sólo `user_email = auth.email()` | service_role |
| `bet_legs`         | on  | join via bets          | service_role   |
| `live_matches_cache`| on | `using (true)` (lectura pública) | service_role |

Las RPCs `get_picks_*` son `SECURITY DEFINER` con `grant execute … to service_role` — el cliente anónimo **no** las puede invocar; siempre pasan por route handler con service-role client.

### Storage (`bet-images`)

- Path tokenizado: `{base64url(email).slice(0,12)}/...` — no exhibe email en URLs.
- Bucket público de lectura (necesario para `<img src="public_url">` en clientes), escritura service-role only.

### Validación en endpoints

- Auth obligatoria (`getServerSession(authOptions)`) en `/api/bets/*`.
- Rate limit token-bucket por IP en endpoints OCR (5 req/min — Claude Vision cuesta).
- Validación de inputs:
  - File type whitelist (`image/jpeg|png|gif|webp`).
  - File size ≤ 5 MB.
  - Stake ≤ 100.000, odds ∈ [1.00, 10000].
  - Strings clampados a longitudes máximas (200 chars title, 200 match, 80 market…).
- **CN-026**: nunca exponer mensaje DB real al cliente — siempre genérico (`"Error interno"`).
- **CN-013**: tokens/códigos con `crypto.randomBytes`, no `Math.random`.
- **CN-031**: si `CRON_SECRET` no está seteado o tiene <16 chars → cron devuelve 401 (fail-closed).

### Contrato de la API — `stake` (regla R1, validación asimétrica)

El campo `stake` se valida de forma **distinta según el endpoint**. Esto es contrato, no detalle de implementación:

| Endpoint                       | Origen   | `stake` ausente / `<= 0`                                          | Respuesta |
|--------------------------------|----------|-------------------------------------------------------------------|-----------|
| `POST /api/bets`               | Manual   | **Validación estricta `stake > 0`**. Si `null`/`undefined`/no-numérico/`<= 0` → **NO inserta**. | `HTTP 400` `NextResponse` con `{ error: "Validation Error: Stake is required and must be greater than 0" }` |
| `POST /api/bets/auto-extract`  | OCR      | Persiste `stake = NULL` + `needs_review = true` (validación cruzada) + `is_published = false`. | `HTTP 201` con `{ bet, review: { needsReview: true, … } }` |
| `PATCH /api/bets/[id]`         | Edición  | Si se intenta `is_published = true` con `stake == null` → rechazo. | `HTTP 422` (pendiente — tarea E2) |

**Detalles técnicos del guard manual** (`POST /api/bets`):

- Guarda explícita de `body.stake === null \|\| body.stake === undefined` **antes** de `Number()` — evita el bug `Number(null) === 0` que dejaba pasar stakes ausentes.
- Constante `MIN_STAKE_MANUAL = 0.01` (estricto `> 0`), sustituye al antiguo `MIN_STAKE = 0` ("tracking-only").
- `stake > MAX_STAKE` conserva su propio mensaje (`"Stake demasiado alto"`), no se mezcla con el de "required".
- El INSERT manual **no** setea `needs_review` → default `false`. Todo ingreso manual válido va a `status: 'pending'`.

**Tipado**: el payload de `auto-extract` declara `stake: number | null` y `potential_return: number | null` explícitamente, alineado con `bets-stake-nullable-migration.sql` (que ejecutó `DROP DEFAULT` sobre ambas columnas). El endpoint manual usa `stake: number` (garantizado `> 0` por el guard previo).

---

## 4. Optimización de caché Next.js

### Estrategia de invalidación

| Disparador                              | Acción                                                |
|-----------------------------------------|-------------------------------------------------------|
| Cron `ml-settle` termina                | `revalidatePath('/historico'\|'/value'\|'/')` + `revalidateTag` |
| `GET /api/picks/history` lazy refresh   | Si liquidó alguna fila → `revalidatePath('/historico'\|'/value')` |
| `POST /api/bets/auto-extract` inserta   | `revalidatePath('/historico'\|'/bets')`               |

### Caché de datos

- `/api/picks/stats` y `/api/picks/history` con `export const dynamic = "force-dynamic"` — siempre recalculan, pero la RPC en Postgres es O(log n) por índices.
- `lastLazyRefreshAt` in-memory por instancia (throttle 5 min) evita martillear ESPN cuando muchos usuarios concurrentes hacen GET.
- Vercel KV opcional para `picks:yesterday` (TTL 48h) y `picks:today-raw` (TTL 36h) — el módulo no depende de KV, solo lo usa si está disponible.

### Caché del cliente

- Hooks (`useGlobalStats`, `useHistory`) usan `fetch(..., { cache: "no-store" })` — no cache HTTP, confiamos en `revalidatePath` para invalidar el render del lado server-component si existiera.
- `IntersectionObserver` con `rootMargin: 200px` carga la siguiente página antes de que el usuario llegue al final.

### Timezone

- **Todo internamente en UTC**: `kickoff_iso`, `cutoff`, `settled_at` son `timestamptz` y se comparan en UTC. No hay drift España/Canarias real.
- Mostrar al usuario: `Date.toLocaleDateString('es-ES', …)` en cliente — el browser aplica su TZ local. Tests pasan en cualquier huso.

---

## 5. Excepciones en Edge Function / route handlers

### Patrón estándar

```ts
export async function GET(req: NextRequest) {
  try {
    // ... lógica
    return NextResponse.json({ … })
  } catch (e: any) {
    console.error("[/api/...] error:", e?.message ?? e)
    return NextResponse.json(SAFE_EMPTY, { status: 200 })  // o 500 según gravedad
  }
}
```

### Degradación graceful

- `/api/picks/stats` y `/api/picks/history` → si Supabase falla, devuelven `{ days: [], nextCursor: null, count: 0 }` o `EMPTY_STATS` con HTTP 200. La UI nunca crashea por falta de creds o down de DB.
- `/api/bets/auto-extract` → si Claude Vision falla, `HTTP 502` y mensaje genérico; si Storage falla, `HTTP 500`; si INSERT falla, limpia la imagen huérfana.
- `refreshYesterdayPicks` y `maybeLazyRefresh` → atrapadas en try/catch; nunca rompen el GET principal.

### Sentry

- Todos los errores se reportan con `Sentry.captureException` desde `global-error.tsx` y `instrumentation.onRequestError` (server-side).
- `tracesSampleRate: 0.05` (5%) para no consumir cuota gratuita.
- `beforeSend` filtra ruido (extensiones de navegador, rate-limit esperados).

---

## 6. TypeScript estricto

### Reglas no negociables

- `strict: true` en `tsconfig.json` — sin escape.
- No `any` salvo en boundaries con APIs externas sin tipos (ESPN, Anthropic content blocks) y con cast localizado.
- Interfaces explícitas para `HistoryPick`, `DayBlock`, `GlobalStats`, `ExtractedBet`, `ExtractedLeg`.
- `Number(x) || 0` solo cuando el origen es input usuario o JSON externo (parsing defensivo).
- Discriminated unions para estados (`ResultType = "WIN" | "LOSS" | "VOID"`).

### Hidratación Next.js

- Páginas `/historico` y `/bets` son `"use client"` (necesitan `useSession`, `useEffect`, `IntersectionObserver`).
- Server components: `layout.tsx`, error boundaries, metadata.
- **Sin** `Date.now()` ni `Math.random()` durante el render del server component (drift hidratación). Todas las fechas dinámicas pasan por `useEffect`.
- Imágenes con `<img loading="lazy">` evitan layout shift; reserva visual via `max-h-[420px] object-contain`.

---

## 7. Criterios de aceptación (DoD)

Un PR del módulo está "done" si:

- [ ] `npm run build` termina sin warnings (Sentry, Next, TS).
- [ ] Lint y type-check pasan en CI.
- [ ] Endpoints documentados responden HTTP 200/correcto en local + producción.
- [ ] Migración SQL aplicada en Supabase (verificada con `information_schema`).
- [ ] `predictions_log` y `bets` mantienen RLS activa.
- [ ] `revalidatePath` invocado en los puntos críticos.
- [ ] CodeRabbit pass (audit manual de Fase 3 si el bot está offline).
- [ ] PRD/Design/Tech docs actualizados si la spec cambió.
