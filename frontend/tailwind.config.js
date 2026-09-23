/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#DC2626",
          "primary-hover": "#B91C1C",
          blood: "#991B1B",
          crimson: "#EF4444",
          amber: "#F59E0B",
          surface: "#181C26",
          dashboard: "#0B0D13",
          sidebarStart: "#991B1B",
          sidebarEnd: "#0B0D13",
          dark: "#F8FAFC",
          muted: "#94A3B8",
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Prompt', 'Kanit', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
