import colors from 'tailwindcss/colors';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // errors, warnings, "late", delete: they stay red while the brand turned violet / blue
        danger: colors.red,
        brand: {
          primary: "#7C3AED",
          "primary-hover": "#6D28D9",
          deep: "#4C1D95",
          light: "#A78BFA",
          accent: "#38BDF8",
          amber: "#F59E0B",
          surface: "#181C26",
          dashboard: "#0B0D13",
          sidebarStart: "#4C1D95",
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
