/**
 * Trustpilot review trigger — recolección de reseñas PASIVA y contextual.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Reglas:
 *  · NUNCA condiciona acceso a datos ni crea barreras (cero paywall por reseña).
 *  · Solo se muestra tras un HITO DE VALOR positivo:
 *      - ≥ 5 análisis de partido consultados, o
 *      - > 3 sesiones iniciadas en la misma semana ISO.
 *  · Si el usuario reseña o pulsa "Ahora no", no vuelve a molestar (15 días).
 *
 * Estado en localStorage (clave `sp_tp_review`). Todas las funciones son
 * no-op seguras en SSR (guard de `window`).
 */

const KEY = "sp_tp_review"
const DISMISS_DAYS = 15
const ANALYSIS_THRESHOLD = 5
const WEEKLY_SESSION_THRESHOLD = 3

export const TRUSTPILOT_URL = "https://es.trustpilot.com/review/sportspicks.es"

interface ReviewState {
  reviewed?: boolean
  dismissedUntil?: number   // epoch ms
  analysisCount?: number
  weekKey?: string          // semana ISO actual (YYYY-Www)
  weekSessions?: number
  sessionMarked?: boolean    // (no se persiste como sesión; ver recordSession)
}

function hasWindow(): boolean {
  return typeof window !== "undefined"
}

function read(): ReviewState {
  if (!hasWindow()) return {}
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as ReviewState
  } catch {
    return {}
  }
}

function write(s: ReviewState): void {
  if (!hasWindow()) return
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* quota — ignorar */ }
}

/** Semana ISO actual como "YYYY-Www" para contar sesiones por semana. */
function isoWeekKey(d = new Date()): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`
}

/** Registra la consulta de un análisis de partido (hito de valor). */
export function recordAnalysisView(): void {
  const s = read()
  s.analysisCount = (s.analysisCount ?? 0) + 1
  write(s)
}

/**
 * Registra UNA sesión por arranque de pestaña (guard en sessionStorage).
 * Cuenta sesiones dentro de la semana ISO actual; resetea al cambiar de semana.
 */
export function recordSession(): void {
  if (!hasWindow()) return
  try {
    if (sessionStorage.getItem("sp_tp_session") === "1") return
    sessionStorage.setItem("sp_tp_session", "1")
  } catch { /* sessionStorage no disponible → seguimos */ }

  const s = read()
  const wk = isoWeekKey()
  if (s.weekKey !== wk) { s.weekKey = wk; s.weekSessions = 0 }
  s.weekSessions = (s.weekSessions ?? 0) + 1
  write(s)
}

/** ¿Debe mostrarse el toast ahora? */
export function shouldShowReview(): boolean {
  const s = read()
  if (s.reviewed) return false
  if (s.dismissedUntil && Date.now() < s.dismissedUntil) return false

  const analysisHit = (s.analysisCount ?? 0) >= ANALYSIS_THRESHOLD
  const sessionHit = s.weekKey === isoWeekKey() && (s.weekSessions ?? 0) > WEEKLY_SESSION_THRESHOLD
  return analysisHit || sessionHit
}

/** El usuario pulsó "Ahora no": silenciar 15 días. */
export function dismissReview(days = DISMISS_DAYS): void {
  const s = read()
  s.dismissedUntil = Date.now() + days * 86400000
  write(s)
}

/** El usuario fue a Trustpilot: no volver a pedirlo. */
export function markReviewed(): void {
  const s = read()
  s.reviewed = true
  write(s)
}
