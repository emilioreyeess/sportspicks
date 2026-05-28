export interface NavItem { href: string; label: string; short: string; icon: string }

/**
 * Navegación principal — barra inferior móvil (5 slots, Bot en el centro).
 * Inicio: accesible tocando el nombre/logo en el TopBar.
 * Estadísticas: en sidebar / menú móvil (NAV_MORE).
 */
export const NAV_MAIN: NavItem[] = [
  { href: "/value",          label: "Value Picks",  short: "Value",   icon: "value"    },
  { href: "/combinadas",     label: "Combinadas",   short: "Combinadas",  icon: "combinadas" },
  { href: "/bot",            label: "Bot IA",       short: "Bot IA",  icon: "bot"      },
  { href: "/retos",          label: "Retos",        short: "Retos",   icon: "trophy"   },
  { href: "/world-cup-2026", label: "Mundial 2026", short: "Mundial", icon: "wc2026"   },
]

/** Navegación secundaria — sidebar y menú móvil drawer */
export const NAV_MORE: NavItem[] = [
  { href: "/",        label: "Inicio",          short: "Inicio",  icon: "home"        },
  { href: "/groups",  label: "Grupos",          short: "Grupos",  icon: "groups"      },
  { href: "/forum",   label: "Foro",            short: "Foro",    icon: "groups"      },
  { href: "/bets",    label: "Mis Apuestas",    short: "Apuesta", icon: "ticket"      },
  { href: "/historico", label: "Histórico",       short: "Histor.", icon: "star"        },
  { href: "/stats",   label: "Estadísticas",    short: "Stats",   icon: "stats"       },
  { href: "/pricing", label: "Planes premium",  short: "Planes",  icon: "crown"       },
  { href: "/account", label: "Mi cuenta",       short: "Cuenta",  icon: "user"        },
  { href: "/about",   label: "Sobre nosotros",  short: "Info",    icon: "shield"      },
]

/** Nav item shown only to VIP tipsters — rendered conditionally by Sidebar */
export const TIPSTER_NAV_ITEM: NavItem = { href: "/tipster", label: "Creators", short: "Creators", icon: "star" }

export function isActive(path: string | null, href: string): boolean {
  if (!path) return false
  return href === "/" ? path === "/" : path === href || path.startsWith(href + "/")
}
