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
          blue: '#1e3a8a', // Deep Royal Blue
          green: '#10b981', // Emerald Green
          orange: '#f97316', // Bright Orange
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
