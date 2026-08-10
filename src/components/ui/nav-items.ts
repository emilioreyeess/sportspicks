export interface NavItem { href: string; label: string; short: string; icon: string }

/**
 * Mundial 2026 ARCHIVADO tras la final (19-jul-2026). Poner a `true` para
 * reactivar el hub en la navegación cuando vuelva a haber torneo.
 * NADA se borra: la ruta /world-cup-2026 y todos sus componentes siguen vivos y
 * accesibles por URL directa; esto solo controla su visibilidad en los menús.
 */
export const WORLD_CUP_ACTIVE: boolean = false

/**
 * Navegación principal de la sección "Plataforma" (sidebar).
 * La barra inferior móvil (BottomNav) usa esta lista PERO filtra `/partidos`
 * para mantener 5 slots con Bot en el centro — ver BottomNav.tsx.
 * Inicio: accesible tocando el nombre/logo en el TopBar.
 */
const NAV_MAIN_ALL: NavItem[] = [
  { href: "/value",          label: "Value Picks",  short: "Value",   icon: "value"    },
  { href: "/partidos",       label: "Partidos",     short: "Partidos", icon: "calendar" },
  { href: "/combinadas",     label: "Combinadas",   short: "Combinadas",  icon: "combinadas" },
  { href: "/bot",            label: "Bot IA",       short: "Bot IA",  icon: "bot"      },
  { href: "/retos",          label: "Retos",        short: "Retos",   icon: "trophy"   },
  { href: "/world-cup-2026", label: "Mundial 2026", short: "Mundial", icon: "wc2026"   },
]

/** Sidebar y MobileDrawer consumen esto → heredan el filtro automáticamente. */
export const NAV_MAIN: NavItem[] = NAV_MAIN_ALL.filter(
  (i) => WORLD_CUP_ACTIVE || i.href !== "/world-cup-2026",
)

/** Navegación secundaria — sidebar y menú móvil drawer */
export const NAV_MORE: NavItem[] = [
  { href: "/",          label: "Inicio",          short: "Inicio",   icon: "home"    },
  { href: "/groups",    label: "Grupos",           short: "Grupos",   icon: "groups"  },
  { href: "/bets",      label: "Mis Apuestas",     short: "Apuesta",  icon: "ticket"  },
  { href: "/historico", label: "Histórico",        short: "Histor.",  icon: "star"    },
  { href: "/stats",     label: "Estadísticas",     short: "Stats",    icon: "stats"   },
  { href: "/pricing",   label: "Planes premium",   short: "Planes",   icon: "crown"   },
  { href: "/account",   label: "Mi cuenta",        short: "Cuenta",   icon: "user"    },
  { href: "/about",     label: "Sobre nosotros",   short: "Info",     icon: "shield"  },
]

export function isActive(path: string | null, href: string): boolean {
  if (!path) return false
  return href === "/" ? path === "/" : path === href || path.startsWith(href + "/")
}
