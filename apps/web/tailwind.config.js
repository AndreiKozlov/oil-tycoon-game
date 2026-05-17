/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        oil: {
          DEFAULT: '#0b0f17',
          accent: '#f59e0b',
          dim: '#1e293b',
        },
      },
    },
  },
  plugins: [],
};
