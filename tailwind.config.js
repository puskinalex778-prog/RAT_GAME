/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: { 50: '#fffaf2', 100: '#fbf1e1', 200: '#f3e1c4', 300: '#e9cda2' },
        cocoa: { 400: '#a07655', 500: '#8a6142', 600: '#6f4b31', 700: '#553823', 800: '#3d2818' },
        berry: { 400: '#d9708a', 500: '#c85676', 600: '#a93f5e' },
        sage: { 400: '#8fb38a', 500: '#6f9a6a', 600: '#557d51' },
      },
      fontFamily: {
        sans: ['"Nunito"', '"Segoe UI"', 'Roboto', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 6px 20px -6px rgba(61,40,24,0.35)',
      },
    },
  },
  plugins: [],
};
