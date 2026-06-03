# Design Doc — Histórico extendido + OCR de boleto

**Módulo**: `history-and-vision`
**Sistema de diseño**: SportsPicks "Apple-like" minimal (zinc-950 base, paleta desaturada)

---

## 1. Principios

- **Whitespace primero**: padding generoso (`px-5 sm:px-6 py-5/6`), gap holgado entre secciones (`space-y-6/7`).
- **Borderless cards**: `bg-zinc-900/40` o `bg-zinc-900/55 border border-white/[0.05]` con `rounded-2xl` / `rounded-3xl`. Nada de borders duros.
- **Tipografía**: Inter, peso `bold` (no `black`) para títulos, `font-semibold` para etiquetas, `tracking-tight` en displays.
- **Color con propósito**: emerald = ganador, rose = perdedor, amber = pendiente/revisar, zinc = neutral. Saturación 10-15%.
- **Modales/popovers** con backdrop sólido: `bg-zinc-900/95 backdrop-blur-2xl z-30+` — el texto nunca colisiona con la página.

---

## 2. Wireframe — `/historico`

```
┌─────────────────────────────────────────────────────────┐
│  ◆ Histórico                                            │
│  Todos los picks del modelo, agrupados por día.         │
│  Resultados verificados contra ESPN.                    │
│                                                         │
│  ┌──────────┬──────────┬──────────┐                     │
│  │ 57.14%   │  12      │  9       │  ← hero stats (3)   │
│  │ ACIERTOS │ VERDES   │ ROJOS    │                     │
│  └──────────┴──────────┴──────────┘                     │
│  ┌─────────────────────────────────┐                    │
│  │ ROI +14.5%        Cuota @2.28   │  ← ROI + odd media │
│  └─────────────────────────────────┘                    │
│                                                         │
│  Domingo, 1 de junio       3W·0L · 100%                 │
│  ┌─────────────────────────────────┐                    │
│  │ ● Remo vs São Paulo        WIN  │                    │
│  │   Home  @3.05  IA 47%  1–0      │                    │
│  ├─────────────────────────────────┤                    │
│  │ ● O'Higgins vs Everton CD  WIN  │                    │
│  │   …  @1.95  IA 66%  2–3         │                    │
│  ├─────────────────────────────────┤                    │
│  │ ● Cruzeiro vs Fluminense   WIN  │                    │
│  └─────────────────────────────────┘                    │
│                                                         │
│  Sábado, 31 de mayo       …                             │
│  ┌─────────────────────────────────┐                    │
│  │ …                                │                   │
│  └─────────────────────────────────┘                    │
│                                                         │
│              [ Cargar más ]                             │
│                                                         │
│  Mis apuestas recientes                  Ver todas →    │
│  ┌─────────────────────────────────┐                    │
│  │ Combinada La Liga    [ revisar ]│                    │
│  │ 10€ × @4.26  +32.60€    Ganada ▼│  ← click expande   │
│  └─────────────────────────────────┘                    │
└─────────────────────────────────────────────────────────┘
```

### Hero stats

- 3 cards en grid `grid-cols-3 gap-3`, una con winrate (color condicional: emerald si ≥50%, amber si <50%), dos secundarias con conteos.
- Card secundaria full-width debajo con `ROI a 1u/pick` (signo) y cuota media.
- Display `text-[28px] sm:text-[32px] font-bold tracking-tight leading-none`, etiqueta `text-[11px] font-semibold uppercase tracking-wide text-zinc-400` con margen `mt-3`.

### Día (DaySection)

- Encabezado: título "Lunes, 1 de junio" con `text-[14px] font-semibold` + métricas inline derecha (`3W · 1L · 75%`).
- Picks dentro de `Card` con divisores sutiles `border-b border-white/[0.04]`.
- `PickRow`: dot 2×2 con color del resultado, partido en negrita, fila secundaria con selección + cuota + prob IA + marcador. Chip pill a la derecha con `WIN`/`LOSS`/`VOID`.

### BetCard expandible (apuestas personales)

Estado **colapsado**:

```
┌──────────────────────────────────────────────┐
│ Combinada La Liga · 4 selecciones [ revisar ]│
│ 10€ × @4.26   +32.60€   📷 boleto      ▼     │
│                                  [Ganada]    │
└──────────────────────────────────────────────┘
```

Estado **expandido**:

```
┌──────────────────────────────────────────────┐
│ Combinada La Liga                       ▲    │
│ 10€ × @4.26   +32.60€            [Ganada]    │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ Real Madrid vs Betis                   │  │
│  │ 1X2 · Gana Real Madrid    @1.50  WIN   │  │
│  ├────────────────────────────────────────┤  │
│  │ PSG vs Lyon                            │  │
│  │ Over/Under · Over 2.5     @1.85  WIN   │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  Notas del usuario (si las hay)              │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │  CAPTURA DEL BOLETO                    │  │
│  │  [imagen embebida — max-h 420px]       │  │
│  │  Extracción IA · confianza 78%         │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

- Click en el row colapsado → toggle estado (animación `animate-fade-in`).
- Si `bet_legs` vacío y sin imagen y sin notas → el card NO es expandible (sin chevron).
- Badge `revisar` solo si `needs_review = true`, ámbar, prominente.
- Cada leg con su propio estado (`pending`/`won`/`lost`/`void`) y su chip.

---

## 3. Wireframe — flujo de subida de boleto (`/bets`)

```
Subir boleto (botón principal)
        │
        ▼
   [ selector imagen ]
        │
        ▼
   POST /api/bets/auto-extract  ── loading spinner ──
        │
   ┌────┴──────────────────┐
   │                       │
   ▼ confidence ≥ 0.7      ▼ confidence < 0.7
   ┌─────────────────┐     ┌──────────────────────┐
   │ Apuesta creada  │     │ ⚠️  Necesita revisión │
   │ y publicada     │     │                       │
   │                 │     │ Confianza: 58%        │
   │ [Ir al detalle] │     │ Problemas detectados: │
   └─────────────────┘     │ • stake no detectado  │
                           │ • 2 legs placeholder  │
                           │                       │
                           │ [Editar manualmente]  │
                           │ [Publicar igualmente] │
                           └──────────────────────┘
```

Tarjeta de error / revisión:
- Card `border border-amber-700/40 bg-amber-500/[0.06]`, esquinas `rounded-2xl`.
- Lista de `reasons` con bullets discretos.
- Dos CTAs: `secondary` para editar manual, `ghost` para publicar tal cual (si el usuario sabe lo que hace).

---

## 4. Componentes reutilizables

| Componente             | Origen                              | Uso aquí                            |
|------------------------|-------------------------------------|-------------------------------------|
| `PageHeader`           | `ui/primitives`                     | Cabecera de `/historico`            |
| `Card`                 | `ui/primitives` (variant=default)   | Wrapper de cada DaySection + BetCard|
| `Button`               | `ui/primitives`                     | "Cargar más", CTAs                  |
| `Spinner`              | `ui/primitives`                     | Sentinel + uploading                |
| `EmptyState`           | `ui/primitives`                     | Sin picks resueltos / sin apuestas  |
| `Badge`                | `ui/primitives`                     | Chips de estado                     |
| `Icon`                 | `ui/icons`                          | activity, image, alert, chevron     |

Nada nuevo a crear — el módulo reutiliza el design system existente.

---

## 5. Estados y transiciones de UI

| Estado            | Visual                                              |
|-------------------|-----------------------------------------------------|
| Cargando primera página | 2 skeletons de día con `animate-pulse`         |
| Sin datos         | `EmptyState` con icono activity + CTA `/value`      |
| Lista poblada     | Days + sentinel `IntersectionObserver`              |
| Cargando más      | `Spinner` en sentinel                               |
| Fin del histórico | `Fin del histórico.` en texto fino                  |
| Error de red      | Degrada a respuesta vacía (no rompe la UI)          |

---

## 6. Accesibilidad

- Cards expandibles renderizadas como `<button>` con `aria-expanded`.
- Resultado del pick: chip + dot de color (no solo color — el chip lleva texto).
- Imagen del boleto con `alt="Boleto"`, `loading="lazy"`.
- Foco visible: `:focus-visible` heredado de global styles.
- Tap targets ≥ 44 px en mobile (botones con `h-10`/`h-12`).

---

## 7. Performance budget

| Recurso                       | Presupuesto    |
|-------------------------------|----------------|
| Tamaño bundle `/historico`    | ≤ 12 KB        |
| First Load JS                 | ≤ 210 KB       |
| Imagen boleto en card         | `loading=lazy` |
| Fetch inicial `/api/picks/history` | 1 RTT     |
| Fetch incremental             | Solo al ver sentinel |
