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
  default:  "bg-zinc-900/75 rounded-2xl border border-white/[0.07] shadow-[0_2px_16px_rgba(0,0,0,0.32),inset_0_0.5px_0_rgba(255,255,255,0.05)]",
  flat:     "bg-zinc-900/60 rounded-2xl border border-white/[0.06]",
  elevated: "bg-zinc-900/80 rounded-2xl border border-white/[0.08] shadow-[0_8px_40px_rgba(0,0,0,0.50),inset_0_0.5px_0_rgba(255,255,255,0.06)]",
  ghost:    "rounded-2xl",
  outline:  "rounded-2xl border border-white/[0.07] bg-transparent",
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
        glow && "shadow-[0_0_0_1px_rgba(52,211,153,0.10),0_8px_40px_-12px_rgba(52,211,153,0.15)]",
        hover && "transition-all duration-200 cursor-pointer hover:border-white/[0.12] hover:-translate-y-[1px] hover:shadow-[0_8px_32px_rgba(0,0,0,0.40)]",
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
  emerald: "bg-emerald-500/12 text-emerald-300 border-emerald-700/50",
  amber:   "bg-amber-500/12   text-amber-300   border-amber-700/50",
  blue:    "bg-blue-500/12    text-blue-300    border-blue-700/50",
  violet:  "bg-violet-500/12  text-violet-300  border-violet-700/50",
  rose:    "bg-rose-500/12    text-rose-300    border-rose-700/50",
  cyan:    "bg-cyan-500/12    text-cyan-300    border-cyan-700/50",
  orange:  "bg-orange-500/12  text-orange-300  border-orange-700/50",
  zinc:    "bg-zinc-800/70    text-zinc-400    border-white/[0.07]",
}

export function Badge({ children, tone = "zinc", className, dot }: {
  children: ReactNode
  tone?: keyof typeof BADGE_TONE
  className?: string
  dot?: boolean
}) {
  return (
    <span className={cx(
      "inline-flex items-center gap-1.5 rounded-full border px-2 py-[3px] text-[10px] font-bold uppercase tracking-wide",
      BADGE_TONE[tone], className,
    )}>
      {dot && <span className={cx(
        "h-1.5 w-1.5 rounded-full shrink-0",
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
  primary:   "bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-zinc-950 font-semibold shadow-[0_4px_16px_-4px_rgba(52,211,153,0.38)] hover:shadow-[0_6px_20px_-4px_rgba(52,211,153,0.50)]",
  secondary: "bg-white/[0.06] hover:bg-white/[0.10] active:bg-white/[0.04] text-white font-medium border border-white/[0.12] hover:border-white/[0.20]",
  ghost:     "bg-transparent hover:bg-white/[0.06] text-zinc-300 hover:text-white font-medium",
  danger:    "bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-semibold shadow-[0_4px_16px_-4px_rgba(225,29,72,0.38)]",
  premium:   "bg-gradient-to-r from-emerald-500 to-cyan-500 hover:opacity-92 active:opacity-82 text-zinc-950 font-semibold shadow-[0_4px_16px_-4px_rgba(52,211,153,0.38)]",
  violet:    "bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-92 active:opacity-82 text-white font-semibold shadow-[0_4px_16px_-4px_rgba(139,92,246,0.38)]",
  outline:   "bg-transparent border border-white/[0.12] hover:bg-white/[0.06] hover:border-white/[0.20] text-zinc-300 hover:text-white font-medium",
}
const BTN_SIZE: Record<string, string> = {
  xs: "px-2.5 py-1    text-[11px] rounded-[8px]  h-7",
  sm: "px-3   py-1.5  text-[12px] rounded-[9px]  h-8",
  md: "px-4   py-2.5  text-[14px] rounded-[11px] h-10",
  lg: "px-6   py-3    text-[14px] rounded-[13px] h-12",
  xl: "px-8   py-3.5  text-[15px] rounded-[14px] h-14",
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
    "disabled:opacity-40 disabled:pointer-events-none active:scale-[0.97]",
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
        {iconLeft  && <Icon name={iconLeft}  className="w-4 h-4 shrink-0" strokeWidth={2} />}
        {children}
        {iconRight && <Icon name={iconRight} className="w-4 h-4 shrink-0" strokeWidth={2} />}
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
  const sizeClass = inputSize === "sm" ? "h-8 px-3 text-[12px] py-1.5" :
                    inputSize === "lg" ? "h-12 px-4 text-[15px] py-3" :
                    "h-10 px-3.5 text-[14px] py-2.5"
  return (
    <div className={cx("w-full", containerClassName)}>
      {label && (
        <label htmlFor={inputId}
          className="mb-1.5 block text-[12px] font-medium text-zinc-400">
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
            error && "border-rose-700/60 focus:border-rose-500/60 focus:shadow-[0_0_0_3px_rgba(251,113,133,0.10)]",
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
      {error && <p className="mt-1.5 text-[12px] text-rose-400 font-medium">{error}</p>}
      {hint  && !error && <p className="mt-1.5 text-[12px] text-zinc-500">{hint}</p>}
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
          className="mb-1.5 block text-[12px] font-medium text-zinc-400">
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        className={cx(
          "input-base resize-none",
          error && "border-rose-700/60 focus:border-rose-500/60",
          className,
        )}
        {...props}
      />
      {error && <p className="mt-1.5 text-[12px] text-rose-400 font-medium">{error}</p>}
      {hint  && !error && <p className="mt-1.5 text-[12px] text-zinc-500">{hint}</p>}
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
      <div className="absolute inset-0 bg-black/72 backdrop-blur-[3px] animate-fade-in" />

      {/* Panel — Apple sheet style */}
      <div className={cx(
        "relative w-full animate-scale-in",
        "bg-zinc-900/88 rounded-[20px] border border-white/[0.08]",
        "shadow-[0_24px_80px_rgba(0,0,0,0.70),inset_0_0.5px_0_rgba(255,255,255,0.06)]",
        "backdrop-filter: saturate(180%) blur(20px)",
        widthClass,
      )}>
        {title && (
          <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
            <h2 className="text-[15px] font-bold text-white">{title}</h2>
            <button onClick={onClose} aria-label="Cerrar"
              className="grid place-items-center w-8 h-8 rounded-[8px] text-zinc-500 hover:text-white hover:bg-white/[0.07] transition-colors tap">
              <Icon name="close" className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
        )}
        {!title && (
          <button onClick={onClose} aria-label="Cerrar"
            className="absolute top-3.5 right-3.5 z-10 grid place-items-center w-8 h-8 rounded-[8px] text-zinc-500 hover:text-white hover:bg-white/[0.07] transition-colors tap">
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
  info:    { wrap: "border-blue-800/50   bg-blue-500/[0.07]",    icon: "info",    iconColor: "text-blue-400"   },
  success: { wrap: "border-emerald-800/50 bg-emerald-500/[0.07]", icon: "check",  iconColor: "text-emerald-400" },
  warning: { wrap: "border-amber-800/50  bg-amber-500/[0.07]",   icon: "warning", iconColor: "text-amber-400"  },
  error:   { wrap: "border-rose-800/50   bg-rose-500/[0.07]",    icon: "close",   iconColor: "text-rose-400"   },
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
      "flex gap-3 rounded-[12px] border p-4",
      t.wrap, className,
    )}>
      <Icon name={t.icon} className={cx("w-[15px] h-[15px] mt-0.5 shrink-0", t.iconColor)} strokeWidth={2} />
      <div className="min-w-0">
        {title && <p className="text-[13px] font-semibold text-white mb-0.5">{title}</p>}
        <div className="text-[13px] text-zinc-300 leading-relaxed">{children}</div>
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
        <div className="h-px flex-1 bg-white/[0.07]" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">{label}</span>
        <div className="h-px flex-1 bg-white/[0.07]" />
      </div>
    )
  }
  return <div className={cx("h-px bg-white/[0.07]", className)} />
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
                {i > 0 && <span className="text-zinc-700 text-[11px]">/</span>}
                <Link href={crumb.href} className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors">
                  {crumb.label}
                </Link>
              </span>
            ))}
            <span className="text-zinc-700 text-[11px]">/</span>
            <span className="text-[11px] text-zinc-400 font-medium">{title}</span>
          </nav>
        )}
        {/* Title row */}
        <div className="flex items-center gap-3">
          {icon && (
            <span className="grid place-items-center w-9 h-9 rounded-[10px] bg-gradient-to-br from-emerald-500/18 to-cyan-500/10 border border-emerald-700/38 text-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.12)] shrink-0">
              <Icon name={icon} className="w-4 h-4" strokeWidth={2.1} />
            </span>
          )}
          <h1 className="text-[22px] sm:text-[26px] font-black text-white tracking-tight leading-tight">{title}</h1>
        </div>
        {subtitle && (
          <p className="text-[13px] text-zinc-500 mt-1.5 leading-relaxed max-w-prose">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0 mt-0.5">{action}</div>}
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
        <span className="inline-flex items-center justify-center w-14 h-14 rounded-[16px] bg-zinc-900/80 border border-white/[0.07] text-zinc-500 mb-4">
          <Icon name={icon} className="w-6 h-6" strokeWidth={1.5} />
        </span>
      ) : (
        <p className="text-4xl mb-4">{emoji}</p>
      )}
      <p className="text-[15px] text-zinc-200 font-bold">{title}</p>
      {hint && <p className="text-[13px] text-zinc-500 mt-1.5 max-w-sm mx-auto leading-snug">{hint}</p>}
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
   STAT CARD — Apple HIG display style
   ═══════════════════════════════════════════════════════════════════════════ */
export function StatCard({ value, label, sub, color = "emerald" }: {
  value: string
  label: string
  sub?: string
  color?: "emerald" | "cyan" | "violet" | "amber" | "rose" | "blue"
}) {
  const colorMap: Record<string, { val: string; bg: string; border: string }> = {
    emerald: { val: "text-emerald-400", bg: "bg-emerald-500/[0.07]", border: "border-emerald-800/45" },
    cyan:    { val: "text-cyan-400",    bg: "bg-cyan-500/[0.07]",    border: "border-cyan-800/45"    },
    violet:  { val: "text-violet-400",  bg: "bg-violet-500/[0.07]",  border: "border-violet-800/45"  },
    amber:   { val: "text-amber-400",   bg: "bg-amber-500/[0.07]",   border: "border-amber-800/45"   },
    rose:    { val: "text-rose-400",    bg: "bg-rose-500/[0.07]",    border: "border-rose-800/45"    },
    blue:    { val: "text-blue-400",    bg: "bg-blue-500/[0.07]",    border: "border-blue-800/45"    },
  }
  const c = colorMap[color]
  return (
    <div className={cx(
      "flex flex-col gap-0.5 rounded-[12px] border px-4 py-3",
      c.bg, c.border,
    )}>
      <span className={cx("text-[24px] font-black leading-none tracking-tight", c.val)}>{value}</span>
      <span className="text-[11px] font-semibold text-zinc-400 leading-tight uppercase tracking-wide">{label}</span>
      {sub && <span className="text-[10px] text-zinc-600 leading-tight">{sub}</span>}
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
                    "w-4 h-4"
  const variantClass =
    variant === "outline" ? "border border-white/[0.12] hover:border-white/[0.20] hover:bg-white/[0.06] text-zinc-400 hover:text-white" :
    variant === "filled"  ? "bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300" :
    "hover:bg-white/[0.06] text-zinc-400 hover:text-white"

  return (
    <button onClick={onClick} aria-label={label}
      className={cx(
        "grid place-items-center rounded-[9px] transition-colors tap",
        sizeClass, variantClass, className,
      )}>
      <Icon name={icon} className={iconSize} strokeWidth={1.8} />
    </button>
  )
}
