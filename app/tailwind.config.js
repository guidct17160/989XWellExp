/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1F4C9C',
          dark: '#163875',
          light: '#EBF2FA',
          mid: '#2B5EBD',
        },
        secondary: {
          DEFAULT: '#3AAAE8',
          light: '#E8F5FD',
        },
        pink: {
          DEFAULT: '#D93A8B',
          light: '#FDF0F7',
        },
        yellow: {
          DEFAULT: '#F6B828',
          light: '#FFF8E6',
        },
        accent: '#3AAAE8',
        bgSecondary: '#F6F8FB',
        cardBorder: '#E8EEF5',
        textPrimary: '#0F172A',
        textSecondary: '#64748B',
        success: {
          DEFAULT: '#27AE60',
          light: '#E8F5E9',
        },
        warning: {
          DEFAULT: '#F6B828',
          light: '#FFF8E6',
        },
        error: {
          DEFAULT: '#E24C4B',
          light: '#FFEBEE',
        },
      },
    },
  },
  plugins: [],
};
