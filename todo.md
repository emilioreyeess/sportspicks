# TODO — Módulo Histórico + OCR (Fase 2)

> **Reglas de ejecución**: una tarea por commit. Marco `[x]` cuando se termina y hago `git commit` local. **No paso a la siguiente sin tu OK.**

---

## ⚠️ Reglas técnicas innegociables (Fase 0 — vigentes en todo el módulo)

- **R1 — Stake**: si el OCR no extrae stake o `confidence < 0.7`, el campo `stake` se persiste como **`NULL`** (no `0`, no default). `needs_review = true` y `is_published = false` hasta que el usuario lo complete manualmente. La UI debe mostrar el campo vacío con error y bloquear "Publicar" mientras `stake IS NULL`. **Cero valores por defecto en ingesta.**
- **R2 — Selecciones**: para partidos con `context IN ('international_friendly','international_competitive')` no se renderiza `<img src=ESPN_LOGO>` (las APIs públicas no tienen logos fiables de selección). En su lugar, **bandera emoji** o **sigla FIFA tipográfica** (e.g. `ESP`). Cero `<img>` rotas, cero placeholders genéricos.

---

## Tareas (orden secuencial — una por commit)

### Bloque A · Stake null-safe (R1)

- [x] **A1.** Verificar en Supabase que `bets.stake` admite `NULL`. Si no, aplicar `ALTER TABLE bets ALTER COLUMN stake DROP NOT NULL;`. Migración idempotente en `src/lib/supabase/bets-stake-nullable-migration.sql`. _(SQL + verificación con `information_schema`)_ — **HECHO**: era nullable pero tenía `DEFAULT 0` (violaba R1). Aplicado `DROP DEFAULT` en `stake` y `potential_return`. Verificado: ambos `nullable=YES, default=NULL`.
- [x] **A2.** `src/app/api/bets/auto-extract/route.ts`: reemplazar `stake: cleanBet.totalStake ?? 0` por `stake: cleanBet.totalStake` (que ya viene `null` si la extracción no detectó). Recalcular `potential_return` como `stake != null ? stake * combined_odds : null`. Añadir test inline: si Vision devuelve `totalStake: null`, el row debe quedar con `stake IS NULL` y `needs_review = true`. — **HECHO**: `stakeValue: number|null` (sin fallback a 0), validación cruzada obligatoria `needsReview = confidence<0.7 || stakeValue===null || combinedOdds==null`, `potentialReturn` null si stake null, `betPayload` tipado explícito con `stake/potential_return: number|null`. `tsc --noEmit` y `npm run build` limpios.
- [x] **A3.** ~~`src/app/api/bets/route.ts` (POST manual): añadir validación de coherencia — si `body.stake == null` o `0`, el bet entra con `needs_review = true`~~ **CORREGIDO POR DIRECTIVA**: el comportamiento NO es simétrico. `needs_review` es exclusivo del rescate OCR. La entrada MANUAL (humano rellenando form) con stake null/undefined/<=0 se RECHAZA con HTTP 400 (`"Validation Error: Stake is required and must be greater than 0"`) vía `NextResponse`. No se crea borrador. Tapado el agujero `Number(null)=0`. Constante `MIN_STAKE_MANUAL=0.01`. INSERT manual no setea needs_review (default false). `tsc` + build limpios.
- [x] **A4.** Actualizar `prd.md` sección "Estados de una apuesta" con la regla R1 documentada como invariante. — **HECHO** + ampliado por directiva full-stack: `prd.md` ahora tiene tabla de asimetría OCR (rescate `needs_review`) vs Manual (rechazo 400) + implicaciones UX para la UI. `tech_rules.md` sección "Contrato de la API — stake" con tabla por endpoint, detalles del guard `Number(null)`, tipado `number|null`. **Bloque A cerrado.**

### Bloque B · Selecciones sin escudos rotos (R2)

- [x] **B1.** Crear helper `src/lib/teams/crest.ts` + componente `src/components/teams/TeamCrest.tsx`. — **HECHO** (fusionado por directiva):
  - `crest.ts`: `getTeamCrest(name) → { code, emoji, initials }` usando `inferTeamCode` + `WC_TEAMS_BY_CODE`; `deriveInitials()` ("Real Madrid"→"RM", "Arsenal"→"ARS"); `isInternationalSlug()` vía `getMatchContext`.
  - `TeamCrest.tsx` (client): props **`teamName`, `logoUrl: string|null`, `isInternational: boolean`, `size`**. Interceptación: `isInternational===true` → ignora logoUrl, fallback bandera/siglas. Club con logo → `<img>` + `onError` que cae al fallback. Estética: circular `rounded-full`, `bg-white/5 border-white/10`, siglas `text-xs font-medium text-white/70`. `tsc --noEmit` exit 0, build limpio.
- [x] **B2.** ~~Crear componente TeamCrest~~ — **fusionado en B1** por directiva del usuario.
- [ ] **B3.** Reemplazar `<img src=match.home_logo>` y `<img src=match.away_logo>` en `src/components/matches/TodayMatches.tsx:MatchCard` por `<TeamCrest>`. Pasar `context` desde el `league` slug. Smoke test: cargar `/` con un amistoso en feed → no rota.
- [ ] **B4.** En `src/app/historico/page.tsx:PickRow`, añadir avatar con `<TeamCrest>` al lado del partido (hoy solo hay nombre). Solo cuando el pick tiene `home_team`/`away_team` con código reconocible. No romper layout en mobile.
- [ ] **B5.** En `BetCard` expandido (mismo archivo), si cualquier `bet_legs.match` matchea una selección conocida → mostrar bandera + sigla a la izquierda del leg. Si es club o desconocido, el row mantiene su layout actual.

### Bloque C · Lazy Refresh On-Read en /historico (GAP CRÍTICO — rescate del cron diario)

> **Por qué**: Vercel Hobby permite 1 ejecución de cron/día. Sin un mecanismo de rescate, un partido que termina a las 21:00 quedaría "Pendiente" hasta el siguiente `ml-settle`. Este bloque garantiza que cualquier visita a `/historico` (o `/value`) liquide los pendientes vencidos en el momento.
>
> **Estado base**: `maybeLazyRefresh()` se introdujo en `4cdf33d` dentro de `/api/picks/history`. Estas tareas lo **auditan, endurecen y verifican** — no se reimplementa desde cero salvo que la auditoría revele que falta cobertura.

- [ ] **C1.** Auditar `src/app/api/picks/history/route.ts:maybeLazyRefresh()`: confirmar que (a) detecta `status='pending' AND source='value_pick' AND kickoff_iso < now-130min`, (b) el margen de 130 min cubre la duración real de un partido (90' + descanso + añadido + buffer), (c) el throttle in-memory de 5 min funciona por instancia. Documentar hallazgos sin escribir todavía.
- [ ] **C2.** Endurecer el detector de "match_time pasado": parametrizar el margen como constante `MATCH_SETTLE_MARGIN_MIN = 130` con comentario justificando el valor (fútbol: 90'+15' descanso+~10' añadido+15' buffer = ~130'). Asegurar que la comparación es estrictamente UTC (`new Date(now - margin*60_000).toISOString()`).
- [ ] **C3.** Garantizar que la liquidación bajo demanda dispara **antes de renderizar**: confirmar `await maybeLazyRefresh()` precede a la lectura del RPC en el handler, y que tras liquidar invoca `revalidatePath('/historico')` + `revalidatePath('/value')` para que el render del cliente vea el dato fresco en el mismo ciclo.
- [ ] **C4.** Añadir guarda de coste: pre-check con `count(head:true)` de pendings vencidos ANTES de invocar `settleGroundTruth()` (que escanea hasta 80 filas + fetch ESPN). Si `count === 0`, retornar sin tocar ESPN. _(Verificar que ya existe en `4cdf33d`; si no, añadir.)_
- [ ] **C5.** Replicar el rescate en la superficie `/value`: confirmar que `/api/picks/yesterday` (o el endpoint que alimenta la vista de hoy/ayer) tiene su propio `refreshYesterdayPicks()` con throttle. Documentar que ambas superficies (`/historico` vía `predictions_log`, `/value` vía KV snapshot) tienen rescate independiente.
- [ ] **C6.** Smoke test del rescate: insertar en Supabase un pick `status='pending'`, `source='value_pick'`, `kickoff_iso` hace 3h, de un partido ya finalizado en ESPN. Llamar `GET /api/picks/history` y verificar que pasa a `won`/`lost` en la misma respuesta (o en la inmediata tras revalidate). Limpiar el row de prueba.

### Bloque D · UI cableado del OCR auto-extract en /bets

- [ ] **D1.** Auditar `src/app/bets/page.tsx`: localizar el botón actual de subida de boleto y entender el flujo manual existente. Sin escribir aún.
- [ ] **D2.** Añadir botón "Auto-registrar boleto" (variant=premium) que llama a `POST /api/bets/auto-extract` directamente con `FormData(file)`. Estados: idle → uploading → success/needs_review/error. Spinner durante upload.
- [ ] **D3.** Tras respuesta `201`: si `review.needsReview === false` → toast "Apuesta registrada" + scroll a la nueva tarjeta. Si `needsReview === true` → abrir editor visual (tarea E1).
- [ ] **D4.** El flujo manual antiguo (`/api/tipster/extract-bet` + form local) queda como **fallback** accesible desde un secundario `Subir manualmente`. No se borra (compatibilidad).

### Bloque E · Editor visual "Necesita revisión"

- [ ] **E1.** Crear `src/components/bets/ReviewEditor.tsx` (client, Modal de primitives):
  - Props: `{ bet: { id, title, stake|null, combined_odds, legs[] }; reasons: string[]; onSaved: (bet) => void; onClose: () => void }`.
  - Form pre-rellenado con datos OCR. **Stake con campo vacío si era `null`**, marcado required con icono de alerta inline.
  - Lista de `reasons` arriba en `Alert tone="warning"` (ej. "stake no detectado", "2 cuotas son placeholder").
  - Edita stake + cada leg (match/market/selection/odds).
  - CTAs: `Guardar borrador` (sin publicar), `Guardar y publicar` (solo habilitado si `stake != null && stake > 0`).
- [ ] **E2.** Añadir `PATCH /api/bets/[id]` que acepte `{ stake, combined_odds, is_published, legs[] }`. Auth + ownership check + validación. Si todos los campos quedan completos, permitir set `needs_review = false`. Si `is_published` se intenta poner `true` con `stake == null` → 422.
- [ ] **E3.** Reutilizar `ReviewEditor` desde `BetCard` con CTA "Revisar" (visible solo si `needs_review = true`).

### Bloque F · Verificación + docs

- [ ] **F1.** Smoke tests locales: cargar `/historico`, `/bets`, subir boleto de prueba al endpoint, verificar `bets` y `bet_legs` en Supabase via MCP.
- [ ] **F2.** `npm run build` debe terminar **0 warnings**. Tipos TS estrictos.
- [ ] **F3.** Actualizar `tech_rules.md` sección 3 (RLS y seguridad) con la matriz: stake null + needs_review + is_published; añadir nota R2 en sección "Manejo de nulos" + documentar el margen `MATCH_SETTLE_MARGIN_MIN` en sección 4 (caché/timezone).
- [ ] **F4.** Actualizar `design_doc.md` con wireframe del `ReviewEditor` y del `TeamCrest` (fallback tipográfico).

### Bloque G · Pipeline CodeRabbit (Fase 3 — audit preventivo)

- [ ] **G1.** Auditoría fugas de memoria: revisar listeners (`IntersectionObserver` cleanup, `addEventListener('consent-granted')`), fetchs sin abort, refs huérfanas.
- [ ] **G2.** Tipos TS estrictos: barrido de `any` y `as any` introducidos por el módulo. Justificar cada uno o eliminar.
- [ ] **G3.** Hidratación Next: confirmar que ningún server component usa `Date.now()` o `Math.random()` durante el render; transiciones a `useEffect` donde aplique.
- [ ] **G4.** Seguridad queries Supabase: confirmar que toda escritura pasa por service-role server-side, no hay `from('bets').update()` con anon, RLS sigue activa.
- [ ] **G5.** Manejo de excepciones: cada `await` de red o DB envuelto en try/catch o `.catch(...)`. Mensajes al cliente genéricos (CN-026), detalles en `console.error` server-side.
- [ ] **G6.** Generar `coderabbit-audit.md` con hallazgos + diff de fixes propuestos. Si todo limpio, marcar "module closed".

---

## Estado de tareas previas (ya en producción — NO se re-implementan)

Estas se completaron en commits `1bf2258`, `d3e39ac`, `4cdf33d`. Solo se listan como referencia para no duplicar trabajo:

- [x] RPCs `get_picks_global_stats` + `get_picks_history_page` (con `p_source` filter)
- [x] Endpoints `/api/picks/stats` + `/api/picks/history` con degradación graceful
- [x] UI `/historico` Apple-like con hero stats + timeline agrupada por día + scroll infinito
- [x] Pipeline diario loguea value picks a `predictions_log` con `source='value_pick'`
- [x] Migraciones SQL: `intl-context-migration`, `picks-history-rpc`, `picks-source-migration`, `bets-ocr-migration` (aplicadas)
- [x] Cron `ml-settle` con `revalidatePath` + `revalidateTag`
- [x] Lazy refresh on-read en `/api/picks/history` (throttle 5min/instancia)
- [x] `BetCard` expandible con bet_legs + imagen + badge `needs_review`
- [x] Endpoint `POST /api/bets/auto-extract` con Claude Vision + INSERT + `scoreExtraction()` + cleanup de imagen huérfana

---

## Convenciones

- Cada tarea = un `git commit` local con mensaje `feat|fix(scope): descripción atómica` + nota `Co-Authored-By`.
- Verificación posterior a cada commit: el build debe seguir limpio (`npm run build` 0 warnings).
- Si una tarea descubre un sub-problema bloqueante, **paro y pregunto** — no creo sub-tareas inventadas.
- Nada se sube a `origin` hasta que cierres el módulo y autorices el deploy.
