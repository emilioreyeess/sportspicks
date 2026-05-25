export interface NavItem { href: string; label: string; short: string; icon: string }

/** Navegación principal — barra inferior móvil (5 slots, Bot en el centro) */
export const NAV_MAIN: NavItem[] = [
  { href: "/",           label: "Inicio",       short: "Inicio", icon: "home" },
  { href: "/value",      label: "Value Picks",  short: "Value",  icon: "value" },
  { href: "/bot",        label: "Bot IA",       short: "Bot IA", icon: "bot" },
  { href: "/combinadas", label: "Combinadas",   short: "Combis", icon: "combinadas" },
  { href: "/stats",      label: "Estadísticas", short: "Stats",  icon: "stats" },
]

/** Navegación secundaria — sidebar y menú móvil */
export const NAV_MORE: NavItem[] = [
  { href: "/retos",            label: "Retos",          short: "Retos",   icon: "trophy" },
  { href: "/world-cup-2026",   label: "Mundial 2026 🏆", short: "Mundial", icon: "worldcup" },
  { href: "/pricing",          label: "Planes premium", short: "Planes",  icon: "crown" },
  { href: "/account",          label: "Mi cuenta",      short: "Cuenta",  icon: "user" },
  { href: "/about",            label: "Sobre nosotros", short: "Info",    icon: "shield" },
]

export function isActive(path: string | null, href: string): boolean {
  if (!path) return false
  return href === "/" ? path === "/" : path === href || path.startsWith(href + "/")
}
