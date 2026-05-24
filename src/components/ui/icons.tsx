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
