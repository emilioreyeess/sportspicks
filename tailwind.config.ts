import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        mono: ["'JetBrains Mono'", "'Fira Code'", "ui-monospace", "monospace"],
        display: ["Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
      },

      // ─── Semantic tokens via CSS vars ─────────────────────────────────────
      colors: {
        bg:           "var(--bg)",
        surface:      "var(--surface)",
        "surface-2":  "var(--surface-2)",
        border:       "var(--border)",
        accent:       "var(--accent)",
        "accent-cyan":"var(--accent-cyan)",
      },

      // ─── Spacing: 4pt base grid, with named helpers ───────────────────────
      spacing: {
        "4.5":  "1.125rem",  //  18px
        "5.5":  "1.375rem",  //  22px
        "6.5":  "1.625rem",  //  26px
        "13":   "3.25rem",   //  52px
        "15":   "3.75rem",   //  60px
        "18":   "4.5rem",    //  72px
        "22":   "5.5rem",    //  88px
        "26":   "6.5rem",    // 104px
        "30":   "7.5rem",    // 120px
      },

      // ─── Radii ────────────────────────────────────────────────────────────
      borderRadius: {
        "2.5xl": "1.25rem",
        "3xl":   "1.5rem",
        "3.5xl": "1.75rem",
        "4xl":   "2rem",
      },

      // ─── Type scale additions ─────────────────────────────────────────────
      fontSize: {
        "2xs":  ["0.625rem",  { lineHeight: "0.875rem",  letterSpacing: "0.02em" }],
        "3.5xl":["2rem",      { lineHeight: "2.375rem",  letterSpacing: "-0.02em" }],
        "4.5xl":["2.625rem",  { lineHeight: "3rem",      letterSpacing: "-0.03em" }],
        "5.5xl":["3.5rem",    { lineHeight: "3.75rem",   letterSpacing: "-0.03em" }],
      },

      // ─── Elevation-based shadow system ────────────────────────────────────
      boxShadow: {
        // Surfaces
        "card":         "0 1px 3px rgba(0,0,0,0.45), 0 1px 2px -1px rgba(0,0,0,0.25)",
        "card-md":      "0 4px 12px -2px rgba(0,0,0,0.5), 0 2px 6px -2px rgba(0,0,0,0.3)",
        "card-hover":   "0 8px 32px -4px rgba(0,0,0,0.6), 0 4px 12px -4px rgba(0,0,0,0.4)",
        "dialog":       "0 24px 80px -12px rgba(0,0,0,0.85), 0 8px 32px -4px rgba(0,0,0,0.5)",
        "topbar":       "0 1px 0 rgba(255,255,255,0.04)",
        // Glow variants
        "glow-emerald": "0 0 0 1px rgba(52,211,153,0.18), 0 8px 40px -8px rgba(52,211,153,0.28)",
        "glow-cyan":    "0 0 0 1px rgba(34,211,238,0.18), 0 8px 40px -8px rgba(34,211,238,0.28)",
        "glow-violet":  "0 0 0 1px rgba(167,139,250,0.18), 0 8px 40px -8px rgba(167,139,250,0.28)",
        "glow-amber":   "0 0 0 1px rgba(251,191,36,0.18), 0 8px 40px -8px rgba(251,191,36,0.22)",
        "glow-rose":    "0 0 0 1px rgba(251,113,133,0.18), 0 8px 40px -8px rgba(251,113,133,0.25)",
        // Button glow
        "btn-emerald":  "0 4px 20px -4px rgba(52,211,153,0.40)",
        "btn-violet":   "0 4px 20px -4px rgba(167,139,250,0.40)",
        // Inner highlights
        "inner-highlight": "inset 0 1px 0 rgba(255,255,255,0.06)",
      },

      // ─── Easing functions ─────────────────────────────────────────────────
      transitionTimingFunction: {
        "spring":     "cubic-bezier(0.22, 1, 0.36, 1)",
        "bounce-in":  "cubic-bezier(0.34, 1.56, 0.64, 1)",
        "ease-out-quart": "cubic-bezier(0.25, 1, 0.5, 1)",
      },

      // ─── Transitions ─────────────────────────────────────────────────────
      transitionDuration: {
        "150": "150ms",
        "250": "250ms",
        "350": "350ms",
        "400": "400ms",
      },

      // ─── Z-index scale ────────────────────────────────────────────────────
      zIndex: {
        "1":   "1",
        "60":  "60",
        "70":  "70",
        "80":  "80",
        "90":  "90",
        "100": "100",
      },

      // ─── Backdrop blur additions ──────────────────────────────────────────
      backdropBlur: {
        "xs": "4px",
        "2xl": "40px",
        "3xl": "60px",
      },

      // ─── Extra keyframes ──────────────────────────────────────────────────
      keyframes: {
        "enter-bottom": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "enter-top": {
          from: { opacity: "0", transform: "translateY(-12px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "enter-right": {
          from: { opacity: "0", transform: "translateX(12px)" },
          to:   { opacity: "1", transform: "translateX(0)" },
        },
        "enter-left": {
          from: { opacity: "0", transform: "translateX(-12px)" },
          to:   { opacity: "1", transform: "translateX(0)" },
        },
        "scale-spring": {
          from: { opacity: "0", transform: "scale(0.94)" },
          to:   { opacity: "1", transform: "scale(1)" },
        },
        "pulse-ring": {
          "0%":   { transform: "scale(1)",    opacity: "0.6" },
          "100%": { transform: "scale(1.5)",  opacity: "0" },
        },
        "shimmer": {
          "0%":   { backgroundPosition: "-480px 0" },
          "100%": { backgroundPosition: "480px 0" },
        },
      },
      animation: {
        "enter-bottom": "enter-bottom 0.35s cubic-bezier(0.22, 1, 0.36, 1) both",
        "enter-top":    "enter-top 0.35s cubic-bezier(0.22, 1, 0.36, 1) both",
        "enter-right":  "enter-right 0.3s cubic-bezier(0.22, 1, 0.36, 1) both",
        "enter-left":   "enter-left 0.3s cubic-bezier(0.22, 1, 0.36, 1) both",
        "scale-spring": "scale-spring 0.25s cubic-bezier(0.22, 1, 0.36, 1) both",
        "pulse-ring":   "pulse-ring 1.4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
}

export default config
