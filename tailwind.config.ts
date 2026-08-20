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
        // Base backgrounds — dark charcoal, not pure black
        background: "#0a0f0d",      // page background
        surface: "#111a14",         // sidebar, cards, elevated elements
        "surface-2": "#172019",     // slightly lighter: input bg, hover states
        "surface-3": "#1e2b1f",     // borders, separators

        // Accent — muted forest green (not neon)
        accent: "#22c55e",          // primary CTAs, active states
        "accent-hover": "#16a34a",  // hover on accent
        "accent-muted": "#166534",  // subtle accent backgrounds
        "accent-dim": "#14532d",    // very subtle: badge bg, borders

        // Text
        "text-primary": "#e8f5e9",  // off-white with slight green tint
        "text-secondary": "#6b8f72", // muted green-gray for meta, timestamps
        "text-muted": "#4a6b50",    // even more muted: placeholder text

        // Status colours — kept semantic
        error: "#f87171",
        "error-bg": "#2d1515",
        warning: "#fbbf24",
        "warning-bg": "#2d2010",
        success: "#4ade80",
        "success-bg": "#0f2d1a",

        // Keep a `brand` alias pointing to accent for any leftovers
        brand: {
          50:  "#f0fdf4",
          100: "#dcfce7",
          200: "#bbf7d0",
          300: "#86efac",
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
          800: "#166534",
          900: "#14532d",
        },
      },

      // ── Border radius — one consistent scale ──────────────────────────────
      borderRadius: {
        none: "0",
        sm:   "4px",
        DEFAULT: "6px",
        md:   "8px",
        lg:   "10px",
        xl:   "12px",
        "2xl": "16px",
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
