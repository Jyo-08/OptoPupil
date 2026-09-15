/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        clinical: {
          bg: "#070a11",
          card: "#0d1322",
          cardBorder: "#1e293b",
          cardHover: "#131c31",
          cyan: "#06b6d4",
          cyanLight: "#38bdf8",
          cyanGlow: "rgba(6, 182, 212, 0.15)",
          emerald: "#10b981",
          emeraldBg: "rgba(16, 185, 129, 0.1)",
          amber: "#f59e0b",
          amberBg: "rgba(245, 158, 11, 0.1)",
          rose: "#f43f5e",
          roseBg: "rgba(244, 63, 94, 0.1)",
          muted: "#64748b",
          text: "#f8fafc",
          subtext: "#94a3b8"
        }
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
