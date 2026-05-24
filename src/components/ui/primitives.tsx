import Link from "next/link"
import type { ReactNode } from "react"
import { Icon } from "@/components/ui/icons"

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ")
}

/* ─── Card ────────────────────────────────────────────────────────────────── */
export function Card({ children, className, glow, hover }: {
  children: ReactNode; className?: string; glow?: boolean; hover?: boolean
}) {
  return (
    <div className={cx(
      "rounded-2xl border border-zinc-800 bg-zinc-900/80",
      glow && "shadow-[0_0_0_1px_rgba(52,211,153,0.12),0_8px_40px_-12px_rgba(52,211,153,0.18)]",
      hover && "card-glow transition-all cursor-pointer",
      className,
    )}>
      {children}
    </div>
  )
}

/* ─── Badge ───────────────────────────────────────────────────────────────── */
const BADGE_TONE: Record<string, string> = {
  emerald: "bg-emerald-500/12 text-emerald-400 border-emerald-700/50",
  amber:   "bg-amber-500/12 text-amber-400 border-amber-700/50",
  blue:    "bg-blue-500/12 text-blue-400 border-blue-700/50",
  violet:  "bg-violet-500/12 text-violet-400 border-violet-700/50",
  rose:    "bg-rose-500/12 text-rose-400 border-rose-700/50",
  zinc:    "bg-zinc-800 text-zinc-400 border-zinc-700",
}
export function Badge({ children, tone = "zinc", className }: {
  children: ReactNode; tone?: keyof typeof BADGE_TONE; className?: string
}) {
  return (
    <span className={cx(
      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
      BADGE_TONE[tone], className,
    )}>
      {children}
    </span>
  )
}

/* ─── Button ──────────────────────────────────────────────────────────────── */
const BTN_VARIANT: Record<string, string> = {
  primary:   "bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold",
  secondary: "bg-zinc-800 hover:bg-zinc-700 text-white font-semibold border border-zinc-700",
  ghost:     "bg-transparent hover:bg-zinc-800 text-zinc-300 font-medium",
  premium:   "bg-gradient-to-r from-emerald-500 to-cyan-500 hover:opacity-90 text-zinc-950 font-bold",
}
const BTN_SIZE: Record<string, string> = {
  sm: "px-3 py-1.5 text-xs rounded-lg",
  md: "px-4 py-2.5 text-sm rounded-xl",
  lg: "px-6 py-3.5 text-sm rounded-xl",
}
interface BtnProps {
  children: ReactNode
  variant?: keyof typeof BTN_VARIANT
  size?: keyof typeof BTN_SIZE
  href?: string
  onClick?: () => void
  disabled?: boolean
  className?: string
  full?: boolean
  type?: "button" | "submit"
}
export function Button({
  children, variant = "primary", size = "md", href, onClick, disabled, className, full, type = "button",
}: BtnProps) {
  const cls = cx(
    "inline-flex items-center justify-center gap-2 transition-all tap disabled:opacity-40 disabled:pointer-events-none",
    BTN_VARIANT[variant], BTN_SIZE[size], full && "w-full", className,
  )
  if (href) return <Link href={href} className={cls}>{children}</Link>
  return <button type={type} onClick={onClick} disabled={disabled} className={cls}>{children}</button>
}

/* ─── Skeleton ────────────────────────────────────────────────────────────── */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("skeleton rounded-xl", className)} />
}

/* ─── Page header ─────────────────────────────────────────────────────────── */
export function PageHeader({ icon, title, subtitle, action }: {
  icon?: string; title: string; subtitle?: string; action?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-5">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {icon && (
            <span className="grid place-items-center w-8 h-8 rounded-xl bg-zinc-800/80 text-emerald-400">
              <Icon name={icon} className="w-4.5 h-4.5" />
            </span>
          )}
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">{title}</h1>
        </div>
        {subtitle && <p className="text-sm text-zinc-500 mt-1 leading-snug">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

/* ─── Empty state ─────────────────────────────────────────────────────────── */
export function EmptyState({ emoji = "📭", title, hint, action }: {
  emoji?: string; title: string; hint?: string; action?: ReactNode
}) {
  return (
    <div className="text-center py-16 px-4 animate-fade-in">
      <p className="text-4xl mb-3">{emoji}</p>
      <p className="text-zinc-300 font-semibold">{title}</p>
      {hint && <p className="text-sm text-zinc-600 mt-1 max-w-sm mx-auto leading-snug">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/* ─── Spinner ─────────────────────────────────────────────────────────────── */
export function Spinner({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={cx("animate-spin text-emerald-400", className)} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.2" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
