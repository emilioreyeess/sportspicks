/**
 * Accesos manuales de plan — SportsPicks Analytics
 *
 * Emails con plan garantizado independientemente de Stripe.
 * Usado para: fundadores, beta testers, acceso de cortesía.
 *
 * Para añadir/quitar un email: editar este archivo y hacer push.
 * Los cambios se aplican en el siguiente deploy automático de Vercel.
 *
 * Formato: { email (lowercase): "premium" | "pro" }
 */

export type GrantedPlan = "premium" | "pro"

const GRANTS: Record<string, GrantedPlan> = {
  // ─── Equipo fundador ─────────────────────────────────────────────────────
  "emilioreyescabrera@gmail.com":         "pro",

  // ─── Beta testers / acceso cortesía ──────────────────────────────────────
  "alejandrorodriguezfleitas@gmail.com":  "pro",
  "alejandrofleitasbjj@gmail.com":        "pro",
  "pablo.alborss@gmail.com":              "pro",
  "samuha158@gmail.com":                  "pro",
  "cabreraalemana@gmail.com":             "pro",
}

/**
 * Devuelve el plan concedido manualmente para un email dado.
 * Retorna null si el email no tiene grant → usar Stripe como fuente de verdad.
 */
export function getGrantedPlan(email: string): GrantedPlan | null {
  return GRANTS[email.trim().toLowerCase()] ?? null
}
