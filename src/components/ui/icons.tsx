import type { ReactNode } from "react"

const PATHS: Record<string, ReactNode> = {
  home: <><path d="M3 10.75 12 3l9 7.75" /><path d="M5 9.5V21h14V9.5" /><path d="M9.5 21v-6h5v6" /></>,
  value: <><path d="M6 3h12l3 6-9 12L3 9z" /><path d="M3 9h18" /><path d="M9 3 6 9l6 12 6-12-3-6" /></>,
  bot: <><path d="M12 3.5 13.6 9 19 10.6 13.6 12.2 12 17.6 10.4 12.2 5 10.6 10.4 9z" /><path d="M18.5 3.5v3M20 5h-3" /></>,
  combinadas: <><path d="m12 3 9 5-9 5-9-5 9-5z" /><path d="m3 12 9 5 9-5" /><path d="m3 16 9 5 9-5" /></>,
  stats: <><path d="M5 21V11M12 21V4M19 21v-6" /><path d="M3 21h18" /></>,
  trophy: <><path d="M7 4h10v5a5 5 0 0 1-10 0V4z" /><path d="M7 6.5H4.5V8a3 3 0 0 0 3 3M17 6.5h2.5V8a3 3 0 0 1-3 3" /><path d="M9.5 18h5M12 14v4M8.5 21h7" /></>,
  crown: <><path d="M3 8.5 7.5 13 12 5l4.5 8L21 8.5V18H3z" /><path d="M3 21h18" /></>,
  user: <><circle cx="12" cy="8" r="3.6" /><path d="M5.5 20.5a6.5 6.5 0 0 1 13 0" /></>,
  menu: <><path d="M3 6h18M3 12h18M3 18h18" /></>,
  close: <><path d="M6 6l12 12M18 6 6 18" /></>,
  lock: <><rect x="4" y="10" width="16" height="10.5" rx="2.2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  check: <><path d="M5 12.5 10 17.5 19.5 6.5" /></>,
  arrowRight: <><path d="M5 12h13M12 5.5 18.5 12 12 18.5" /></>,
  bell: <><path d="M6 9.5a6 6 0 0 1 12 0c0 5.5 2 7 2 7H4s2-1.5 2-7z" /><path d="M10 20a2.4 2.4 0 0 0 4 0" /></>,
  settings: <><circle cx="12" cy="12" r="3.2" /><path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18 6 16 8M8 16l-2 2M18 18l-2-2M8 8 6 6" /></>,
  shield: <><path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6z" /><path d="m9 12 2 2 4-4" /></>,
  spark: <><path d="M12 4 13.4 9 18 10.4 13.4 11.8 12 16.8 10.6 11.8 6 10.4 10.6 9z" /></>,
  chevronDown: <><path d="M6 9l6 6 6-6" /></>,
  chevronUp: <><path d="M18 15l-6-6-6 6" /></>,
  worldcup: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3a13 13 0 0 1 0 18M12 3a13 13 0 0 0 0 18" /></>,
  // Copa del mundo 2026 — cáliz con asas y base
  wc2026: <><path d="M8 2h8" /><path d="M9 2v3c0 3.3 2.7 6 3 6s3-2.7 3-6V2" /><path d="M6 2v1c0 1.1.4 2.1 1 2.9" /><path d="M18 2v1c0 1.1-.4 2.1-1 2.9" /><path d="M12 11v4" /><path d="M9 15h6" /><path d="M8 15c0 2.2.9 4 2 4h4c1.1 0 2-1.8 2-4" /><path d="M7 19h10" /></>,
  flame: <><path d="M12 3c1.5 3 4 5 4 8a4 4 0 0 1-8 0c0-1.6.7-2.5 1.5-3.5C10.5 6.5 12 5 12 3z" /><path d="M12 11.5c1 1.4 2 2.4 2 4a2.5 2.5 0 0 1-5 0c0-1.2.6-2 1.5-3" /></>,
  whistle: <><circle cx="9" cy="13" r="5" /><path d="M14 13l6-3M14 13l6 3" /></>,
  cards: <><rect x="4" y="3.5" width="8" height="11.5" rx="1.2" /><rect x="9" y="6.5" width="9.5" height="14" rx="1.2" /></>,
  alert:   <><path d="M12 3 22 20H2z" /><path d="M12 10v4M12 17.5v.01" /></>,
  warning: <><path d="M12 3 22 20H2z" /><path d="M12 10v4M12 17.5v.01" /></>,
  info:    <><circle cx="12" cy="12" r="9" /><path d="M12 8v.01M12 11v5" /></>,
  eye:     <><ellipse cx="12" cy="12" rx="9" ry="6" /><circle cx="12" cy="12" r="2.5" /></>,
  copy:    <><rect x="9" y="9" width="11" height="11" rx="1.5" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>,
  external: <><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><path d="M15 3h6v6M10 14 21 3" /></>,
  plus:    <><path d="M12 5v14M5 12h14" /></>,
  trash:   <><path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /></>,
  logout:  <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></>,
  mail:    <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m2 7 10 8 10-8" /></>,
  edit:    <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z" /></>,
  download:<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5M12 15V3" /></>,
  groups:  <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  star:    <><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></>,
  image:   <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></>,
  gift:    <><polyline points="20 12 20 22 4 22 4 12" /><rect x="2" y="7" width="20" height="5" /><path d="M12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" /></>,
  ticket:  <><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" /><path d="M13 5v2M13 17v2M13 11v2" /></>,
  leaderboard: <><path d="M8 6h4" /><path d="M6 12h8" /><path d="M4 18h12" /><path d="M20 4v16" /></>,
  twitter: <><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.7 5.5 4.4 9 4.5-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.7z" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  refresh: <><path d="M21 12a9 9 0 1 1-2.6-6.4M21 4v4h-4" /></>,
  activity: <><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></>,
}

export function Icon({ name, className = "w-5 h-5", strokeWidth = 1.8 }: {
  name: string; className?: string; strokeWidth?: number
}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden="true">
      {PATHS[name] ?? null}
    </svg>
  )
}
