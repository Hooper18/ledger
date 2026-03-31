/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#e53935',
          light: '#ff6f60',
          dark: '#ab000d',
        },
      },
      screens: {
        'xs': '375px',
      },
    },
  },
  plugins: [],
}
