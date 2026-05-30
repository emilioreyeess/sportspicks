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

        // ─── Desaturated brand ramps ────────────────────────────────────────
        // Same hue + lightness as Tailwind defaults, lower saturation — a
        // calmer, more elegant palette that propagates to every utility
        // (bg-emerald-500, text-cyan-400, border-violet-700/40, …) at once.
        emerald: {
          50: "#effaf5",
          100: "#d9f2e5",
          200: "#b5e5cf",
          300: "#85d0b2",
          400: "#52b591",
          500: "#309976",
          600: "#217a5f",
          700: "#1a624e",
          800: "#174e3f",
          900: "#144035",
          950: "#0a241e",
        },
        cyan: {
          50: "#f0fafb",
          100: "#d9f2f4",
          200: "#b7e5ea",
          300: "#86d0da",
          400: "#4db3c3",
          500: "#3197a9",
          600: "#2c7b8e",
          700: "#296475",
          800: "#295461",
          900: "#264753",
          950: "#152e37",
        },
        violet: {
          50: "#f6f5fd",
          100: "#efedfa",
          200: "#e2ddf7",
          300: "#ccc2f0",
          400: "#b19fe6",
          500: "#9678da",
          600: "#845acd",
          700: "#7448b9",
          800: "#613c9b",
          900: "#51337f",
          950: "#331f56",
        },
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
        // Surfaces — soft, diffuse, almost-invisible elevation
        "card":         "0 1px 3px rgba(0,0,0,0.20)",
        "card-md":      "0 6px 24px -8px rgba(0,0,0,0.30)",
        "card-hover":   "0 12px 40px -12px rgba(0,0,0,0.38)",
        "dialog":       "0 28px 90px -20px rgba(0,0,0,0.55)",
        "topbar":       "0 1px 0 rgba(255,255,255,0.04)",
        // Glow variants — desaturated, no hard ring, just a faint halo
        "glow-emerald": "0 8px 40px -12px rgba(82,181,145,0.20)",
        "glow-cyan":    "0 8px 40px -12px rgba(77,179,195,0.18)",
        "glow-violet":  "0 8px 40px -12px rgba(177,159,230,0.20)",
        "glow-amber":   "0 8px 40px -12px rgba(251,191,36,0.16)",
        "glow-rose":    "0 8px 40px -12px rgba(251,113,133,0.18)",
        // Button glow — subtle lift, not neon
        "btn-emerald":  "0 4px 18px -6px rgba(82,181,145,0.30)",
        "btn-violet":   "0 4px 18px -6px rgba(177,159,230,0.30)",
        // Inner highlights
        "inner-highlight": "inset 0 1px 0 rgba(255,255,255,0.05)",
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
