import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // ── Design token palette ───────────────────────────────────────────────
      colors: {
        // Base backgrounds — deep charcoal with a cool green undertone
        background: "#06090a",      // page background
        surface: "#0b1210",         // sidebar, cards, elevated elements
        "surface-2": "#101a15",     // slightly lighter: input bg, hover states
        "surface-3": "#1a271f",     // borders, separators

        // Accent — modern emerald (brighter, more premium)
        accent: "#34d399",          // primary CTAs, active states
        "accent-hover": "#6ee7b7",  // hover on accent
        "accent-muted": "#065f46",  // subtle accent backgrounds
        "accent-dim": "#052e22",    // very subtle: badge bg, borders

        // Text
        "text-primary": "#f2f7f4",  // near-white, crisp
        "text-secondary": "#8ba897",// muted sage for meta, timestamps
        "text-muted": "#55705f",    // even more muted: placeholder text

        // Status colours — kept semantic
        error: "#f87171",
        "error-bg": "#2d1515",
        warning: "#fbbf24",
        "warning-bg": "#2d2010",
        success: "#4ade80",
        "success-bg": "#0f2d1a",

        // Keep a `brand` alias pointing to accent for any leftovers
        brand: {
          50:  "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#6ee7b7",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
          800: "#065f46",
          900: "#064e3b",
        },
      },

      // ── Border radius — one consistent scale ──────────────────────────────
      borderRadius: {
        none: "0",
        sm:   "6px",
        DEFAULT: "8px",
        md:   "10px",
        lg:   "14px",
        xl:   "18px",
        "2xl": "24px",
        full: "9999px",
      },

      // ── Box shadow — subtle, dark-theme aware ─────────────────────────────
      boxShadow: {
        sm:  "0 1px 2px 0 rgba(0,0,0,0.4)",
        DEFAULT: "0 2px 6px 0 rgba(0,0,0,0.45)",
        md:  "0 4px 12px 0 rgba(0,0,0,0.5)",
        lg:  "0 8px 24px 0 rgba(0,0,0,0.55)",
        none: "none",
        // Accent glow for focused inputs / active elements
        "accent-glow": "0 0 0 2px rgba(34,197,94,0.35)",
      },

      // ── Animations ────────────────────────────────────────────────────────
      animation: {
        "fade-in":  "fadeIn 0.25s ease-in-out",
        "slide-up": "slideUp 0.25s ease-out",
        spin:       "spin 1s linear infinite",
      },
      keyframes: {
        fadeIn: {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%":   { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
