import type { Config } from "tailwindcss";

export default {
  darkMode: 'class',
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        barmlo: {
          blue: '#1e3a8a', // Deep Royal Blue (Sign Background)
          green: '#10b981', // Emerald Green
          orange: '#f59e0b', // Amber/Orange (Logo Circles)
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
