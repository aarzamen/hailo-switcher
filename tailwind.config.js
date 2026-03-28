/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        text: "var(--color-text)",
        background: "var(--color-background)",
        "background-card": "var(--color-background-card, var(--color-background))",
        "sidebar-bg": "var(--color-sidebar-bg, var(--color-background))",
        "logo-primary": "var(--color-logo-primary)",
        "logo-stroke": "var(--color-logo-stroke)",
        "text-stroke": "var(--color-text-stroke)",
        accent: "var(--color-background-ui)",
        "accent-glow": "var(--color-accent-glow)",
        "surface-border": "var(--color-surface-border)",
      },
    },
  },
  plugins: [],
};
