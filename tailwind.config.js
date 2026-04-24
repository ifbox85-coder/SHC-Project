/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Mendefinisikan warna Gold agar sinkron dengan brand
        gold: {
          light: '#F5E6BE',
          DEFAULT: '#D4AF37',
          dark: '#B8860B',
        },
      },
    },
  },
  plugins: [],
}