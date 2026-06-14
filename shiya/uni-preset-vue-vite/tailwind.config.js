/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#5a5a40',
        secondary: '#a3b18a',
        accent: '#d4a373',
        background: '#f5f5f0',
        surface: '#fdfcf9',
        border: '#e5e0d8',
        text: '#2d2d2d',
        muted: '#8c857d',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Georgia', 'Cambria', 'serif'],
      },
    },
  },
  plugins: [],
}