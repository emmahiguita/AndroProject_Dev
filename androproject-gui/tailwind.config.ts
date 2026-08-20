import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    // Escanear TODO src/: las vistas viven en src/features/ y sus clases
    // no se generaban (top-1/2, grid-cols-2, text-[10px]… ausentes del CSS),
    // dejando el dashboard sin estilos. Nunca excluir features aquí.
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        surface: {
          root: "var(--surface-root)",
          base: "var(--surface-base)",
          raised: "var(--surface-raised)",
          overlay: "var(--surface-overlay)",
        },
        brand: {
          DEFAULT: "var(--brand)",
          light: "var(--brand-light)",
          muted: "var(--brand-muted)",
        },
        border: {
          subtle: "var(--border-subtle)",
          DEFAULT: "var(--border-default)",
          strong: "var(--border-strong)",
          accent: "var(--border-accent)",
        },
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          tertiary: "var(--text-tertiary)",
          disabled: "var(--text-disabled)",
          accent: "var(--text-accent)",
        },
        semantic: {
          success: "var(--success)",
          warning: "var(--warning)",
          danger: "var(--danger)",
          info: "var(--info)",
          violet: "var(--violet)",
        },
      },
      fontFamily: {
        sans: "var(--font-sans)",
        mono: "var(--font-mono)",
      },
      fontSize: {
        "3xs": ["var(--text-3xs)", { lineHeight: "1.4" }],
        "2xs": ["var(--text-2xs)", { lineHeight: "var(--leading-normal)" }],
        xs: ["var(--text-xs)", { lineHeight: "var(--leading-normal)" }],
        sm: ["var(--text-sm)", { lineHeight: "var(--leading-normal)" }],
        base: ["var(--text-base)", { lineHeight: "var(--leading-normal)" }],
        lg: ["var(--text-lg)", { lineHeight: "var(--leading-normal)" }],
        xl: ["var(--text-xl)", { lineHeight: "var(--leading-tight)" }],
        "2xl": ["var(--text-2xl)", { lineHeight: "var(--leading-tight)" }],
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
      },
      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
        "glow-brand": "var(--glow-brand-sm)",
        "glow-brand-md": "var(--glow-brand-md)",
        "glow-brand-lg": "var(--glow-brand-lg)",
        "glow-emerald": "var(--glow-emerald-sm)",
        "glow-cyan": "var(--glow-cyan-sm)",
        "glow-blue": "0 0 8px rgba(59, 130, 246, 0.4)",
        "glow-red": "0 0 8px rgba(239, 68, 68, 0.4)",
        "inner-light": "inset 0 1px 0 rgba(255, 255, 255, 0.05)",
        "inner-dark": "inset 0 1px 0 rgba(0, 0, 0, 0.1)",
      },
      animation: {
        "fade-in": "fade-in 250ms cubic-bezier(0.16, 1, 0.3, 1) both",
        "fade-in-up": "fade-in-up 400ms cubic-bezier(0.16, 1, 0.3, 1) both",
        "fade-in-down": "fade-in-down 250ms cubic-bezier(0.16, 1, 0.3, 1) both",
        "scale-in": "scale-in 400ms cubic-bezier(0.34, 1.56, 0.64, 1) both",
        "pulse-dot": "pulse-dot 2s ease-in-out infinite",
        shimmer: "shimmer 2s ease-in-out infinite",
        "spin-slow": "spin-slow 3s linear infinite",
      },
      transitionTimingFunction: {
        out: "cubic-bezier(0.16, 1, 0.3, 1)",
        "in-out": "cubic-bezier(0.65, 0, 0.35, 1)",
        spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
        smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
