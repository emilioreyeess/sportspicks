# PRD — Automatización de Histórico e Ingesta por Visión Artificial

**Módulo**: `history-and-vision`
**Owner**: SportsPicks Analytics
**Versión**: 1.0
**Estado**: Implementación parcial en producción (commits hasta `4cdf33d`). Documento sirve de spec viva.

---

## 1. Propósito

Convertir el histórico de picks en una superficie autónoma y siempre actual, y eliminar la fricción del registro manual de apuestas mediante una extracción por visión artificial de capturas de boleto.

Dos problemas que motivan el módulo:

1. Los picks finalizados quedaban marcados como **"Pendiente"** durante horas porque el único cron de liquidación corre una vez al día (limitación del Hobby plan de Vercel).
2. Para registrar una apuesta personal, el usuario tenía que **transcribir manualmente** equipos, mercados y cuotas leyendo su propia captura — fricción alta y error humano.

---

## 2. Usuarios y escenarios

### Personas

| Persona             | Necesidad principal                                                |
|---------------------|---------------------------------------------------------------------|
| Free / Premium      | Ver el winrate global del modelo y el histórico día por día.        |
| Apostador habitual  | Subir captura del boleto y olvidarse — la app rellena todo.         |
| Admin               | Auditar qué se publica vs qué necesita revisión humana.             |

### Flujos críticos

#### Flujo A — Consultar histórico

1. Usuario abre `/historico`.
2. Ve **hero cards** arriba: aciertos globales (%), verdes, rojos, ROI, cuota media.
3. Debajo, **timeline cronológica** agrupada por día con divisor en español ("Lunes, 1 de junio") y stats per-day.
4. Scroll infinito: al acercarse al final, carga la siguiente página automáticamente.
5. Si tiene apuestas personales registradas, sección secundaria con `BetCard` expandible.

#### Flujo B — Liquidación automática post-partido

1. Pick generado por el pipeline diario entra en `predictions_log` con `status='pending'`, `source='value_pick'`.
2. Partido termina; ESPN marca el evento como `completed`.
3. **Camino A — cron**: `ml-settle` corre a las 03:00 UTC, `settleGroundTruth()` lee ESPN, hace UPDATE de `status` a `won`/`lost`/`void`, `revalidatePath('/historico'|'/value'|'/')`.
4. **Camino B — lazy refresh**: cualquier usuario que abra `/historico` antes del cron dispara `maybeLazyRefresh()` (throttled 5 min/instancia) que liquida los pending vencidos en el momento y purga caché.
5. Próxima recarga → el pick aparece con su chip verde/rojo y marcador final.

#### Flujo C — Ingesta por visión

1. Usuario abre `/bets`, pulsa "Subir boleto".
2. Selecciona imagen (≤ 5 MB, JPG/PNG/WebP/GIF).
3. Cliente hace `POST /api/bets/auto-extract` con `multipart/form-data`.
4. Servidor:
   - Auth NextAuth + rate limit (5 req/min/IP).
   - Sube imagen a Supabase Storage (`bet-images` bucket).
   - Llama Claude Vision con prompt anti-invención.
   - Calcula `ai_confidence` ∈ [0, 1] y `needs_review` (true si <0.7 o falta stake/cuota).
   - `INSERT` en `bets` + `bet_legs` en una sola operación lógica.
   - Si `is_published=false` mientras `needs_review=true`.
   - `revalidatePath('/historico'|'/bets')`.
5. Cliente recibe `{ bet, review: { needsReview, confidence, reasons } }` y navega al detalle.
6. Si `needs_review=true`, la UI muestra badge ámbar "revisar" y permite editar antes de publicar.

---

## 3. Lógica del OCR

### Prompt design (resumen)

El prompt instruye al modelo a devolver JSON estricto con esta estructura:

```json
{
  "title": "string",
  "sport": "football|basketball|tennis|baseball|hockey|other",
  "totalStake": 10.00 | null,
  "combinedOdds": 4.26 | null,
  "bookmaker": "Bet365 | …" | null,
  "legs": [
    { "match": "…", "market": "…|null", "selection": "…", "odds": 1.50 }
  ]
}
```

**Reglas anti-invención** (estrictas, en el prompt):

- Stake o cuota combinada no visibles → `null`. **Nunca inventar.**
- Cuotas individuales no legibles → `odds = 1.00` (placeholder marcado).
- Match ambiguo → escribir lo que se ve literalmente.
- Responder **solo** con JSON (sin markdown ni explicaciones).

### Scoring de confianza

`scoreExtraction()` en el endpoint calcula:

| Penalización                                  | Resta |
|-----------------------------------------------|-------|
| Título vacío o < 3 caracteres                 | 0.20  |
| Stake no detectado                            | 0.15  |
| Cuota combinada no detectada                  | 0.10  |
| Sin selecciones                               | 0.40  |
| Por cada leg con `odds == 1` (placeholder)    | 0.05  |
| Por cada leg sin selección                    | 0.10  |

Resultado clampeado a `[0, 1]`. Si `confidence < 0.7` → `needs_review = true`.

### Estados de una apuesta

```
pending           ─ apuesta registrada, sin resolución
won / lost / void ─ liquidada manualmente por el usuario
cashout           ─ retirada antes del cierre

needs_review=true ─ vino del OCR con confianza baja
ai_analyzed=true  ─ pasó por el pipeline de visión
is_published=true ─ visible públicamente (futuro: feed social)
```

---

### Invariante de negocio R1 — manejo del `stake` (a prueba de balas)

> **El `stake` jamás se inventa ni se rellena con un default.** Su ausencia se
> trata de forma RADICALMENTE distinta según el origen de la apuesta. Esta
> asimetría es intencional y debe respetarse en backend Y frontend.

| Dimensión              | Flujo OCR (visión artificial)                              | Flujo Manual (formulario humano)                           |
|------------------------|------------------------------------------------------------|------------------------------------------------------------|
| Origen                 | `POST /api/bets/auto-extract` (imagen → Claude Vision)     | `POST /api/bets` (humano rellena el form)                  |
| Stake ausente / `<= 0` | Se persiste `stake = NULL`. **Es esperado** — la IA puede no leer el importe. | **Error de usuario**. No hay nada que rescatar.            |
| Reacción del backend   | `needs_review = true` (forzado por validación cruzada) + `is_published = false`. El bet se guarda como **borrador de rescate**. | **Rechazo duro**: `HTTP 400 "Validation Error: Stake is required and must be greater than 0"`. **No se inserta nada**. |
| Confianza < 0.7        | También fuerza `needs_review = true`.                      | N/A (no hay scoring de confianza en entrada humana).       |
| Estado resultante      | Fila en `bets` con `stake NULL`, esperando edición visual. | Sin fila. El usuario corrige el formulario y reintenta.    |

**Experiencia de usuario (UX) — implicaciones para la UI:**

- **OCR**: tras subir el boleto, si la respuesta trae `review.needsReview === true`,
  la UI abre el **editor visual** con el campo `stake` **vacío y marcado como
  requerido** (icono de alerta). El botón "Publicar" permanece **deshabilitado**
  hasta que el usuario introduzca un stake `> 0`. Cero valores por defecto a la vista.
- **Manual**: el formulario debe validar en cliente `stake > 0` antes de enviar, y
  además **respetar el 400 del backend** mostrando el mensaje de error inline. El
  backend es la última línea de defensa — la validación de cliente es UX, no seguridad.

> **Razón de la asimetría**: `needs_review` es un mecanismo de **rescate del OCR**
> (la IA falló al leer una imagen → guardamos lo extraído para que el humano lo
> complete). En la entrada manual NO hay nada que rescatar: el humano tiene el dato
> delante, así que un stake ausente es simplemente un error de validación que se
> rechaza de inmediato. Usar `needs_review` para entrada manual generaría borradores
> basura indistinguibles de extracciones OCR legítimas.

---

## 4. Estados del histórico (picks del modelo)

```
status = 'pending'                  ← recién publicado, kickoff futuro
status = 'pending' + cutoff pasado  ← elegible para liquidación
status = 'won' | 'lost' | 'void'    ← resuelto contra ESPN
```

Source separa origen (filtro principal del feed):

| `source`         | Origen                                       | Aparece en `/historico` |
|------------------|----------------------------------------------|-------------------------|
| `value_pick`     | Pipeline diario publicó el pick              | Sí                      |
| `analysis_view`  | Usuario abrió el análisis de un partido      | No (alimenta ML loop)   |

---

## 5. Métricas de éxito

| Métrica                                      | Objetivo                  |
|----------------------------------------------|---------------------------|
| Latencia liquidación post-final ESPN         | ≤ 15 min (lazy refresh)   |
| Picks pending visibles tras 24h              | 0                         |
| Precisión OCR (extracción completa)          | ≥ 80% sin `needs_review`  |
| Tiempo de UI para `/historico` cold          | ≤ 1.2 s (P95)             |
| Llamadas a ESPN por instancia/min            | ≤ 1 (throttle protege)    |

---

## 6. Out of scope (no aborda este módulo)

- Editor visual para corregir manualmente una extracción `needs_review` (Fase 2).
- Liquidación automática de apuestas personales (`bets` table) contra ESPN — solo se liquidan picks del modelo.
- Notificaciones push cuando un pick cambia de estado.
- Feed social público de apuestas (requiere `is_published=true` flow, fuera de scope).
