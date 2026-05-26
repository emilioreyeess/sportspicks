import Link from "next/link"
import type { ReactNode, InputHTMLAttributes, TextareaHTMLAttributes } from "react"
import { useEffect, useRef } from "react"
import { Icon } from "@/components/ui/icons"

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ")
}

/* ═══════════════════════════════════════════════════════════════════════════
   CARD
   ═══════════════════════════════════════════════════════════════════════════ */
const CARD_VARIANT: Record<string, string> = {
  default:  "card-premium rounded-2xl border border-zinc-800/80 shadow-xl shadow-black/20",
  flat:     "bg-zinc-900/80 rounded-2xl border border-zinc-800/60",
  elevated: "card-premium rounded-2xl border border-zinc-800/60 shadow-dialog shadow-black/40",
  ghost:    "rounded-2xl",
  outline:  "rounded-2xl border border-zinc-700/60 bg-transparent",
}

export function Card({ children, className, glow, hover, variant = "default", onClick }: {
  children: ReactNode
  className?: string
  glow?: boolean
  hover?: boolean
  variant?: keyof typeof CARD_VARIANT
  onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={cx(
        CARD_VARIANT[variant],
        glow && "shadow-[0_0_0_1px_rgba(52,211,153,0.12),0_8px_40px_-12px_rgba(52,211,153,0.18)]",
        hover && "card-glow cursor-pointer hover:border-zinc-700/80 transition-all",
        onClick && "cursor-pointer",
        className,
      )}>
      {children}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   BADGE
   ═══════════════════════════════════════════════════════════════════════════ */
const BADGE_TONE: Record<string, string> = {
  emerald: "bg-emerald-500/15 text-emerald-300 border-emerald-700/60",
  amber:   "bg-amber-500/15   text-amber-300   border-amber-700/60",
  blue:    "bg-blue-500/15    text-blue-300    border-blue-700/60",
  violet:  "bg-violet-500/15  text-violet-300  border-violet-700/60",
  rose:    "bg-rose-500/15    text-rose-300    border-rose-700/60",
  cyan:    "bg-cyan-500/15    text-cyan-300    border-cyan-700/60",
  orange:  "bg-orange-500/15  text-orange-300  border-orange-700/60",
  zinc:    "bg-zinc-800/80    text-zinc-400    border-zinc-700/60",
}

export function Badge({ children, tone = "zinc", className, dot }: {
  children: ReactNode
  tone?: keyof typeof BADGE_TONE
  className?: string
  dot?: boolean
}) {
  return (
    <span className={cx(
      "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide",
      BADGE_TONE[tone], className,
    )}>
      {dot && <span className={cx(
        "h-1.5 w-1.5 rounded-full",
        tone === "emerald" ? "bg-emerald-400" :
        tone === "amber"   ? "bg-amber-400"   :
        tone === "blue"    ? "bg-blue-400"    :
        tone === "violet"  ? "bg-violet-400"  :
        tone === "rose"    ? "bg-rose-400"    :
        tone === "cyan"    ? "bg-cyan-400"    :
        tone === "orange"  ? "bg-orange-400"  :
        "bg-zinc-500"
      )} />}
      {children}
    </span>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   BUTTON
   ═══════════════════════════════════════════════════════════════════════════ */
const BTN_VARIANT: Record<string, string> = {
  primary:   "bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-zinc-950 font-black shadow-lg shadow-emerald-900/30 hover:shadow-emerald-900/50 hover:shadow-lg btn-glow-emerald",
  secondary: "bg-zinc-800/80 hover:bg-zinc-700 active:bg-zinc-800 text-white font-bold border border-zinc-700/80 hover:border-zinc-600 shadow-card",
  ghost:     "bg-transparent hover:bg-zinc-800/60 text-zinc-300 hover:text-white font-medium",
  danger:    "bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-black shadow-lg shadow-rose-900/30",
  premium:   "bg-gradient-to-r from-emerald-500 to-cyan-500 hover:opacity-90 active:opacity-80 text-zinc-950 font-black shadow-lg shadow-emerald-900/30 btn-glow-emerald",
  violet:    "bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-90 active:opacity-80 text-white font-black shadow-lg shadow-violet-900/30 btn-glow-violet",
  outline:   "bg-transparent border border-zinc-700/80 hover:bg-zinc-800/60 hover:border-zinc-600 text-zinc-300 hover:text-white font-medium",
}
const BTN_SIZE: Record<string, string> = {
  xs: "px-2.5 py-1    text-xs rounded-lg    h-7",
  sm: "px-3   py-1.5  text-xs rounded-lg    h-8",
  md: "px-4   py-2.5  text-sm rounded-xl    h-10",
  lg: "px-6   py-3    text-sm rounded-xl    h-12",
  xl: "px-8   py-3.5  text-base rounded-2xl h-14",
}

interface BtnProps {
  children: ReactNode
  variant?: keyof typeof BTN_VARIANT
  size?: keyof typeof BTN_SIZE
  href?: string
  onClick?: () => void
  disabled?: boolean
  loading?: boolean
  className?: string
  full?: boolean
  type?: "button" | "submit"
  iconLeft?: string
  iconRight?: string
}

export function Button({
  children, variant = "primary", size = "md", href, onClick,
  disabled, loading, className, full, type = "button", iconLeft, iconRight,
}: BtnProps) {
  const cls = cx(
    "relative inline-flex items-center justify-center gap-2 transition-all duration-150 tap",
    "disabled:opacity-40 disabled:pointer-events-none hover:scale-[1.02] active:scale-[0.97]",
    BTN_VARIANT[variant], BTN_SIZE[size],
    full && "w-full",
    className,
  )
  const content = (
    <>
      {loading && (
        <svg className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
          <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      )}
      <span className={cx("inline-flex items-center gap-2", loading && "invisible")}>
        {iconLeft  && <Icon name={iconLeft}  className="w-4 h-4" strokeWidth={2} />}
        {children}
        {iconRight && <Icon name={iconRight} className="w-4 h-4" strokeWidth={2} />}
      </span>
    </>
  )
  if (href) return <Link href={href} className={cls}>{content}</Link>
  return (
    <button type={type} onClick={onClick} disabled={disabled || loading} className={cls}>
      {content}
    </button>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   INPUT
   ═══════════════════════════════════════════════════════════════════════════ */
interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string
  hint?: string
  error?: string
  iconLeft?: string
  iconRight?: string
  inputSize?: "sm" | "md" | "lg"
  containerClassName?: string
}

export function Input({
  label, hint, error, iconLeft, iconRight,
  inputSize = "md", containerClassName, className, id, ...props
}: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-")
  const sizeClass = inputSize === "sm" ? "h-8 px-3 text-xs py-1.5" :
                    inputSize === "lg" ? "h-12 px-4 text-base py-3" :
                    "h-10 px-3.5 text-sm py-2.5"
  return (
    <div className={cx("w-full", containerClassName)}>
      {label && (
        <label htmlFor={inputId}
          className="mb-1.5 block text-xs font-bold text-zinc-400 uppercase tracking-wide">
          {label}
        </label>
      )}
      <div className="relative">
        {iconLeft && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
            <Icon name={iconLeft} className="w-4 h-4" strokeWidth={1.8} />
          </span>
        )}
        <input
          id={inputId}
          className={cx(
            "input-base",
            sizeClass,
            iconLeft  && "pl-9",
            iconRight && "pr-9",
            error && "border-rose-700/70 focus:border-rose-500/60 focus:shadow-[0_0_0_3px_rgba(251,113,133,0.12)]",
            className,
          )}
          {...props}
        />
        {iconRight && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500">
            <Icon name={iconRight} className="w-4 h-4" strokeWidth={1.8} />
          </span>
        )}
      </div>
      {error && <p className="mt-1.5 text-xs text-rose-400 font-medium">{error}</p>}
      {hint  && !error && <p className="mt-1.5 text-xs text-zinc-500">{hint}</p>}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   TEXTAREA
   ═══════════════════════════════════════════════════════════════════════════ */
interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  hint?: string
  error?: string
  containerClassName?: string
}

export function Textarea({
  label, hint, error, containerClassName, className, id, ...props
}: TextareaProps) {
  const textareaId = id ?? label?.toLowerCase().replace(/\s+/g, "-")
  return (
    <div className={cx("w-full", containerClassName)}>
      {label && (
        <label htmlFor={textareaId}
          className="mb-1.5 block text-xs font-bold text-zinc-400 uppercase tracking-wide">
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        className={cx(
          "input-base resize-none",
          error && "border-rose-700/70 focus:border-rose-500/60",
          className,
        )}
        {...props}
      />
      {error && <p className="mt-1.5 text-xs text-rose-400 font-medium">{error}</p>}
      {hint  && !error && <p className="mt-1.5 text-xs text-zinc-500">{hint}</p>}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   MODAL / DIALOG
   ═══════════════════════════════════════════════════════════════════════════ */
export function Modal({ open, onClose, children, title, size = "md" }: {
  open: boolean
  onClose: () => void
  children: ReactNode
  title?: string
  size?: "sm" | "md" | "lg" | "xl"
}) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handler)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", handler)
      document.body.style.overflow = ""
    }
  }, [open, onClose])

  if (!open) return null

  const widthClass = size === "sm" ? "max-w-sm" :
                     size === "lg" ? "max-w-2xl" :
                     size === "xl" ? "max-w-4xl" :
                     "max-w-lg"

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[80] flex items-center justify-center px-4"
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" />

      {/* Panel */}
      <div className={cx(
        "relative w-full animate-scale-in",
        "card-premium rounded-2xl border border-zinc-800/80",
        "shadow-dialog",
        widthClass,
      )}>
        {title && (
          <div className="flex items-center justify-between border-b border-zinc-800/80 px-5 py-4">
            <h2 className="text-base font-black text-white">{title}</h2>
            <button onClick={onClose} aria-label="Cerrar"
              className="grid place-items-center w-8 h-8 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800/70 transition-colors tap">
              <Icon name="close" className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
        )}
        {!title && (
          <button onClick={onClose} aria-label="Cerrar"
            className="absolute top-3 right-3 z-10 grid place-items-center w-8 h-8 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800/70 transition-colors tap">
            <Icon name="close" className="w-4 h-4" strokeWidth={2} />
          </button>
        )}
        <div className="p-5">
          {children}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   ALERT
   ═══════════════════════════════════════════════════════════════════════════ */
const ALERT_TONE: Record<string, { wrap: string; icon: string; iconColor: string }> = {
  info:    { wrap: "border-blue-800/60   bg-blue-500/8",   icon: "info",    iconColor: "text-blue-400"   },
  success: { wrap: "border-emerald-800/60 bg-emerald-500/8", icon: "check", iconColor: "text-emerald-400" },
  warning: { wrap: "border-amber-800/60  bg-amber-500/8",  icon: "warning", iconColor: "text-amber-400"  },
  error:   { wrap: "border-rose-800/60   bg-rose-500/8",   icon: "close",   iconColor: "text-rose-400"   },
}

export function Alert({ children, tone = "info", title, className }: {
  children: ReactNode
  tone?: keyof typeof ALERT_TONE
  title?: string
  className?: string
}) {
  const t = ALERT_TONE[tone]
  return (
    <div className={cx(
      "flex gap-3 rounded-xl border p-4",
      t.wrap, className,
    )}>
      <Icon name={t.icon} className={cx("w-4 h-4 mt-0.5 shrink-0", t.iconColor)} strokeWidth={2} />
      <div className="min-w-0">
        {title && <p className="text-sm font-black text-white mb-0.5">{title}</p>}
        <div className="text-sm text-zinc-300">{children}</div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   DIVIDER
   ═══════════════════════════════════════════════════════════════════════════ */
export function Divider({ label, className }: { label?: string; className?: string }) {
  if (label) {
    return (
      <div className={cx("flex items-center gap-3", className)}>
        <div className="h-px flex-1 bg-zinc-800/80" />
        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">{label}</span>
        <div className="h-px flex-1 bg-zinc-800/80" />
      </div>
    )
  }
  return <div className={cx("h-px bg-zinc-800/80", className)} />
}

/* ═══════════════════════════════════════════════════════════════════════════
   SKELETON
   ═══════════════════════════════════════════════════════════════════════════ */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("skeleton rounded-xl", className)} />
}

/* ═══════════════════════════════════════════════════════════════════════════
   PAGE HEADER
   ═══════════════════════════════════════════════════════════════════════════ */
export function PageHeader({ icon, title, subtitle, action, breadcrumb, className }: {
  icon?: string
  title: string
  subtitle?: string
  action?: ReactNode
  breadcrumb?: { label: string; href: string }[]
  className?: string
}) {
  return (
    <div className={cx("flex items-start justify-between gap-3 mb-6", className)}>
      <div className="min-w-0">
        {/* Breadcrumb */}
        {breadcrumb && breadcrumb.length > 0 && (
          <nav className="flex items-center gap-1.5 mb-2">
            {breadcrumb.map((crumb, i) => (
              <span key={crumb.href} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-zinc-700 text-xs">/</span>}
                <Link href={crumb.href} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                  {crumb.label}
                </Link>
              </span>
            ))}
            <span className="text-zinc-700 text-xs">/</span>
            <span className="text-xs text-zinc-400 font-medium">{title}</span>
          </nav>
        )}
        {/* Title row */}
        <div className="flex items-center gap-2.5">
          {icon && (
            <span className="grid place-items-center w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/10 border border-emerald-700/40 text-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.15)] shrink-0">
              <Icon name={icon} className="w-4.5 h-4.5" strokeWidth={2} />
            </span>
          )}
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">{title}</h1>
        </div>
        {subtitle && (
          <p className="text-sm text-zinc-500 mt-1.5 leading-snug max-w-prose">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   EMPTY STATE
   ═══════════════════════════════════════════════════════════════════════════ */
export function EmptyState({ emoji = "📭", title, hint, action, icon }: {
  emoji?: string
  title: string
  hint?: string
  action?: ReactNode
  icon?: string
}) {
  return (
    <div className="text-center py-16 px-4 animate-fade-in">
      {icon ? (
        <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-zinc-800/60 border border-zinc-700/60 text-zinc-500 mb-3">
          <Icon name={icon} className="w-6 h-6" strokeWidth={1.5} />
        </span>
      ) : (
        <p className="text-4xl mb-3">{emoji}</p>
      )}
      <p className="text-zinc-200 font-black">{title}</p>
      {hint && <p className="text-sm text-zinc-500 mt-1.5 max-w-sm mx-auto leading-snug">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   SPINNER
   ═══════════════════════════════════════════════════════════════════════════ */
export function Spinner({ className = "w-5 h-5", color = "text-emerald-400" }: {
  className?: string
  color?: string
}) {
  return (
    <svg className={cx("animate-spin", color, className)} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.2" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   STAT CARD (used in dashboards/headers)
   ═══════════════════════════════════════════════════════════════════════════ */
export function StatCard({ value, label, sub, color = "emerald" }: {
  value: string
  label: string
  sub?: string
  color?: "emerald" | "cyan" | "violet" | "amber" | "rose" | "blue"
}) {
  const colorMap: Record<string, { val: string; bg: string; border: string }> = {
    emerald: { val: "text-emerald-400", bg: "bg-emerald-500/8",  border: "border-emerald-800/50" },
    cyan:    { val: "text-cyan-400",    bg: "bg-cyan-500/8",     border: "border-cyan-800/50"    },
    violet:  { val: "text-violet-400",  bg: "bg-violet-500/8",   border: "border-violet-800/50"  },
    amber:   { val: "text-amber-400",   bg: "bg-amber-500/8",    border: "border-amber-800/50"   },
    rose:    { val: "text-rose-400",    bg: "bg-rose-500/8",     border: "border-rose-800/50"    },
    blue:    { val: "text-blue-400",    bg: "bg-blue-500/8",     border: "border-blue-800/50"    },
  }
  const c = colorMap[color]
  return (
    <div className={cx(
      "flex flex-col gap-0.5 rounded-xl border px-4 py-3",
      c.bg, c.border,
    )}>
      <span className={cx("text-2xl font-black leading-none tracking-tight", c.val)}>{value}</span>
      <span className="text-xs font-bold text-zinc-400 uppercase tracking-wide">{label}</span>
      {sub && <span className="text-[10px] text-zinc-600">{sub}</span>}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   ICON BUTTON
   ═══════════════════════════════════════════════════════════════════════════ */
export function IconButton({ icon, onClick, label, size = "md", variant = "ghost", className }: {
  icon: string
  onClick?: () => void
  label: string
  size?: "sm" | "md" | "lg"
  variant?: "ghost" | "outline" | "filled"
  className?: string
}) {
  const sizeClass = size === "sm" ? "w-7 h-7"  :
                    size === "lg" ? "w-11 h-11" :
                    "w-9 h-9"
  const iconSize  = size === "sm" ? "w-3.5 h-3.5" :
                    size === "lg" ? "w-5 h-5"      :
                    "w-4.5 h-4.5"
  const variantClass =
    variant === "outline" ? "border border-zinc-700/80 hover:border-zinc-600 hover:bg-zinc-800/60 text-zinc-400 hover:text-white" :
    variant === "filled"  ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-300" :
    "hover:bg-zinc-800/70 text-zinc-400 hover:text-white"

  return (
    <button onClick={onClick} aria-label={label}
      className={cx(
        "grid place-items-center rounded-lg transition-colors tap",
        sizeClass, variantClass, className,
      )}>
      <Icon name={icon} className={iconSize} strokeWidth={1.8} />
    </button>
  )
}
